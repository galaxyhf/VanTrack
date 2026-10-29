import { config } from 'dotenv';
import { migrate as migrateEmbedded } from 'drizzle-orm/pglite/migrator';
import type { PgliteDatabase } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/neon-serverless/migrator';
import { createDatabase } from './index';
config({ path: '../../.env' });
async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED;
  if (!url) throw new Error('Configure DATABASE_URL_UNPOOLED');
  if (new URL(url).hostname.includes('-pooler')) throw new Error('Migrações exigem URL direta');
  const { db, pool } = createDatabase(url);
  try {
    if (process.env.DATABASE_MODE === 'embedded')
      await migrateEmbedded(db as unknown as PgliteDatabase, { migrationsFolder: './migrations' });
    else await migrate(db, { migrationsFolder: './migrations' });
    console.log('Migrações aplicadas.');
  } finally {
    await pool.end();
  }
}
main().catch((e: unknown) => {
  const error = e as { code?: string; cause?: { code?: string } };
  console.error('Falha na migração:', error.code ?? error.cause?.code ?? 'erro SQL ou conexão');
  process.exitCode = 1;
});
