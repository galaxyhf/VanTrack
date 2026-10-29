import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { and, eq, gt, isNull } from 'drizzle-orm';
import {
  users,
  refreshSessions,
  passwordResets,
  type Database,
  type Transaction,
} from '@vantrack/database';
import type { Role, User } from '@vantrack/shared';
import * as argon2 from 'argon2';
import { randomBytes, createHash } from 'node:crypto';
import nodemailer from 'nodemailer';
import { DatabaseService } from '../common/database.service';
import { EventsService } from '../common/events.service';
import { env } from '../common/env';
export type Principal = User & { sessionId: string };
const digest = (s: string) => createHash('sha256').update(s).digest('hex');
const publicUser = (u: typeof users.$inferSelect): User => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  phone: u.phone,
  avatarUrl: u.avatarUrl,
});
@Injectable()
export class AuthService {
  private readonly jwt = new JwtService({
    secret: env.JWT_SECRET,
    signOptions: { expiresIn: '15m', issuer: 'vantrack', audience: 'vantrack-web' },
  });
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(EventsService) private readonly events: EventsService,
  ) {}
  private get db() {
    return this.database.db;
  }
  async register(data: { name: string; email: string; password: string }) {
    const [u] = await this.db
      .insert(users)
      .values({
        ...data,
        email: data.email.toLowerCase(),
        passwordHash: await argon2.hash(data.password),
        role: 'teacher',
      })
      .returning();
    return this.session(u);
  }
  async login(data: { email: string; password: string }) {
    const [u] = await this.db.select().from(users).where(eq(users.email, data.email.toLowerCase()));
    if (!u?.isActive || !(await argon2.verify(u.passwordHash, data.password)))
      throw new UnauthorizedException('E-mail ou senha inválidos');
    return this.session(u);
  }
  private async session(u: typeof users.$inferSelect, tx: Database | Transaction = this.db) {
    const refresh = randomBytes(48).toString('base64url');
    const [s] = await tx
      .insert(refreshSessions)
      .values({
        userId: u.id,
        tokenHash: digest(refresh),
        expiresAt: new Date(Date.now() + 7 * 86400000),
      })
      .returning();
    return { user: publicUser(u), access: this.jwt.sign({ sub: u.id, sid: s.id }), refresh };
  }
  async refresh(token: string) {
    return this.db.transaction(async (tx) => {
      const [s] = await tx
        .select()
        .from(refreshSessions)
        .where(eq(refreshSessions.tokenHash, digest(token)))
        .for('update');
      if (!s || s.revokedAt || s.expiresAt < new Date())
        throw new UnauthorizedException('Sessão expirada');
      const [u] = await tx
        .select()
        .from(users)
        .where(and(eq(users.id, s.userId), eq(users.isActive, true)));
      if (!u) throw new UnauthorizedException();
      await tx
        .update(refreshSessions)
        .set({ revokedAt: new Date() })
        .where(eq(refreshSessions.id, s.id));
      return this.session(u, tx);
    });
  }
  async authenticate(token: string): Promise<Principal> {
    try {
      const claims = this.jwt.verify<{ sub: string; sid: string }>(token, {
        issuer: 'vantrack',
        audience: 'vantrack-web',
      });
      const [r] = await this.db
        .select({ u: users, s: refreshSessions })
        .from(users)
        .innerJoin(
          refreshSessions,
          and(eq(refreshSessions.userId, users.id), eq(refreshSessions.id, claims.sid)),
        )
        .where(
          and(
            eq(users.id, claims.sub),
            eq(users.isActive, true),
            isNull(refreshSessions.revokedAt),
            gt(refreshSessions.expiresAt, new Date()),
          ),
        );
      if (!r) throw new Error();
      return { ...publicUser(r.u), sessionId: r.s.id };
    } catch {
      throw new UnauthorizedException('Entre para continuar');
    }
  }
  async logout(token: string | undefined) {
    if (token) {
      const rows = await this.db
        .update(refreshSessions)
        .set({ revokedAt: new Date() })
        .where(eq(refreshSessions.tokenHash, digest(token)))
        .returning({ id: refreshSessions.id });
      for (const s of rows) this.events.disconnectSession(s.id);
    }
    return { ok: true };
  }
  async sessions(user: Principal) {
    return this.db
      .select({
        id: refreshSessions.id,
        createdAt: refreshSessions.createdAt,
        expiresAt: refreshSessions.expiresAt,
      })
      .from(refreshSessions)
      .where(
        and(
          eq(refreshSessions.userId, user.id),
          isNull(refreshSessions.revokedAt),
          gt(refreshSessions.expiresAt, new Date()),
        ),
      );
  }
  async revoke(user: Principal, id: string) {
    await this.db
      .update(refreshSessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshSessions.id, id), eq(refreshSessions.userId, user.id)));
    this.events.disconnectSession(id);
    return { ok: true };
  }
  async updateProfile(user: Principal, data: { name: string; phone?: string | null }) {
    const [u] = await this.db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, user.id))
      .returning();
    return publicUser(u);
  }
  async changePassword(user: Principal, current: string, password: string) {
    const [u] = await this.db.select().from(users).where(eq(users.id, user.id));
    if (!(await argon2.verify(u.passwordHash, current)))
      throw new BadRequestException('Senha atual incorreta');
    await this.db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ passwordHash: await argon2.hash(password), updatedAt: new Date() })
        .where(eq(users.id, user.id));
      await tx
        .update(refreshSessions)
        .set({ revokedAt: new Date() })
        .where(eq(refreshSessions.userId, user.id));
    });
    this.events.disconnectUser(user.id);
    return { ok: true };
  }
  async forgot(email: string) {
    const [u] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.email, email.toLowerCase()), eq(users.isActive, true)));
    if (u) {
      const token = randomBytes(48).toString('base64url');
      await this.db.insert(passwordResets).values({
        userId: u.id,
        tokenHash: digest(token),
        expiresAt: new Date(Date.now() + 30 * 60000),
      });
      const link = `${env.WEB_ORIGIN}/redefinir-senha?token=${token}`;
      if (env.SMTP_HOST) {
        const transport = nodemailer.createTransport({
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          secure: env.SMTP_PORT === 465,
          auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
        });
        await transport.sendMail({
          from: env.MAIL_FROM,
          to: u.email,
          subject: 'Redefina sua senha VanTrack',
          text: `Abra este link em até 30 minutos: ${link}`,
        });
      } else if (env.NODE_ENV !== 'production') {
        const { mkdir, writeFile } = await import('node:fs/promises');
        await mkdir('/tmp/vantrack-mail', { recursive: true, mode: 0o700 });
        await writeFile(`/tmp/vantrack-mail/${u.id}.txt`, link, { mode: 0o600 });
      } else throw new BadRequestException('Recuperação indisponível. Contate o administrador.');
    }
    return { message: 'Se o e-mail estiver cadastrado, você receberá instruções.' };
  }
  async reset(token: string, password: string) {
    return this.db.transaction(async (tx) => {
      const [r] = await tx
        .select()
        .from(passwordResets)
        .where(eq(passwordResets.tokenHash, digest(token)))
        .for('update');
      if (!r || r.usedAt || r.expiresAt < new Date())
        throw new BadRequestException('Link inválido ou expirado');
      await tx
        .update(users)
        .set({ passwordHash: await argon2.hash(password), updatedAt: new Date() })
        .where(eq(users.id, r.userId));
      await tx
        .update(passwordResets)
        .set({ usedAt: new Date() })
        .where(eq(passwordResets.userId, r.userId));
      await tx
        .update(refreshSessions)
        .set({ revokedAt: new Date() })
        .where(eq(refreshSessions.userId, r.userId));
      this.events.disconnectUser(r.userId);
      return { ok: true };
    });
  }
}
export const publicUserColumns = {
  id: users.id,
  name: users.name,
  email: users.email,
  role: users.role,
  phone: users.phone,
  isActive: users.isActive,
};
export type { Role };
