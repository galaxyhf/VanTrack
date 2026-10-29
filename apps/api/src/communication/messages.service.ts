import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { desc, eq, sql } from 'drizzle-orm';
import { messages, messageReads, users } from '@vantrack/database';
import { DatabaseService } from '../common/database.service';
import { EventsService } from '../common/events.service';
import { TripsRepository } from '../operations/trips.repository';
import { NotificationsService } from './notifications.service';
import type { Principal } from '../auth/auth.service';
@Injectable()
export class MessagesService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(EventsService) private readonly events: EventsService,
    @Inject(TripsRepository) private readonly trips: TripsRepository,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {}
  async send(user: Principal, id: string, data: { content: string; operational: boolean }) {
    await this.trips.authorize(user, id);
    if (data.operational && user.role === 'teacher')
      throw new ForbiddenException('Somente motorista ou administrador envia avisos');
    const [message] = await this.database.db
      .insert(messages)
      .values({ tripId: id, senderId: user.id, ...data })
      .returning();
    const result = { ...message, senderName: user.name };
    this.events.trip(id, 'trip:message', result);
    for (const recipient of await this.trips.participants(id))
      if (recipient !== user.id)
        await this.notifications.send(
          recipient,
          data.operational ? 'trip:notice' : 'trip:message',
          data.operational ? 'Aviso do motorista' : 'Nova mensagem',
          data.content,
          id,
        );
    return result;
  }
  async list(user: Principal, id: string, limit: number, offset: number) {
    await this.trips.authorize(user, id);
    const data = await this.database.db
      .select({
        id: messages.id,
        tripId: messages.tripId,
        senderId: messages.senderId,
        content: messages.content,
        operational: messages.operational,
        createdAt: messages.createdAt,
        senderName: users.name,
      })
      .from(messages)
      .innerJoin(users, eq(users.id, messages.senderId))
      .where(eq(messages.tripId, id))
      .orderBy(desc(messages.createdAt))
      .limit(limit)
      .offset(offset);
    return { data: data.reverse() };
  }
  async read(user: Principal, id: string) {
    await this.trips.authorize(user, id);
    await this.database.db
      .insert(messageReads)
      .values({ userId: user.id, tripId: id })
      .onConflictDoUpdate({
        target: [messageReads.userId, messageReads.tripId],
        set: { readAt: new Date() },
      });
    return { ok: true };
  }
  async unread(user: Principal): Promise<{ rows: Record<string, unknown>[] }> {
    return this.database.db.execute(
      sql`select m.trip_id, count(*)::int as count from messages m join trips t on t.id=m.trip_id left join message_reads mr on mr.trip_id=m.trip_id and mr.user_id=${user.id} where (${user.role}='admin' or (${user.role}='driver' and t.driver_id=${user.id}) or exists(select 1 from reservations r where r.trip_id=t.id and r.user_id=${user.id} and r.status<>'cancelled')) and m.sender_id<>${user.id} and m.created_at>coalesce(mr.read_at,'1970-01-01') group by m.trip_id`,
    );
  }
}
