import { config } from 'dotenv';
import { eq } from 'drizzle-orm';
import * as argon2 from 'argon2';
import { createDatabase, users, auditLogs } from './index';
import { registerSchema } from '@vantrack/shared';
config({ path: '../../.env', quiet: true });
async function main() {
  const input = registerSchema.parse({
    name: process.env.ADMIN_NAME,
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  });
  const { db, pool } = createDatabase(process.env.DATABASE_URL!);
  try {
    await db.transaction(async (tx) => {
      const existing = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, input.email.toLowerCase()));
      if (existing.length) throw new Error('E-mail já cadastrado. Nenhuma permissão foi alterada.');
      const [u] = await tx
        .insert(users)
        .values({
          name: input.name,
          email: input.email.toLowerCase(),
          passwordHash: await argon2.hash(input.password),
          role: 'admin',
        })
        .returning({ id: users.id });
      await tx
        .insert(auditLogs)
        .values({ actorId: u.id, action: 'bootstrap_admin', entityType: 'user', entityId: u.id });
    });
    console.log('Administrador criado.');
  } finally {
    await pool.end();
  }
}
main().catch(() => {
  console.error(
    'Não foi possível criar o administrador. Verifique as variáveis privadas e se o e-mail já existe.',
  );
  process.exitCode = 1;
});
