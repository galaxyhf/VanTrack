import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { drizzle as embeddedDrizzle } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import * as schema from './schema';
export * from './schema';
neonConfig.webSocketConstructor = ws;
type NeonDatabase = ReturnType<typeof drizzle<typeof schema>>;
export function createDatabase(
  connectionString: string,
  mode = process.env.DATABASE_MODE ?? 'neon',
  dataDir = process.env.DATABASE_DATA_DIR ?? 'memory://',
): { db: NeonDatabase; pool: { end(): Promise<void> } } {
  if (mode === 'embedded') {
    if (process.env.NODE_ENV === 'production') throw new Error('Produção exige Neon');
    if (dataDir !== 'memory://') mkdirSync(dirname(dataDir), { recursive: true });
    const client = new PGlite(dataDir);
    // Both adapters implement the PostgreSQL dialect; this boundary is covered by integration tests.
    const db = embeddedDrizzle(client, { schema }) as unknown as NeonDatabase;
    return { db, pool: { end: () => client.close() } };
  }
  const pool = new Pool({
    connectionString,
    max: 10,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
  });
  return { db: drizzle(pool, { schema }), pool };
}
export type Database = ReturnType<typeof createDatabase>['db'];
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
