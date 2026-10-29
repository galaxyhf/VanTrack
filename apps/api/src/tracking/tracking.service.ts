import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { eq, lt, sql } from 'drizzle-orm';
import { trips, vehicleLocations, settings, tripEvents } from '@vantrack/database';
import { haversine, locationSchema, type LocationInput } from '@vantrack/shared';
import type { Principal } from '../auth/auth.service';
import { DatabaseService } from '../common/database.service';
import { EventsService } from '../common/events.service';
import { TripsRepository } from '../operations/trips.repository';
import { ProximityService } from './proximity.service';
import { EtaService } from './eta.service';
import { parse } from '../common/validation';
@Injectable()
export class TrackingService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(TripsRepository) private readonly repository: TripsRepository,
    @Inject(EventsService) private readonly events: EventsService,
    @Inject(EtaService) private readonly eta: EtaService,
    @Inject(ProximityService) private readonly proximity: ProximityService,
  ) {}
  async consent(user: Principal, id: string, enabled: boolean) {
    return this.database.db.transaction(async (tx) => {
      const [trip] = await tx.select().from(trips).where(eq(trips.id, id)).for('update');
      if (
        !trip ||
        trip.driverId !== user.id ||
        user.role !== 'driver' ||
        trip.status !== 'in_progress'
      )
        throw new ForbiddenException(
          'Apenas o motorista desta viagem em andamento pode compartilhar',
        );
      if (trip.isDemo) throw new BadRequestException('Use o simulador na viagem de demonstração');
      await tx
        .update(trips)
        .set({ trackingPaused: !enabled, ...(enabled ? { trackingConsentAt: new Date() } : {}) })
        .where(eq(trips.id, id));
      await tx.insert(tripEvents).values({
        tripId: id,
        eventType: enabled ? 'tracking:consent' : 'tracking:paused',
        description: enabled
          ? 'Motorista autorizou o rastreamento'
          : 'Compartilhamento interrompido',
      });
      if (!enabled) this.events.trip(id, 'vehicle:offline', { tripId: id });
      return { enabled };
    });
  }
  async record(user: Principal, input: LocationInput, simulated = false) {
    const data = parse(locationSchema, input);
    const time = new Date(data.recordedAt);
    if (time.getTime() > Date.now() + 5000 || time.getTime() < Date.now() - 120000)
      throw new BadRequestException('Localização fora da janela de 2 minutos');
    const result = await this.database.db.transaction(async (tx) => {
      const [trip] = await tx.select().from(trips).where(eq(trips.id, data.tripId)).for('update');
      if (!trip || trip.status !== 'in_progress')
        throw new ForbiddenException('Rastreamento disponível somente durante a viagem');
      if (simulated) {
        if (
          !trip.isDemo ||
          !['admin', 'driver'].includes(user.role) ||
          (user.role === 'driver' && trip.driverId !== user.id)
        )
          throw new ForbiddenException();
      } else if (
        user.role !== 'driver' ||
        trip.driverId !== user.id ||
        trip.isDemo ||
        trip.trackingPaused ||
        !trip.trackingConsentAt
      )
        throw new ForbiddenException('Compartilhamento não autorizado');
      const [last] = await tx
        .select()
        .from(vehicleLocations)
        .where(eq(vehicleLocations.tripId, trip.id))
        .orderBy(sql`${vehicleLocations.recordedAt} desc`)
        .limit(1);
      if (last && time <= last.recordedAt)
        throw new BadRequestException('Atualização antiga ou duplicada');
      if (last) {
        const elapsed = (time.getTime() - last.recordedAt.getTime()) / 1000;
        const distance = haversine(
          [last.latitude, last.longitude],
          [data.latitude, data.longitude],
        );
        if (elapsed < 5) return { accepted: false };
        if (!simulated && distance / elapsed > 70)
          throw new BadRequestException('Deslocamento incompatível com transporte terrestre');
        if (distance < 10 && elapsed < 25) return { accepted: false };
      }
      if (simulated)
        await tx.update(trips).set({ trackingPaused: false }).where(eq(trips.id, trip.id));
      const [location] = await tx
        .insert(vehicleLocations)
        .values({ ...data, recordedAt: time, isSimulated: simulated })
        .returning();
      return { accepted: true, location };
    });
    if (result.accepted && 'location' in result) {
      this.events.trip(data.tripId, 'vehicle:location', result.location);
      const estimate = await this.eta.calculate(data.tripId);
      this.events.trip(data.tripId, 'trip:eta_updated', estimate);
      await this.proximity.update(data.tripId, data.latitude, data.longitude, data.accuracy);
      if (
        estimate.available &&
        'delayMinutes' in estimate &&
        estimate.delayMinutes &&
        !estimate.stale
      )
        await this.proximity.delay(data.tripId, estimate.delayMinutes);
    }
    return result;
  }
  @Cron('0 0 * * * *') async retention() {
    const [s] = await this.database.db
      .select()
      .from(settings)
      .where(eq(settings.key, 'location_retention_days'));
    await this.database.db
      .delete(vehicleLocations)
      .where(lt(vehicleLocations.recordedAt, new Date(Date.now() - (s?.value ?? 30) * 86400000)));
  }
  @Cron('*/15 * * * * *') async stale() {
    const rows = await this.database.db.execute(
      sql`select t.id from trips t left join lateral (select recorded_at from vehicle_locations where trip_id=t.id order by recorded_at desc limit 1) l on true where t.status='in_progress' and (t.tracking_paused or l.recorded_at is null or l.recorded_at < now()-interval '30 seconds')`,
    );
    for (const r of rows.rows) this.events.trip(String(r.id), 'vehicle:offline', { tripId: r.id });
  }
}
