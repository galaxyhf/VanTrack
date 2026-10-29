import { config } from 'dotenv';
import { eq, sql } from 'drizzle-orm';
import * as argon2 from 'argon2';
import {
  createDatabase,
  users,
  vehicles,
  routes,
  routeStops,
  stops,
  trips,
  reservations,
  notifications,
  messages,
  settings,
  vehicleLocations,
} from './index';
config({ path: '../../.env', quiet: true });
async function main() {
  if (process.env.NODE_ENV === 'production' || process.env.SEED_DEMO !== 'true')
    throw new Error('Seed somente em desenvolvimento com SEED_DEMO=true');
  const password = process.env.DEMO_PASSWORD;
  if (!password || password.length < 9)
    throw new Error('Configure DEMO_PASSWORD com pelo menos 9 caracteres');
  const { db, pool } = createDatabase(process.env.DATABASE_URL!);
  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(883322)`);
      if ((await tx.select().from(users).where(eq(users.email, 'admin@vantrack.demo'))).length) {
        console.log('Seed já existe; nenhum dado alterado.');
        return;
      }
      const hash = await argon2.hash(password);
      const people = [
        { name: 'Caio · Administrador', email: 'admin@vantrack.demo', role: 'admin' as const },
        { name: 'Marcos Oliveira', email: 'motorista@vantrack.demo', role: 'driver' as const },
        { name: 'Ana Rodrigues', email: 'motorista2@vantrack.demo', role: 'driver' as const },
        ...[
          'Julia Almeida',
          'Pedro Santos',
          'Mariana Costa',
          'Lucas Pereira',
          'Beatriz Souza',
          'Rafael Lima',
          'Camila Rocha',
          'Bruno Martins',
          'Laura Ferreira',
          'Gabriel Alves',
        ].map((name, i) => ({
          name,
          email: i === 0 ? 'professor@vantrack.demo' : `professor${i + 1}@vantrack.demo`,
          role: 'teacher' as const,
        })),
      ];
      const inserted = await tx
        .insert(users)
        .values(people.map((p) => ({ ...p, passwordHash: hash })))
        .returning();
      const fleet = await tx
        .insert(vehicles)
        .values([
          {
            plate: 'DEM1A01',
            model: 'Sprinter 416',
            manufacturer: 'Mercedes-Benz',
            year: 2024,
            color: 'Branco',
            capacity: 16,
            internalCode: 'VT-01',
          },
          {
            plate: 'DEM1A02',
            model: 'Master',
            manufacturer: 'Renault',
            year: 2023,
            color: 'Prata',
            capacity: 15,
            internalCode: 'VT-02',
          },
          {
            plate: 'DEM1A03',
            model: 'Transit',
            manufacturer: 'Ford',
            year: 2024,
            color: 'Branco',
            capacity: 16,
            internalCode: 'VT-03',
          },
        ])
        .returning();
      const points = await tx
        .insert(stops)
        .values([
          {
            name: 'Rio · Ponto demonstrativo',
            address: 'Coordenada ilustrativa na cidade do Rio. Não é ponto oficial.',
            latitude: -22.9068,
            longitude: -43.1729,
            isDemo: true,
          },
          {
            name: 'Guapimirim · Ponto demonstrativo',
            address: 'Coordenada ilustrativa. Não é ponto oficial.',
            latitude: -22.5369,
            longitude: -42.9812,
            isDemo: true,
          },
          {
            name: 'Teresópolis · Ponto demonstrativo',
            address: 'Coordenada ilustrativa no município. Não é ponto oficial.',
            latitude: -22.4122,
            longitude: -42.9656,
            isDemo: true,
          },
        ])
        .returning();
      const paths = await tx
        .insert(routes)
        .values([
          {
            name: 'Rio → Teresópolis',
            origin: 'Rio de Janeiro',
            destination: 'Teresópolis',
            direction: 'outbound',
            estimatedDistance: 96000,
            estimatedDuration: 7200,
          },
          {
            name: 'Teresópolis → Rio',
            origin: 'Teresópolis',
            destination: 'Rio de Janeiro',
            direction: 'inbound',
            estimatedDistance: 96000,
            estimatedDuration: 7200,
          },
        ])
        .returning();
      for (let d = 0; d < 2; d++)
        await tx.insert(routeStops).values(
          (d ? [...points].reverse() : points).map((p, i) => ({
            routeId: paths[d].id,
            stopId: p.id,
            stopOrder: i,
            estimatedOffsetMinutes: i * 60,
            kind: i === 2 ? 'alighting' : 'boarding',
          })),
        );
      const now = new Date();
      const scheduled = await tx
        .insert(trips)
        .values(
          Array.from({ length: 10 }, (_, i) => {
            const departure = new Date(now.getTime() + (i + 2) * 3 * 3600000);
            return {
              routeId: paths[i % 2].id,
              vehicleId: fleet[i % 3].id,
              driverId: inserted[1 + (i % 2)].id,
              scheduledDeparture: departure,
              scheduledArrival: new Date(departure.getTime() + 2 * 3600000),
              isDemo: true,
            };
          }),
        )
        .returning();
      for (const [i, trip] of scheduled.entries()) {
        const count = i === 0 ? 8 : 3;
        for (let k = 0; k < count; k++)
          await tx.insert(reservations).values({
            tripId: trip.id,
            userId: inserted[3 + k].id,
            boardingStopId: i % 2 ? points[2].id : points[0].id,
          });
      }
      const [active] = await tx
        .insert(trips)
        .values({
          routeId: paths[1].id,
          vehicleId: fleet[2].id,
          driverId: inserted[1].id,
          scheduledDeparture: new Date(now.getTime() - 30 * 60000),
          scheduledArrival: new Date(now.getTime() + 90 * 60000),
          actualDeparture: new Date(now.getTime() - 25 * 60000),
          status: 'in_progress',
          isDemo: true,
          trackingPaused: true,
        })
        .returning();
      await tx.update(vehicles).set({ status: 'in_operation' }).where(eq(vehicles.id, fleet[2].id));
      await tx
        .insert(reservations)
        .values(
          inserted
            .slice(3, 11)
            .map((u) => ({ tripId: active.id, userId: u.id, boardingStopId: points[2].id })),
        );
      await tx.insert(vehicleLocations).values({
        tripId: active.id,
        latitude: -22.466,
        longitude: -42.986,
        accuracy: 8,
        speed: 0,
        recordedAt: new Date(now.getTime() - 5 * 60000),
        isSimulated: true,
      });
      await tx.insert(messages).values({
        tripId: active.id,
        senderId: inserted[1].id,
        content: 'Bem-vindos! Esta é uma viagem de demonstração do VanTrack.',
        operational: true,
      });
      await tx.insert(notifications).values({
        userId: inserted[3].id,
        tripId: active.id,
        type: 'reservation:created',
        title: 'Sua viagem está pronta',
        content: 'Acompanhe a viagem demonstrativa no mapa.',
      });
      for (let d = 1; d <= 7; d++) {
        const departure = new Date(now.getTime() - d * 86400000);
        await tx.insert(trips).values({
          routeId: paths[d % 2].id,
          vehicleId: fleet[d % 3].id,
          driverId: inserted[1 + (d % 2)].id,
          scheduledDeparture: departure,
          scheduledArrival: new Date(departure.getTime() + 7200000),
          actualDeparture: departure,
          actualArrival: new Date(departure.getTime() + 7500000),
          status: 'completed',
          isDemo: true,
        });
      }
      await tx
        .insert(settings)
        .values([
          { key: 'cancellation_cutoff_minutes', value: 30 },
          { key: 'waitlist_offer_minutes', value: 15 },
          { key: 'location_retention_days', value: 30 },
        ])
        .onConflictDoNothing();
      console.log('Seed concluído: 13 usuários, 3 veículos, 2 rotas e viagens demonstrativas.');
    });
  } finally {
    await pool.end();
  }
}
main().catch((e) => {
  console.error('Falha no seed:', e instanceof Error ? e.message : 'erro');
  process.exitCode = 1;
});
