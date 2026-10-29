import { config } from 'dotenv';
import { migrate } from 'drizzle-orm/neon-serverless/migrator';
import { createDatabase } from './index';
config({ path: '../../.env' });
async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED;
  if (!url) throw new Error('Configure DATABASE_URL_UNPOOLED');
  if (new URL(url).hostname.includes('-pooler')) throw new Error('Migrações exigem URL direta');
  const { db, pool } = createDatabase(url);
  try {
    await migrate(db, { migrationsFolder: './migrations' });
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
