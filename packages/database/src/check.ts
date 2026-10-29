import { config } from 'dotenv';
import { sql } from 'drizzle-orm';
import { createDatabase, users } from './index';

config({ path: '../../.env', quiet: true });

async function main() {
  const { db, pool } = createDatabase(process.env.DATABASE_URL ?? '');
  try {
    // Exercise the same adapter and interactive transactions used by reservations.
    await db.transaction(async (tx) => {
      await tx.execute(sql`select 1`);
      await tx.select({ id: users.id }).from(users).limit(1);
    });
    console.log('Neon: conexão, tabela de usuários e transação validadas.');
  } finally {
    await pool.end();
  }
}

main().catch(() => {
  console.error(
    'Falha ao validar o banco. Confira DATABASE_URL, acesso à rede e execute pnpm db:migrate.',
  );
  process.exitCode = 1;
});
