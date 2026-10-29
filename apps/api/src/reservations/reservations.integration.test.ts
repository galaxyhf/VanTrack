import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { drizzle } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import * as schema from '@vantrack/database';
import type { Database } from '@vantrack/database';
import { eq } from 'drizzle-orm';
import {
  users,
  vehicles,
  stops,
  routes,
  routeStops,
  trips,
  reservations,
  waitlist,
} from '@vantrack/database';
import { ReservationsService } from './reservations.service';
import { OperationsService } from '../operations/operations.service';
import { TripsRepository } from '../operations/trips.repository';
import { EventsService } from '../common/events.service';
import { NotificationsService } from '../communication/notifications.service';
import type { DatabaseService } from '../common/database.service';
import type { Principal } from '../auth/auth.service';
let connection: { db: Database; pool: { end(): Promise<void> } },
  service: ReservationsService,
  operations: OperationsService,
  repo: TripsRepository;
let admin: Principal,
  driver: Principal,
  a: Principal,
  b: Principal,
  c: Principal,
  tripId: string,
  stopId: string;
const principal = (u: typeof users.$inferSelect): Principal => ({
  id: u.id,
  name: u.name,
  email: u.email,
  phone: null,
  avatarUrl: null,
  role: u.role,
  sessionId: crypto.randomUUID(),
});
beforeAll(async () => {
  const client = new PGlite();
  const testDb = drizzle(client, { schema });
  connection = { db: testDb as unknown as Database, pool: { end: () => client.close() } };
  const db = connection.db;
  await migrate(testDb, {
    migrationsFolder: 'packages/database/migrations',
  });
  const database = { db } as DatabaseService;
  const events = new EventsService();
  repo = new TripsRepository(database);
  service = new ReservationsService(database, events);
  operations = new OperationsService(
    database,
    repo,
    events,
    new NotificationsService(database, events, repo),
  );
  const people = await db
    .insert(users)
    .values(
      ['admin', 'driver', 'teacher', 'teacher', 'teacher'].map((role, i) => ({
        name: `Test ${i}`,
        email: `u${i}@test.local`,
        passwordHash: 'test-only',
        role: role as 'admin' | 'driver' | 'teacher',
      })),
    )
    .returning();
  [admin, driver, a, b, c] = people.map(principal);
  const [vehicle] = await db
    .insert(vehicles)
    .values({
      plate: 'TST1A01',
      model: 'Teste',
      manufacturer: 'Teste',
      year: 2024,
      color: 'Branco',
      capacity: 1,
      internalCode: 'TEST',
    })
    .returning();
  const [stop] = await db
    .insert(stops)
    .values({ name: 'Demo', address: 'Ponto de teste', latitude: 0, longitude: 0 })
    .returning();
  stopId = stop.id;
  const [route] = await db
    .insert(routes)
    .values({
      name: 'Rota de teste',
      origin: 'A',
      destination: 'B',
      direction: 'outbound',
      estimatedDistance: 1000,
      estimatedDuration: 300,
    })
    .returning();
  await db.insert(routeStops).values({
    routeId: route.id,
    stopId,
    stopOrder: 0,
    estimatedOffsetMinutes: 0,
    kind: 'boarding',
  });
  const [trip] = await db
    .insert(trips)
    .values({
      routeId: route.id,
      vehicleId: vehicle.id,
      driverId: driver.id,
      scheduledDeparture: new Date(Date.now() + 86400000),
      scheduledArrival: new Date(Date.now() + 90000000),
      isDemo: true,
    })
    .returning();
  tripId = trip.id;
});
afterAll(async () => connection?.pool.end());
describe('transações reais PostgreSQL embarcado', () => {
  it('duas reservas simultâneas na última vaga produzem uma confirmação', async () => {
    const result = await Promise.allSettled([
      service.reserve(a, { tripId, boardingStopId: stopId }),
      service.reserve(b, { tripId, boardingStopId: stopId }),
    ]);
    expect(result.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rows = await connection.db
      .select()
      .from(reservations)
      .where(eq(reservations.tripId, tripId));
    expect(rows).toHaveLength(1);
  });
  it('impede duplicação, ponto inválido e acesso à localização sem vínculo', async () => {
    const [r] = await connection.db
      .select()
      .from(reservations)
      .where(eq(reservations.tripId, tripId));
    const owner = r.userId === a.id ? a : b;
    const other = owner.id === a.id ? b : a;
    await expect(service.reserve(owner, { tripId, boardingStopId: stopId })).rejects.toThrow();
    await expect(
      service.reserve(c, { tripId, boardingStopId: crypto.randomUUID() }),
    ).rejects.toThrow();
    await expect(repo.authorize(other, tripId)).rejects.toThrow();
    await expect(repo.authorize(driver, tripId)).resolves.toBeTruthy();
  });
  it('libera vaga para a fila por ordem, reserva oferta e confirma sem exceder capacidade', async () => {
    const [r] = await connection.db
      .select()
      .from(reservations)
      .where(eq(reservations.tripId, tripId));
    const owner = r.userId === a.id ? a : b,
      other = owner.id === a.id ? b : a;
    const offer = await service.join(other, { tripId, boardingStopId: stopId });
    await service.join(c, { tripId, boardingStopId: stopId });
    await service.cancel(owner, r.id);
    const [queued] = await connection.db.select().from(waitlist).where(eq(waitlist.id, offer.id));
    expect(queued.status).toBe('offered');
    await expect(service.reserve(owner, { tripId, boardingStopId: stopId })).rejects.toThrow();
    await service.accept(other, offer.id);
    const active = (
      await connection.db.select().from(reservations).where(eq(reservations.tripId, tripId))
    ).filter((r) => r.status !== 'cancelled');
    expect(active).toHaveLength(1);
    expect(active[0].userId).toBe(other.id);
    await expect(service.accept(other, offer.id)).rejects.toThrow();
  });
  it('expira uma oferta e promove o próximo professor', async () => {
    const active = (
      await connection.db.select().from(reservations).where(eq(reservations.tripId, tripId))
    ).find((r) => r.status === 'confirmed')!;
    await service.cancel(admin, active.id);
    const [first] = await connection.db.select().from(waitlist).where(eq(waitlist.userId, c.id));
    expect(first.status).toBe('offered');
    await connection.db
      .update(waitlist)
      .set({ offerExpiresAt: new Date(Date.now() - 1000) })
      .where(eq(waitlist.id, first.id));
    await service.processQueue();
    const [expired] = await connection.db.select().from(waitlist).where(eq(waitlist.id, first.id));
    expect(expired.status).toBe('expired');
  });
  it('valida autorização e transições; não aceita reservas em viagem encerrada', async () => {
    await expect(operations.transition(a, tripId, 'boarding')).rejects.toThrow();
    await expect(operations.transition(driver, tripId, 'in_progress')).rejects.toThrow();
    await operations.transition(driver, tripId, 'boarding');
    await operations.transition(driver, tripId, 'in_progress');
    await expect(service.reserve(c, { tripId, boardingStopId: stopId })).rejects.toThrow();
    await operations.transition(driver, tripId, 'completed');
    await expect(operations.transition(driver, tripId, 'boarding')).rejects.toThrow();
  });
  it('impede conflito de veículo/motorista durante o agendamento', async () => {
    const trip = await repo.trip(tripId);
    const input = {
      routeId: trip.routeId,
      vehicleId: trip.vehicleId,
      driverId: trip.driverId,
      scheduledDeparture: new Date(Date.now() + 2 * 86400000).toISOString(),
      scheduledArrival: new Date(Date.now() + 2 * 86400000 + 7200000).toISOString(),
      isDemo: true,
    };
    await operations.schedule(admin, input);
    await expect(operations.schedule(admin, input)).rejects.toThrow('já possui viagem');
  });
});
