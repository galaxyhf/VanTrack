import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags, ApiCookieAuth } from '@nestjs/swagger';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { notifications, tripEvents } from '@vantrack/database';
import { idSchema, messageSchema } from '@vantrack/shared';
import { CurrentUser } from '../auth/auth.guard';
import type { Principal } from '../auth/auth.service';
import { DatabaseService } from '../common/database.service';
import { parse, pageInfo } from '../common/validation';
import { TripsRepository } from '../operations/trips.repository';
import { MessagesService } from './messages.service';
@ApiTags('Comunicação')
@ApiCookieAuth()
@Controller()
export class CommunicationController {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(MessagesService) private readonly messages: MessagesService,
    @Inject(TripsRepository) private readonly trips: TripsRepository,
  ) {}
  @Get('trips/:id/messages') list(
    @CurrentUser() u: Principal,
    @Param('id') id: string,
    @Query() q: unknown,
  ) {
    const p = pageInfo(q);
    return this.messages.list(u, parse(idSchema, id), p.limit, p.offset);
  }
  @Post('trips/:id/messages') send(
    @CurrentUser() u: Principal,
    @Param('id') id: string,
    @Body() b: unknown,
  ) {
    return this.messages.send(u, parse(idSchema, id), parse(messageSchema, b));
  }
  @Post('trips/:id/messages/read') read(@CurrentUser() u: Principal, @Param('id') id: string) {
    return this.messages.read(u, parse(idSchema, id));
  }
  @Get('messages/unread') async unread(@CurrentUser() u: Principal) {
    return { data: (await this.messages.unread(u)).rows };
  }
  @Get('notifications') async notifications(@CurrentUser() u: Principal, @Query() q: unknown) {
    const p = pageInfo(q);
    const filter = parse(z.object({ type: z.string().max(50).optional() }), q);
    return {
      data: await this.database.db
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, u.id),
            filter.type ? eq(notifications.type, filter.type) : undefined,
          ),
        )
        .orderBy(desc(notifications.createdAt))
        .limit(p.limit)
        .offset(p.offset),
      page: p.page,
    };
  }
  @Patch('notifications/:id/read') async mark(
    @CurrentUser() u: Principal,
    @Param('id') id: string,
  ) {
    await this.database.db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, parse(idSchema, id)), eq(notifications.userId, u.id)));
    return { ok: true };
  }
  @Get('trips/:id/events') async events(@CurrentUser() u: Principal, @Param('id') id: string) {
    await this.trips.authorize(u, parse(idSchema, id));
    return {
      data: await this.database.db
        .select()
        .from(tripEvents)
        .where(eq(tripEvents.tripId, id))
        .orderBy(desc(tripEvents.createdAt))
        .limit(100),
    };
  }
  @Post('trips/:id/incidents') async incident(
    @CurrentUser() u: Principal,
    @Param('id') id: string,
    @Body() b: unknown,
  ) {
    const trip = await this.trips.authorize(u, parse(idSchema, id));
    const d = parse(z.object({ description: z.string().trim().min(5).max(1000) }), b);
    return (
      await this.database.db
        .insert(tripEvents)
        .values({
          tripId: trip.id,
          eventType: 'incident',
          description: `${u.name}: ${d.description}`,
        })
        .returning()
    )[0];
  }
}
