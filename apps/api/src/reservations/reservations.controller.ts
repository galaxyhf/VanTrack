import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { ApiTags, ApiCookieAuth } from '@nestjs/swagger';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { reservations, trips, routes, stops, waitlist } from '@vantrack/database';
import { idSchema, reservationSchema } from '@vantrack/shared';
import { CurrentUser, Roles } from '../auth/auth.guard';
import type { Principal } from '../auth/auth.service';
import { DatabaseService } from '../common/database.service';
import { parse } from '../common/validation';
import { ReservationsService } from './reservations.service';
@ApiTags('Reservas')
@ApiCookieAuth()
@Controller()
export class ReservationsController {
  constructor(
    @Inject(ReservationsService) private readonly service: ReservationsService,
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}
  @Get('reservations/me') async me(@CurrentUser() u: Principal) {
    const db = this.database.db;
    return {
      data: await db
        .select({ reservation: reservations, trip: trips, route: routes, stop: stops })
        .from(reservations)
        .innerJoin(trips, eq(trips.id, reservations.tripId))
        .innerJoin(routes, eq(routes.id, trips.routeId))
        .innerJoin(stops, eq(stops.id, reservations.boardingStopId))
        .where(eq(reservations.userId, u.id))
        .orderBy(desc(reservations.createdAt))
        .limit(100),
      waitlist: await db
        .select({ entry: waitlist, trip: trips, route: routes })
        .from(waitlist)
        .innerJoin(trips, eq(trips.id, waitlist.tripId))
        .innerJoin(routes, eq(routes.id, trips.routeId))
        .where(and(eq(waitlist.userId, u.id), inArray(waitlist.status, ['waiting', 'offered'])))
        .limit(100),
    };
  }
  @Roles('teacher') @Post('reservations') reserve(@CurrentUser() u: Principal, @Body() b: unknown) {
    return this.service.reserve(u, parse(reservationSchema, b));
  }
  @Post('reservations/:id/cancel') cancel(@CurrentUser() u: Principal, @Param('id') id: string) {
    return this.service.cancel(u, parse(idSchema, id));
  }
  @Roles('teacher') @Post('waitlist') join(@CurrentUser() u: Principal, @Body() b: unknown) {
    return this.service.join(u, parse(reservationSchema, b));
  }
  @Roles('teacher') @Post('waitlist/:id/accept') accept(
    @CurrentUser() u: Principal,
    @Param('id') id: string,
  ) {
    return this.service.accept(u, parse(idSchema, id));
  }
  @Roles('teacher') @Post('waitlist/:id/leave') leave(
    @CurrentUser() u: Principal,
    @Param('id') id: string,
  ) {
    return this.service.leave(u, parse(idSchema, id));
  }
  @Roles('driver', 'admin') @Post('reservations/:id/attendance') attendance(
    @CurrentUser() u: Principal,
    @Param('id') id: string,
    @Body() b: unknown,
  ) {
    return this.service.attendance(
      u,
      parse(idSchema, id),
      parse(z.object({ status: z.enum(['boarded', 'alighted']) }), b).status,
    );
  }
}
