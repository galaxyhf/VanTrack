import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import {
  users,
  refreshSessions,
  trips,
  auditLogs,
  settings,
  reservations,
} from '@vantrack/database';
import { z } from 'zod';
import * as argon2 from 'argon2';
import { EventsService } from '../common/events.service';
import { DatabaseService } from '../common/database.service';
import { pageInfo } from '../common/validation';
import { publicUserColumns, type Principal } from '../auth/auth.service';
export const userSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email(),
  role: z.enum(['teacher', 'driver', 'admin']),
  phone: z.string().max(25).nullable().default(null),
  isActive: z.boolean().default(true),
  password: z.string().min(9).max(128).optional(),
});
@Injectable()
export class AdminService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(EventsService) private readonly events: EventsService,
  ) {}
  async list(query: unknown) {
    const p = pageInfo(query);
    return {
      data: await this.database.db
        .select(publicUserColumns)
        .from(users)
        .where(
          p.search
            ? sql`(${users.name} ilike ${'%' + p.search + '%'} or ${users.email} ilike ${'%' + p.search + '%'})`
            : undefined,
        )
        .orderBy(desc(users.createdAt))
        .limit(p.limit)
        .offset(p.offset),
      page: p.page,
    };
  }
  async save(actor: Principal, data: z.infer<typeof userSchema>, id?: string) {
    return this.database.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(883321)`);
      if (id === actor.id && (!data.isActive || data.role !== 'admin'))
        throw new BadRequestException('Você não pode remover seu próprio acesso administrativo');
      if (id) {
        const [old] = await tx.select().from(users).where(eq(users.id, id)).for('update');
        if (!old) throw new BadRequestException('Usuário não encontrado');
        if (old.role === 'driver' && (data.role !== 'driver' || !data.isActive)) {
          const active = await tx
            .select()
            .from(trips)
            .where(
              and(
                eq(trips.driverId, id),
                sql`${trips.status} in ('scheduled','boarding','in_progress')`,
              ),
            )
            .limit(1);
          if (active.length)
            throw new ConflictException(
              'Reatribua as viagens deste motorista antes de alterar o acesso',
            );
        }
      }
      const { password, ...values } = data;
      if (!id && !password)
        throw new BadRequestException('Informe uma senha inicial de pelo menos 9 caracteres');
      const passwordHash = password ? await argon2.hash(password) : undefined;
      const [row] = id
        ? await tx
            .update(users)
            .set({
              ...values,
              email: values.email.toLowerCase(),
              ...(passwordHash ? { passwordHash } : {}),
              updatedAt: new Date(),
            })
            .where(eq(users.id, id))
            .returning(publicUserColumns)
        : await tx
            .insert(users)
            .values({ ...values, email: values.email.toLowerCase(), passwordHash: passwordHash! })
            .returning(publicUserColumns);
      if (id) {
        await tx
          .update(refreshSessions)
          .set({ revokedAt: new Date() })
          .where(eq(refreshSessions.userId, id));
        this.events.disconnectUser(id);
      }
      await tx.insert(auditLogs).values({
        actorId: actor.id,
        action: id ? 'update' : 'create',
        entityType: 'user',
        entityId: row.id,
        metadata: { role: row.role },
      });
      return row;
    });
  }
  async dashboard(query: unknown) {
    const p = pageInfo(query);
    const filter = sql`where 1=1 ${p.from ? sql`and t.scheduled_departure>=${p.from}::timestamptz` : sql``} ${p.to ? sql`and t.scheduled_departure<=${p.to}::timestamptz` : sql``} ${p.vehicleId ? sql`and t.vehicle_id=${p.vehicleId}` : sql``} ${p.routeId ? sql`and t.route_id=${p.routeId}` : sql``} ${p.driverId ? sql`and t.driver_id=${p.driverId}` : sql``}`;
    const summary = await this.database.db.execute(
      sql`with filtered as (select t.*,v.capacity, (select count(*) from reservations r where r.trip_id=t.id and r.status<>'cancelled') occupied from trips t join vehicles v on v.id=t.vehicle_id ${filter}) select (select count(*)::int from vehicles) vehicles, (select count(*)::int from vehicles where status='in_operation') operating, (select count(*)::int from users where role='teacher' and is_active) teachers, count(*) filter(where status='scheduled')::int scheduled, count(*) filter(where status='in_progress')::int active, count(*) filter(where status='completed')::int completed, count(*) filter(where status='cancelled')::int cancelled, coalesce(sum(occupied),0)::int reservations, coalesce(round(avg(100.0*occupied/nullif(capacity,0)),1),0)::float occupancy, count(*) filter(where coalesce(actual_departure,now())>scheduled_departure+interval '5 minutes' and status<>'cancelled')::int delayed, coalesce(round(avg(greatest(0,extract(epoch from (actual_arrival-scheduled_arrival))/60)) filter(where status='completed'),1),0)::float average_delay from filtered`,
    );
    const series = await this.database.db.execute(
      sql`select to_char(t.scheduled_departure at time zone 'America/Sao_Paulo','DD/MM') as "day",count(*)::int trips,coalesce(round(avg(100.0*(select count(*) from reservations r where r.trip_id=t.id and r.status<>'cancelled')/v.capacity),1),0)::float occupancy from trips t join vehicles v on v.id=t.vehicle_id ${filter} group by date(t.scheduled_departure at time zone 'America/Sao_Paulo'),"day" order by date(t.scheduled_departure at time zone 'America/Sao_Paulo') desc limit 31`,
    );
    const rows = await this.database.db.execute(
      sql`select t.id,rt.name route,v.plate,u.name driver,t.status,t.is_demo,t.scheduled_departure,t.actual_departure,t.scheduled_arrival,t.actual_arrival,v.capacity,(select count(*)::int from reservations r where r.trip_id=t.id and r.status<>'cancelled') passengers,(select count(*)::int from reservations r where r.trip_id=t.id and r.status='cancelled') cancellations from trips t join routes rt on rt.id=t.route_id join vehicles v on v.id=t.vehicle_id join users u on u.id=t.driver_id ${filter} order by t.scheduled_departure desc limit 1000`,
    );
    return { summary: summary.rows[0], series: series.rows.reverse(), data: rows.rows };
  }
  async live() {
    const result = await this.database.db.execute(
      sql`select t.id as "tripId",v.internal_code as label,l.id,l.latitude,l.longitude,l.accuracy,l.heading,l.speed,l.recorded_at as "recordedAt",l.is_simulated as "isSimulated",t.tracking_paused as paused from trips t join vehicles v on v.id=t.vehicle_id join lateral (select * from vehicle_locations where trip_id=t.id order by recorded_at desc limit 1) l on true where t.status='in_progress'`,
    );
    return { data: result.rows };
  }
  async settings() {
    return { data: await this.database.db.select().from(settings) };
  }
  async configure(
    actor: Principal,
    input: {
      cancellation_cutoff_minutes: number;
      waitlist_offer_minutes: number;
      location_retention_days: number;
    },
  ) {
    await this.database.db.transaction(async (tx) => {
      for (const [key, value] of Object.entries(input))
        await tx
          .insert(settings)
          .values({ key, value })
          .onConflictDoUpdate({ target: settings.key, set: { value } });
      await tx.insert(auditLogs).values({
        actorId: actor.id,
        action: 'configure',
        entityType: 'settings',
        metadata: input,
      });
    });
    return this.settings();
  }
  async audit(query: unknown) {
    const p = pageInfo(query);
    return {
      data: await this.database.db
        .select()
        .from(auditLogs)
        .orderBy(desc(auditLogs.createdAt))
        .limit(p.limit)
        .offset(p.offset),
      page: p.page,
    };
  }
  async reservations(query: unknown) {
    const p = pageInfo(query);
    return {
      data: await this.database.db
        .select({ reservation: reservations, user: { id: users.id, name: users.name } })
        .from(reservations)
        .innerJoin(users, eq(users.id, reservations.userId))
        .orderBy(desc(reservations.createdAt))
        .limit(p.limit)
        .offset(p.offset),
      page: p.page,
    };
  }
}
