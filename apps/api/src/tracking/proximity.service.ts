import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { trips, stops, routeStops, reservations, tripEvents } from '@vantrack/database';
import { haversine } from '@vantrack/shared';
import { DatabaseService } from '../common/database.service';
import { NotificationsService } from '../communication/notifications.service';
@Injectable()
export class ProximityService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {}
  async update(id: string, latitude: number, longitude: number, accuracy: number) {
    if (accuracy > 150) return;
    const alerts = await this.database.db.transaction(async (tx) => {
      const [trip] = await tx.select().from(trips).where(eq(trips.id, id)).for('update');
      if (!trip || trip.status !== 'in_progress') return [];
      const points = await tx
        .select({ point: stops })
        .from(routeStops)
        .innerJoin(stops, eq(stops.id, routeStops.stopId))
        .where(eq(routeStops.routeId, trip.routeId));
      const result: { userId: string; name: string }[] = [];
      for (const { point } of points) {
        if (haversine([latitude, longitude], [point.latitude, point.longitude]) > 500) continue;
        const eventType = `near_stop:${point.id}`;
        const seen = await tx
          .select({ id: tripEvents.id })
          .from(tripEvents)
          .where(and(eq(tripEvents.tripId, id), eq(tripEvents.eventType, eventType)))
          .limit(1);
        if (seen.length) continue;
        await tx
          .insert(tripEvents)
          .values({ tripId: id, eventType, description: `Van a até 500 m de ${point.name}` });
        const people = await tx
          .select({ userId: reservations.userId })
          .from(reservations)
          .where(
            and(
              eq(reservations.tripId, id),
              eq(reservations.boardingStopId, point.id),
              eq(reservations.status, 'confirmed'),
            ),
          );
        for (const p of people) result.push({ userId: p.userId, name: point.name });
      }
      return result;
    });
    for (const a of alerts)
      await this.notifications.send(
        a.userId,
        'vehicle:near_stop',
        'Sua van está próxima',
        `A van está a até 500 m de ${a.name}. Verifique o mapa e prepare-se para embarcar.`,
        id,
      );
  }
  async delay(id: string, minutes: number) {
    if (minutes < 5) return;
    const fresh = await this.database.db.transaction(async (tx) => {
      const [trip] = await tx.select().from(trips).where(eq(trips.id, id)).for('update');
      if (!trip || trip.status !== 'in_progress') return false;
      const seen = await tx
        .select({ id: tripEvents.id })
        .from(tripEvents)
        .where(and(eq(tripEvents.tripId, id), eq(tripEvents.eventType, 'eta:delay')))
        .limit(1);
      if (seen.length) return false;
      await tx.insert(tripEvents).values({
        tripId: id,
        eventType: 'eta:delay',
        description: `Estimativa de atraso: ${minutes} min. Sem dados de trânsito em tempo real.`,
      });
      return true;
    });
    if (fresh)
      await this.notifications.trip(
        id,
        'trip:delay',
        'Possível atraso na chegada',
        `A estimativa indica ${minutes} minutos após o horário previsto. Sem trânsito em tempo real.`,
      );
  }
}
