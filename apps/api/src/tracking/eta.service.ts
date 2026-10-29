import { Inject, Injectable } from '@nestjs/common';
import { eq, asc } from 'drizzle-orm';
import { routes, routeStops, stops } from '@vantrack/database';
import { estimateArrival, haversine } from '@vantrack/shared';
import { TripsRepository } from '../operations/trips.repository';
import { RoutingService } from './routing.service';
import { DatabaseService } from '../common/database.service';
@Injectable()
export class EtaService {
  constructor(
    @Inject(TripsRepository) private readonly trips: TripsRepository,
    @Inject(RoutingService) private readonly routing: RoutingService,
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}
  async calculate(id: string) {
    const trip = await this.trips.trip(id);
    const location = await this.trips.latest(id);
    if (!location)
      return {
        available: false,
        reason: 'Aguardando localização do motorista',
        trafficAware: false,
      };
    const points = await this.database.db
      .select({ point: stops })
      .from(routeStops)
      .innerJoin(stops, eq(stops.id, routeStops.stopId))
      .where(eq(routeStops.routeId, trip.routeId))
      .orderBy(asc(routeStops.stopOrder));
    const coordinates = points.map(
      (p) => [p.point.latitude, p.point.longitude] as [number, number],
    );
    if (coordinates.length < 2)
      return { available: false, reason: 'Configure os pontos da rota', trafficAware: false };
    const current: [number, number] = [location.latitude, location.longitude];
    let nearest = 0;
    for (let i = 1; i < coordinates.length; i++)
      if (haversine(current, coordinates[i]) < haversine(current, coordinates[nearest]))
        nearest = i;
    const remaining = coordinates.slice(Math.min(nearest + 1, coordinates.length - 1));
    const route = await this.routing.route([current, ...remaining]);
    return {
      available: true,
      ...estimateArrival(
        route.distance,
        route.duration,
        Math.max(0, remaining.length - 1),
        trip.scheduledArrival,
      ),
      updatedAt: location.recordedAt,
      isSimulated: location.isSimulated,
      stale: trip.trackingPaused || Date.now() - location.recordedAt.getTime() > 30000,
      source: route.source,
    };
  }
  async geometry(routeId: string) {
    const [route] = await this.database.db.select().from(routes).where(eq(routes.id, routeId));
    if (route.geometry) return { geometry: route.geometry, source: 'osrm' as const };
    const points = await this.database.db
      .select({ point: stops })
      .from(routeStops)
      .innerJoin(stops, eq(stops.id, routeStops.stopId))
      .where(eq(routeStops.routeId, routeId))
      .orderBy(asc(routeStops.stopOrder));
    const result = await this.routing.route(
      points.map((p) => [p.point.latitude, p.point.longitude]),
    );
    if (result.source === 'osrm')
      await this.database.db
        .update(routes)
        .set({ geometry: result.geometry })
        .where(eq(routes.id, routeId));
    return result;
  }
}
