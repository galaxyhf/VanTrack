import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  users,
  vehicles,
  stops,
  routes,
  routeStops,
  trips,
  tripEvents,
  auditLogs,
  type Transaction,
} from '@vantrack/database';
import {
  vehicleSchema,
  routeSchema,
  stopSchema,
  tripSchema,
  canTransition,
  labels,
  type TripStatus,
} from '@vantrack/shared';
import type { Principal } from '../auth/auth.service';
import { DatabaseService } from '../common/database.service';
import { TripsRepository } from './trips.repository';
import { EventsService } from '../common/events.service';
import { NotificationsService } from '../communication/notifications.service';
@Injectable()
export class OperationsService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(TripsRepository) private readonly repository: TripsRepository,
    @Inject(EventsService) private readonly events: EventsService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {}
  private get db() {
    return this.database.db;
  }
  async audit(
    tx: Transaction,
    actor: Principal,
    action: string,
    entityType: string,
    entityId: string,
  ) {
    await tx.insert(auditLogs).values({ actorId: actor.id, action, entityType, entityId });
  }
  async vehicle(actor: Principal, data: z.infer<typeof vehicleSchema>, id?: string) {
    return this.db.transaction(async (tx) => {
      if (id) {
        await tx.select().from(vehicles).where(eq(vehicles.id, id)).for('update');
        const busy = await tx
          .select()
          .from(trips)
          .where(
            and(
              eq(trips.vehicleId, id),
              inArray(trips.status, ['scheduled', 'boarding', 'in_progress']),
            ),
          )
          .limit(1);
        if (busy.length)
          throw new ConflictException(
            'Reagende ou conclua as viagens antes de alterar este veículo',
          );
      }
      const [row] = id
        ? await tx.update(vehicles).set(data).where(eq(vehicles.id, id)).returning()
        : await tx.insert(vehicles).values(data).returning();
      if (!row) throw new BadRequestException('Veículo não encontrado');
      await this.audit(tx, actor, id ? 'update' : 'create', 'vehicle', row.id);
      return row;
    });
  }
  async deleteVehicle(actor: Principal, id: string) {
    return this.db.transaction(async (tx) => {
      await tx.delete(vehicles).where(eq(vehicles.id, id));
      await this.audit(tx, actor, 'delete', 'vehicle', id);
      return { ok: true };
    });
  }
  async remove(actor: Principal, kind: 'route' | 'stop', id: string) {
    return this.db.transaction(async (tx) => {
      await tx
        .delete(kind === 'route' ? routes : stops)
        .where(eq((kind === 'route' ? routes : stops).id, id));
      await this.audit(tx, actor, 'delete', kind, id);
      return { ok: true };
    });
  }
  async stop(actor: Principal, data: z.infer<typeof stopSchema>, id?: string) {
    return this.db.transaction(async (tx) => {
      if (id) {
        const linked = await tx.select().from(routeStops).where(eq(routeStops.stopId, id)).limit(1);
        if (linked.length)
          throw new ConflictException(
            'Ponto em uso: crie um novo ponto para preservar o itinerário',
          );
      }
      const [row] = id
        ? await tx.update(stops).set(data).where(eq(stops.id, id)).returning()
        : await tx.insert(stops).values(data).returning();
      if (!row) throw new BadRequestException('Ponto não encontrado');
      await this.audit(tx, actor, id ? 'update' : 'create', 'stop', row.id);
      return row;
    });
  }
  async route(actor: Principal, data: z.infer<typeof routeSchema>, id?: string) {
    return this.db.transaction(async (tx) => {
      if (new Set(data.stops.map((s) => s.stopId)).size !== data.stops.length)
        throw new BadRequestException('Pontos duplicados');
      if (id) {
        await tx.select().from(routes).where(eq(routes.id, id)).for('update');
        const linked = await tx.select().from(trips).where(eq(trips.routeId, id)).limit(1);
        if (linked.length)
          throw new ConflictException(
            'Rota em uso: crie uma nova versão para preservar o histórico',
          );
      }
      const { stops: points, ...values } = data;
      const [row] = id
        ? await tx
            .update(routes)
            .set({ ...values, geometry: null })
            .where(eq(routes.id, id))
            .returning()
        : await tx.insert(routes).values(values).returning();
      if (!row) throw new BadRequestException('Rota não encontrada');
      if (id) await tx.delete(routeStops).where(eq(routeStops.routeId, id));
      await tx
        .insert(routeStops)
        .values(points.map((p, i) => ({ ...p, routeId: row.id, stopOrder: i })));
      await this.audit(tx, actor, id ? 'update' : 'create', 'route', row.id);
      return row;
    });
  }
  async schedule(actor: Principal, data: z.infer<typeof tripSchema>, id?: string) {
    return this.db.transaction(async (tx) => {
      if (id) {
        const [old] = await tx.select().from(trips).where(eq(trips.id, id)).for('update');
        if (!old || old.status !== 'scheduled')
          throw new ConflictException('Somente viagens programadas podem ser editadas');
        if (old.isDemo !== data.isDemo)
          throw new BadRequestException('Não é permitido alterar o modo de demonstração');
        const existing = await tx.execute(
          sql`select 1 from reservations where trip_id=${id} and status<>'cancelled' union all select 1 from waitlist where trip_id=${id} and status in ('waiting','offered')`,
        );
        if (existing.rows.length)
          throw new ConflictException('Cancele as reservas antes de reatribuir a viagem');
      }
      const [vehicle] = await tx
        .select()
        .from(vehicles)
        .where(eq(vehicles.id, data.vehicleId))
        .for('update');
      const [driver] = await tx
        .select()
        .from(users)
        .where(eq(users.id, data.driverId))
        .for('update');
      const [route] = await tx
        .select()
        .from(routes)
        .where(eq(routes.id, data.routeId))
        .for('update');
      if (
        !vehicle ||
        !['available', 'in_operation'].includes(vehicle.status) ||
        !driver?.isActive ||
        driver.role !== 'driver' ||
        !route?.isActive
      )
        throw new BadRequestException('Veículo, motorista ou rota indisponível');
      const conflicts = await tx.execute(
        sql`select id from trips where status not in ('cancelled','completed') and (vehicle_id=${data.vehicleId} or driver_id=${data.driverId}) and scheduled_departure < ${data.scheduledArrival}::timestamptz and scheduled_arrival > ${data.scheduledDeparture}::timestamptz ${id ? sql`and id<>${id}` : sql``}`,
      );
      if (conflicts.rows.length)
        throw new ConflictException('Motorista ou veículo já possui viagem neste horário');
      const values = {
        ...data,
        scheduledDeparture: new Date(data.scheduledDeparture),
        scheduledArrival: new Date(data.scheduledArrival),
      };
      const [row] = id
        ? await tx.update(trips).set(values).where(eq(trips.id, id)).returning()
        : await tx.insert(trips).values(values).returning();
      await this.audit(tx, actor, id ? 'reschedule' : 'schedule', 'trip', row.id);
      return row;
    });
  }
  async transition(actor: Principal, id: string, target: TripStatus) {
    const recipients = await this.repository.participants(id);
    const row = await this.db.transaction(async (tx) => {
      const [trip] = await tx.select().from(trips).where(eq(trips.id, id)).for('update');
      if (!trip) throw new BadRequestException('Viagem não encontrada');
      if (actor.role !== 'admin' && (actor.role !== 'driver' || trip.driverId !== actor.id))
        throw new ForbiddenException();
      if (!canTransition(trip.status, target))
        throw new ConflictException('Transição de viagem inválida');
      if (target === 'in_progress') {
        await tx.select().from(vehicles).where(eq(vehicles.id, trip.vehicleId)).for('update');
        await tx.select().from(users).where(eq(users.id, trip.driverId)).for('update');
        const active = await tx
          .select()
          .from(trips)
          .where(
            and(
              eq(trips.status, 'in_progress'),
              sql`${trips.id} <> ${id}`,
              sql`(${trips.vehicleId}=${trip.vehicleId} or ${trips.driverId}=${trip.driverId})`,
            ),
          );
        if (active.length) throw new ConflictException('Motorista ou veículo ainda está em viagem');
        await tx
          .update(vehicles)
          .set({ status: 'in_operation' })
          .where(eq(vehicles.id, trip.vehicleId));
      }
      if (target === 'completed')
        await tx
          .update(vehicles)
          .set({ status: 'available' })
          .where(eq(vehicles.id, trip.vehicleId));
      if (target === 'cancelled') {
        await tx.execute(
          sql`update reservations set status='cancelled',cancelled_at=now() where trip_id=${id} and status='confirmed'`,
        );
        await tx.execute(
          sql`update waitlist set status='cancelled' where trip_id=${id} and status in ('waiting','offered')`,
        );
      }
      const [updated] = await tx
        .update(trips)
        .set({
          status: target,
          ...(target === 'in_progress' ? { actualDeparture: new Date() } : {}),
          ...(target === 'completed' ? { actualArrival: new Date(), trackingPaused: true } : {}),
          ...(target === 'cancelled' ? { trackingPaused: true } : {}),
        })
        .where(eq(trips.id, id))
        .returning();
      await tx.insert(tripEvents).values({
        tripId: id,
        eventType: `trip:${target}`,
        description: `Estado: ${labels[target]}`,
      });
      await this.audit(tx, actor, target, 'trip', id);
      return updated;
    });
    this.events.trip(
      id,
      target === 'in_progress'
        ? 'trip:started'
        : target === 'completed'
          ? 'trip:finished'
          : `trip:${target}`,
      row,
    );
    for (const recipient of recipients)
      await this.notifications.send(
        recipient,
        `trip:${target}`,
        'Viagem atualizada',
        `Novo estado: ${labels[target]}`,
        id,
      );
    return row;
  }
  async delay(actor: Principal, id: string, minutes: number, description: string) {
    await this.repository.authorize(actor, id);
    const trip = await this.repository.trip(id);
    if (actor.role === 'teacher' || trip.status !== 'in_progress') throw new ForbiddenException();
    await this.db.insert(tripEvents).values({
      tripId: id,
      eventType: 'trip:delay',
      description: `${minutes} min: ${description}`,
    });
    this.events.trip(id, 'trip:delay', { minutes, description });
    await this.notifications.trip(
      id,
      'trip:delay',
      `Atraso informado: ${minutes} min`,
      description,
    );
    return { ok: true };
  }
}
