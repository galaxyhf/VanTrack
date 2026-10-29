import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from './schema';
export * from './schema';
neonConfig.webSocketConstructor = ws;
type NeonDatabase = ReturnType<typeof drizzle<typeof schema>>;
export function createDatabase(connectionString: string): {
  db: NeonDatabase;
  pool: { end(): Promise<void> };
} {
  if (!connectionString) throw new Error('Configure DATABASE_URL para conectar ao Neon');
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
