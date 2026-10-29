import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags, ApiCookieAuth } from '@nestjs/swagger';
import { eq, asc, sql } from 'drizzle-orm';
import { z } from 'zod';
import { vehicles, routes, stops, routeStops } from '@vantrack/database';
import { idSchema, vehicleSchema, routeSchema, stopSchema, tripSchema } from '@vantrack/shared';
import { CurrentUser, Roles } from '../auth/auth.guard';
import type { Principal } from '../auth/auth.service';
import { DatabaseService } from '../common/database.service';
import { parse, pageInfo } from '../common/validation';
import { OperationsService } from './operations.service';
import { TripsRepository } from './trips.repository';
@ApiTags('Operação')
@ApiCookieAuth()
@Controller()
export class OperationsController {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(OperationsService) private readonly service: OperationsService,
    @Inject(TripsRepository) private readonly repository: TripsRepository,
  ) {}
  @Roles('admin') @Get('vehicles') async vehicles(@Query() q: unknown) {
    const p = pageInfo(q);
    return {
      data: await this.database.db
        .select()
        .from(vehicles)
        .where(
          p.search
            ? sql`(${vehicles.plate} ilike ${'%' + p.search + '%'} or ${vehicles.model} ilike ${'%' + p.search + '%'})`
            : undefined,
        )
        .orderBy(asc(vehicles.internalCode))
        .limit(p.limit)
        .offset(p.offset),
      page: p.page,
    };
  }
  @Roles('admin') @Get('vehicles/:id') async vehicle(@Param('id') id: string) {
    return (
      (
        await this.database.db
          .select()
          .from(vehicles)
          .where(eq(vehicles.id, parse(idSchema, id)))
      )[0] ?? null
    );
  }
  @Roles('admin') @Post('vehicles') createVehicle(@CurrentUser() u: Principal, @Body() b: unknown) {
    return this.service.vehicle(u, parse(vehicleSchema, b));
  }
  @Roles('admin') @Patch('vehicles/:id') updateVehicle(
    @CurrentUser() u: Principal,
    @Param('id') id: string,
    @Body() b: unknown,
  ) {
    return this.service.vehicle(u, parse(vehicleSchema, b), parse(idSchema, id));
  }
  @Roles('admin') @Delete('vehicles/:id') deleteVehicle(
    @CurrentUser() u: Principal,
    @Param('id') id: string,
  ) {
    return this.service.deleteVehicle(u, parse(idSchema, id));
  }
  @Roles('admin') @Get('stops') async stops(@Query() q: unknown) {
    const p = pageInfo(q);
    return {
      data: await this.database.db
        .select()
        .from(stops)
        .orderBy(asc(stops.name))
        .limit(p.limit)
        .offset(p.offset),
      page: p.page,
    };
  }
  @Roles('admin') @Post('stops') createStop(@CurrentUser() u: Principal, @Body() b: unknown) {
    return this.service.stop(u, parse(stopSchema, b));
  }
  @Roles('admin') @Patch('stops/:id') updateStop(
    @CurrentUser() u: Principal,
    @Param('id') id: string,
    @Body() b: unknown,
  ) {
    return this.service.stop(u, parse(stopSchema, b), parse(idSchema, id));
  }
  @Roles('admin') @Get('routes') async routes(@Query() q: unknown) {
    const p = pageInfo(q);
    return {
      data: await this.database.db
        .select()
        .from(routes)
        .orderBy(asc(routes.name))
        .limit(p.limit)
        .offset(p.offset),
      page: p.page,
    };
  }
  @Roles('admin') @Get('routes/:id') async route(@Param('id') id: string) {
    const routeId = parse(idSchema, id);
    return {
      route: (await this.database.db.select().from(routes).where(eq(routes.id, routeId)))[0],
      stops: await this.database.db
        .select()
        .from(routeStops)
        .where(eq(routeStops.routeId, routeId))
        .orderBy(asc(routeStops.stopOrder)),
    };
  }
  @Roles('admin') @Post('routes') createRoute(@CurrentUser() u: Principal, @Body() b: unknown) {
    return this.service.route(u, parse(routeSchema, b));
  }
  @Roles('admin') @Patch('routes/:id') updateRoute(
    @CurrentUser() u: Principal,
    @Param('id') id: string,
    @Body() b: unknown,
  ) {
    return this.service.route(u, parse(routeSchema, b), parse(idSchema, id));
  }
  @Get('trips') list(@CurrentUser() u: Principal, @Query() q: unknown) {
    return this.repository.list(u, q);
  }
  @Get('trips/:id') detail(@CurrentUser() u: Principal, @Param('id') id: string) {
    return this.repository.detail(u, parse(idSchema, id));
  }
  @Roles('admin') @Post('trips') createTrip(@CurrentUser() u: Principal, @Body() b: unknown) {
    return this.service.schedule(u, parse(tripSchema, b));
  }
  @Roles('admin') @Patch('trips/:id') updateTrip(
    @CurrentUser() u: Principal,
    @Param('id') id: string,
    @Body() b: unknown,
  ) {
    return this.service.schedule(u, parse(tripSchema, b), parse(idSchema, id));
  }
  @Roles('admin', 'driver') @Post('trips/:id/boarding') boarding(
    @CurrentUser() u: Principal,
    @Param('id') id: string,
  ) {
    return this.service.transition(u, parse(idSchema, id), 'boarding');
  }
  @Roles('admin', 'driver') @Post('trips/:id/start') start(
    @CurrentUser() u: Principal,
    @Param('id') id: string,
  ) {
    return this.service.transition(u, parse(idSchema, id), 'in_progress');
  }
  @Roles('admin', 'driver') @Post('trips/:id/finish') finish(
    @CurrentUser() u: Principal,
    @Param('id') id: string,
  ) {
    return this.service.transition(u, parse(idSchema, id), 'completed');
  }
  @Roles('admin') @Post('trips/:id/cancel') cancel(
    @CurrentUser() u: Principal,
    @Param('id') id: string,
  ) {
    return this.service.transition(u, parse(idSchema, id), 'cancelled');
  }
  @Roles('admin', 'driver') @Post('trips/:id/delay') delay(
    @CurrentUser() u: Principal,
    @Param('id') id: string,
    @Body() b: unknown,
  ) {
    const d = parse(
      z.object({
        minutes: z.number().int().min(1).max(240),
        description: z.string().trim().min(3).max(500),
      }),
      b,
    );
    return this.service.delay(u, parse(idSchema, id), d.minutes, d.description);
  }
}
