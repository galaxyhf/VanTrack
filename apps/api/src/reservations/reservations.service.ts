import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import {
  reservations,
  trips,
  vehicles,
  waitlist,
  routeStops,
  settings,
  notifications,
  type Transaction,
} from '@vantrack/database';
import type { Principal } from '../auth/auth.service';
import { DatabaseService } from '../common/database.service';
import { EventsService } from '../common/events.service';
@Injectable()
export class ReservationsService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(EventsService) private readonly events: EventsService,
  ) {}
  private get db() {
    return this.database.db;
  }
  private async config(tx: Transaction, key: string, fallback: number) {
    const [row] = await tx.select().from(settings).where(eq(settings.key, key));
    return row?.value ?? fallback;
  }
  private async lock(tx: Transaction, id: string) {
    const [trip] = await tx.select().from(trips).where(eq(trips.id, id)).for('update');
    if (!trip) throw new BadRequestException('Viagem não encontrada');
    return trip;
  }
  private reservable(trip: typeof trips.$inferSelect) {
    if (!['scheduled', 'boarding'].includes(trip.status) || trip.scheduledDeparture <= new Date())
      throw new ConflictException('Reservas encerradas para esta viagem');
  }
  private async validateStop(tx: Transaction, routeId: string, stopId: string) {
    const [point] = await tx
      .select()
      .from(routeStops)
      .where(
        and(
          eq(routeStops.routeId, routeId),
          eq(routeStops.stopId, stopId),
          inArray(routeStops.kind, ['boarding', 'both']),
        ),
      );
    if (!point) throw new BadRequestException('Escolha um ponto de embarque desta rota');
  }
  private async counts(tx: Transaction, trip: typeof trips.$inferSelect) {
    const [vehicle] = await tx.select().from(vehicles).where(eq(vehicles.id, trip.vehicleId));
    const [used] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(reservations)
      .where(and(eq(reservations.tripId, trip.id), sql`${reservations.status}<>'cancelled'`));
    const [offers] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(waitlist)
      .where(
        and(
          eq(waitlist.tripId, trip.id),
          eq(waitlist.status, 'offered'),
          sql`${waitlist.offerExpiresAt}>now()`,
        ),
      );
    return { capacity: vehicle.capacity, used: used.n, offers: offers.n };
  }
  private async notify(
    tx: Transaction,
    userId: string,
    tripId: string,
    type: string,
    title: string,
    content: string,
  ) {
    await tx.insert(notifications).values({ userId, tripId, type, title, content });
  }
  private async promote(tx: Transaction, trip: typeof trips.$inferSelect) {
    const recipients: string[] = [];
    await tx
      .update(waitlist)
      .set({ status: 'expired' })
      .where(
        and(
          eq(waitlist.tripId, trip.id),
          eq(waitlist.status, 'offered'),
          sql`${waitlist.offerExpiresAt}<=now()`,
        ),
      );
    if (!['scheduled', 'boarding'].includes(trip.status) || trip.scheduledDeparture <= new Date())
      return recipients;
    const { capacity, used, offers: initialOffers } = await this.counts(tx, trip);
    let offers = initialOffers;
    const minutes = await this.config(tx, 'waitlist_offer_minutes', 15);
    while (used + offers < capacity) {
      const [next] = await tx
        .select()
        .from(waitlist)
        .where(and(eq(waitlist.tripId, trip.id), eq(waitlist.status, 'waiting')))
        .orderBy(asc(waitlist.position), asc(waitlist.createdAt))
        .limit(1)
        .for('update');
      if (!next) break;
      await tx
        .update(waitlist)
        .set({
          status: 'offered',
          offeredAt: new Date(),
          offerExpiresAt: new Date(
            Math.min(Date.now() + minutes * 60000, trip.scheduledDeparture.getTime()),
          ),
        })
        .where(eq(waitlist.id, next.id));
      await this.notify(
        tx,
        next.userId,
        trip.id,
        'waitlist:offered',
        'Uma vaga está disponível',
        `Confirme sua vaga em até ${minutes} minutos na área Reservas.`,
      );
      recipients.push(next.userId);
      offers++;
    }
    return recipients;
  }
  async reserve(user: Principal, input: { tripId: string; boardingStopId: string }) {
    if (user.role !== 'teacher')
      throw new ForbiddenException('Reservas são destinadas aos professores');
    const result = await this.db.transaction(async (tx) => {
      const trip = await this.lock(tx, input.tripId);
      this.reservable(trip);
      await this.validateStop(tx, trip.routeId, input.boardingStopId);
      await this.promote(tx, trip);
      const [existing] = await tx
        .select()
        .from(reservations)
        .where(
          and(
            eq(reservations.tripId, trip.id),
            eq(reservations.userId, user.id),
            sql`${reservations.status}<>'cancelled'`,
          ),
        );
      if (existing) throw new ConflictException('Você já possui uma reserva');
      const [queue] = await tx
        .select()
        .from(waitlist)
        .where(
          and(
            eq(waitlist.tripId, trip.id),
            eq(waitlist.userId, user.id),
            inArray(waitlist.status, ['waiting', 'offered']),
          ),
        );
      if (queue)
        throw new ConflictException(
          'Você já está na lista de espera. Confirme a oferta pela área Reservas.',
        );
      const c = await this.counts(tx, trip);
      if (c.used + c.offers >= c.capacity)
        throw new ConflictException('Van lotada. Entre na lista de espera.');
      const [r] = await tx
        .insert(reservations)
        .values({ ...input, userId: user.id })
        .returning();
      await this.notify(
        tx,
        user.id,
        trip.id,
        'reservation:created',
        'Reserva confirmada',
        'Sua vaga está garantida.',
      );
      return r;
    });
    this.events.trip(input.tripId, 'reservation:created', {});
    this.events.user(user.id, 'notification:new', {});
    return result;
  }
  async cancel(user: Principal, id: string) {
    const [found] = await this.db.select().from(reservations).where(eq(reservations.id, id));
    if (!found) throw new BadRequestException('Reserva não encontrada');
    if (user.role !== 'admin' && found.userId !== user.id) throw new ForbiddenException();
    const offered = await this.db.transaction(async (tx) => {
      const trip = await this.lock(tx, found.tripId);
      const [reservation] = await tx.select().from(reservations).where(eq(reservations.id, id));
      if (reservation.status !== 'confirmed')
        throw new ConflictException('Esta reserva não pode ser cancelada');
      const cutoff = await this.config(tx, 'cancellation_cutoff_minutes', 30);
      if (
        user.role !== 'admin' &&
        (!['scheduled', 'boarding'].includes(trip.status) ||
          trip.scheduledDeparture.getTime() - Date.now() < cutoff * 60000)
      )
        throw new ConflictException(`Cancelamento permitido até ${cutoff} minutos antes da saída`);
      await tx
        .update(reservations)
        .set({ status: 'cancelled', cancelledAt: new Date() })
        .where(eq(reservations.id, id));
      await this.notify(
        tx,
        found.userId,
        trip.id,
        'reservation:cancelled',
        'Reserva cancelada',
        'Sua vaga foi liberada.',
      );
      return this.promote(tx, trip);
    });
    for (const id of [found.userId, ...offered]) this.events.user(id, 'notification:new', {});
    this.events.leaveTrip(found.userId, found.tripId);
    this.events.trip(found.tripId, 'reservation:cancelled', {});
    return { ok: true };
  }
  async join(user: Principal, input: { tripId: string; boardingStopId: string }) {
    if (user.role !== 'teacher') throw new ForbiddenException();
    return this.db.transaction(async (tx) => {
      const trip = await this.lock(tx, input.tripId);
      this.reservable(trip);
      await this.validateStop(tx, trip.routeId, input.boardingStopId);
      await this.promote(tx, trip);
      const c = await this.counts(tx, trip);
      if (c.used + c.offers < c.capacity)
        throw new ConflictException('Há vagas disponíveis. Faça uma reserva.');
      const existing = await tx
        .select()
        .from(reservations)
        .where(
          and(
            eq(reservations.tripId, trip.id),
            eq(reservations.userId, user.id),
            sql`${reservations.status}<>'cancelled'`,
          ),
        );
      if (existing.length) throw new ConflictException('Você já tem uma reserva');
      const [max] = await tx
        .select({ n: sql<number>`coalesce(max(${waitlist.position}),0)::int` })
        .from(waitlist)
        .where(eq(waitlist.tripId, trip.id));
      return (
        await tx
          .insert(waitlist)
          .values({ ...input, userId: user.id, position: max.n + 1 })
          .returning()
      )[0];
    });
  }
  async accept(user: Principal, id: string) {
    const [offer] = await this.db
      .select()
      .from(waitlist)
      .where(and(eq(waitlist.id, id), eq(waitlist.userId, user.id)));
    if (!offer) throw new ForbiddenException();
    const result = await this.db.transaction(async (tx) => {
      const trip = await this.lock(tx, offer.tripId);
      this.reservable(trip);
      const [current] = await tx.select().from(waitlist).where(eq(waitlist.id, id));
      if (
        current.status !== 'offered' ||
        !current.offerExpiresAt ||
        current.offerExpiresAt <= new Date()
      )
        throw new ConflictException('Oferta expirada ou indisponível');
      await tx.update(waitlist).set({ status: 'accepted' }).where(eq(waitlist.id, id));
      const [r] = await tx
        .insert(reservations)
        .values({ tripId: trip.id, userId: user.id, boardingStopId: current.boardingStopId })
        .returning();
      await this.notify(
        tx,
        user.id,
        trip.id,
        'reservation:created',
        'Vaga confirmada',
        'A oferta se tornou uma reserva.',
      );
      return r;
    });
    this.events.trip(offer.tripId, 'reservation:created', {});
    this.events.user(user.id, 'notification:new', {});
    return result;
  }
  async leave(user: Principal, id: string) {
    const [entry] = await this.db
      .select()
      .from(waitlist)
      .where(and(eq(waitlist.id, id), eq(waitlist.userId, user.id)));
    if (!entry) throw new ForbiddenException();
    const offered = await this.db.transaction(async (tx) => {
      const trip = await this.lock(tx, entry.tripId);
      await tx
        .update(waitlist)
        .set({ status: 'cancelled' })
        .where(and(eq(waitlist.id, id), inArray(waitlist.status, ['waiting', 'offered'])));
      return this.promote(tx, trip);
    });
    for (const id of offered) this.events.user(id, 'notification:new', {});
    return { ok: true };
  }
  async attendance(user: Principal, id: string, target: 'boarded' | 'alighted') {
    const [r] = await this.db.select().from(reservations).where(eq(reservations.id, id));
    if (!r) throw new BadRequestException();
    return this.db.transaction(async (tx) => {
      const trip = await this.lock(tx, r.tripId);
      if (user.role !== 'admin' && (user.role !== 'driver' || trip.driverId !== user.id))
        throw new ForbiddenException();
      if (!['boarding', 'in_progress'].includes(trip.status))
        throw new ConflictException('Embarque indisponível neste estado');
      const [current] = await tx.select().from(reservations).where(eq(reservations.id, id));
      if (current.status !== (target === 'boarded' ? 'confirmed' : 'boarded'))
        throw new ConflictException('Estado de passageiro inválido');
      const [updated] = await tx
        .update(reservations)
        .set({
          status: target,
          ...(target === 'boarded' ? { boardedAt: new Date() } : { alightedAt: new Date() }),
        })
        .where(eq(reservations.id, id))
        .returning();
      return updated;
    });
  }
  @Cron('*/30 * * * * *') async processQueue() {
    const candidates = await this.db
      .select({ id: trips.id })
      .from(trips)
      .where(inArray(trips.status, ['scheduled', 'boarding']));
    for (const trip of candidates) {
      const offered = await this.db.transaction(async (tx) =>
        this.promote(tx, await this.lock(tx, trip.id)),
      );
      for (const id of offered) this.events.user(id, 'notification:new', {});
    }
  }
}
