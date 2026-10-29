import { Inject, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { and, asc, desc, eq, inArray, sql, or, gte, lte } from 'drizzle-orm';
import {
  trips,
  routes,
  vehicles,
  users,
  reservations,
  routeStops,
  stops,
  vehicleLocations,
  waitlist,
} from '@vantrack/database';
import { DatabaseService } from '../common/database.service';
import type { Principal } from '../auth/auth.service';
import { pageInfo } from '../common/validation';
@Injectable()
export class TripsRepository {
  constructor(@Inject(DatabaseService) readonly database: DatabaseService) {}
  async list(user: Principal, query: unknown) {
    const p = pageInfo(query);
    const participantsOnly = !!(
      query &&
      typeof query === 'object' &&
      'participantsOnly' in query &&
      (query as { participantsOnly: string }).participantsOnly === 'true'
    );
    const access =
      user.role === 'admin'
        ? undefined
        : user.role === 'driver'
          ? eq(trips.driverId, user.id)
          : or(
              participantsOnly ? undefined : inArray(trips.status, ['scheduled', 'boarding']),
              sql`exists(select 1 from reservations r where r.trip_id=${trips.id} and r.user_id=${user.id} and r.status<>'cancelled')`,
            );
    const conditions = and(
      access,
      p.from ? gte(trips.scheduledDeparture, new Date(p.from)) : undefined,
      p.to ? lte(trips.scheduledDeparture, new Date(p.to)) : undefined,
      p.vehicleId ? eq(trips.vehicleId, p.vehicleId) : undefined,
      p.routeId ? eq(trips.routeId, p.routeId) : undefined,
      p.driverId ? eq(trips.driverId, p.driverId) : undefined,
      p.search
        ? sql`(${routes.name} ilike ${'%' + p.search + '%'} or ${vehicles.plate} ilike ${'%' + p.search + '%'})`
        : undefined,
    );
    const data = await this.database.db
      .select({
        trip: trips,
        route: routes,
        vehicle: vehicles,
        driver: { id: users.id, name: users.name },
        occupied: sql<number>`(select count(*)::int from reservations r where r.trip_id=${trips.id} and r.status <> 'cancelled')`,
        offers: sql<number>`(select count(*)::int from waitlist w where w.trip_id=${trips.id} and w.status='offered' and w.offer_expires_at > now())`,
      })
      .from(trips)
      .innerJoin(routes, eq(routes.id, trips.routeId))
      .innerJoin(vehicles, eq(vehicles.id, trips.vehicleId))
      .innerJoin(users, eq(users.id, trips.driverId))
      .where(conditions)
      .orderBy(desc(trips.scheduledDeparture))
      .limit(p.limit)
      .offset(p.offset);
    return {
      data: data.map((r) => ({
        ...r.trip,
        route: r.route,
        vehicle: r.vehicle,
        driver: r.driver,
        occupied: r.occupied,
        available: Math.max(0, r.vehicle.capacity - r.occupied - r.offers),
      })),
      page: p.page,
      limit: p.limit,
    };
  }
  async trip(id: string) {
    const [trip] = await this.database.db.select().from(trips).where(eq(trips.id, id));
    if (!trip) throw new NotFoundException('Viagem não encontrada');
    return trip;
  }
  async authorize(user: Principal, id: string, sensitive = true) {
    const trip = await this.trip(id);
    if (user.role === 'admin' || (user.role === 'driver' && trip.driverId === user.id)) return trip;
    if (user.role === 'teacher') {
      const [r] = await this.database.db
        .select()
        .from(reservations)
        .where(
          and(
            eq(reservations.tripId, id),
            eq(reservations.userId, user.id),
            sql`${reservations.status} <> 'cancelled'`,
          ),
        );
      if (r) return trip;
      if (!sensitive && ['scheduled', 'boarding'].includes(trip.status)) return trip;
    }
    throw new ForbiddenException('Você não participa desta viagem');
  }
  async detail(user: Principal, id: string) {
    const trip = await this.authorize(user, id, false);
    const db = this.database.db;
    const [route] = await db.select().from(routes).where(eq(routes.id, trip.routeId));
    const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, trip.vehicleId));
    const [driver] = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.id, trip.driverId));
    const points = await db
      .select({
        point: stops,
        order: routeStops.stopOrder,
        offset: routeStops.estimatedOffsetMinutes,
        kind: routeStops.kind,
      })
      .from(routeStops)
      .innerJoin(stops, eq(stops.id, routeStops.stopId))
      .where(eq(routeStops.routeId, trip.routeId))
      .orderBy(asc(routeStops.stopOrder));
    const rs = await db
      .select({ reservation: reservations, name: users.name })
      .from(reservations)
      .innerJoin(users, eq(users.id, reservations.userId))
      .where(and(eq(reservations.tripId, id), sql`${reservations.status} <> 'cancelled'`));
    const [offer] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(waitlist)
      .where(
        and(
          eq(waitlist.tripId, id),
          eq(waitlist.status, 'offered'),
          sql`${waitlist.offerExpiresAt}>now()`,
        ),
      );
    return {
      ...trip,
      route,
      vehicle,
      driver,
      stops: points.map((p) => ({ ...p.point, order: p.order, offset: p.offset, kind: p.kind })),
      occupied: rs.length,
      available: Math.max(0, vehicle.capacity - rs.length - offer.n),
      passengers:
        user.role === 'teacher' ? [] : rs.map((r) => ({ ...r.reservation, name: r.name })),
      myReservation: rs.find((r) => r.reservation.userId === user.id)?.reservation ?? null,
    };
  }
  async participants(tripId: string) {
    const trip = await this.trip(tripId);
    const rs = await this.database.db
      .select({ id: reservations.userId })
      .from(reservations)
      .where(and(eq(reservations.tripId, tripId), sql`${reservations.status}<>'cancelled'`));
    return [...new Set([trip.driverId, ...rs.map((r) => r.id)])];
  }
  async latest(id: string) {
    const [location] = await this.database.db
      .select()
      .from(vehicleLocations)
      .where(eq(vehicleLocations.tripId, id))
      .orderBy(desc(vehicleLocations.recordedAt))
      .limit(1);
    return location ?? null;
  }
}
