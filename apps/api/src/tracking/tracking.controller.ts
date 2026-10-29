import { Body, Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { ApiTags, ApiCookieAuth } from '@nestjs/swagger';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { vehicleLocations } from '@vantrack/database';
import { idSchema, locationSchema } from '@vantrack/shared';
import { CurrentUser, Roles } from '../auth/auth.guard';
import type { Principal } from '../auth/auth.service';
import { TripsRepository } from '../operations/trips.repository';
import { DatabaseService } from '../common/database.service';
import { parse, pageInfo } from '../common/validation';
import { TrackingService } from './tracking.service';
import { EtaService } from './eta.service';
import { SimulatorService } from './simulator.service';
@ApiTags('Rastreamento')
@ApiCookieAuth()
@Controller('trips/:id')
export class TrackingController {
  constructor(
    @Inject(TripsRepository) private readonly repository: TripsRepository,
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(TrackingService) private readonly tracking: TrackingService,
    @Inject(EtaService) private readonly eta: EtaService,
    @Inject(SimulatorService) private readonly simulator: SimulatorService,
  ) {}
  @Get('location') async location(@CurrentUser() u: Principal, @Param('id') id: string) {
    const trip = await this.repository.authorize(u, parse(idSchema, id));
    const location = await this.repository.latest(id);
    return {
      location,
      paused: trip.trackingPaused,
      stale: !location || trip.trackingPaused || Date.now() - location.recordedAt.getTime() > 30000,
    };
  }
  @Get('location-history') async history(
    @CurrentUser() u: Principal,
    @Param('id') id: string,
    @Query() q: unknown,
  ) {
    await this.repository.authorize(u, parse(idSchema, id));
    const p = pageInfo(q);
    return {
      data: await this.database.db
        .select()
        .from(vehicleLocations)
        .where(and(eq(vehicleLocations.tripId, id)))
        .orderBy(desc(vehicleLocations.recordedAt))
        .limit(p.limit)
        .offset(p.offset),
      page: p.page,
    };
  }
  @Get('eta') async etaResult(@CurrentUser() u: Principal, @Param('id') id: string) {
    await this.repository.authorize(u, parse(idSchema, id));
    return this.eta.calculate(id);
  }
  @Get('geometry') async geometry(@CurrentUser() u: Principal, @Param('id') id: string) {
    const trip = await this.repository.authorize(u, parse(idSchema, id), false);
    return this.eta.geometry(trip.routeId);
  }
  @Roles('driver') @Post('tracking-consent') consent(
    @CurrentUser() u: Principal,
    @Param('id') id: string,
    @Body() b: unknown,
  ) {
    return this.tracking.consent(
      u,
      parse(idSchema, id),
      parse(z.object({ enabled: z.boolean() }), b).enabled,
    );
  }
  @Roles('driver') @Post('location') locationUpdate(
    @CurrentUser() u: Principal,
    @Param('id') id: string,
    @Body() b: unknown,
  ) {
    const data = parse(locationSchema, b);
    if (data.tripId !== parse(idSchema, id)) throw new Error('Viagem divergente');
    return this.tracking.record(u, data);
  }
  @Roles('admin', 'driver') @Post('simulator') simulate(
    @CurrentUser() u: Principal,
    @Param('id') id: string,
    @Body() b: unknown,
  ) {
    const d = parse(
      z.object({
        action: z.enum(['start', 'pause', 'resume', 'reset', 'speed', 'delay']),
        speed: z.number().int().min(1).max(20).default(1),
      }),
      b,
    );
    return this.simulator.control(u, parse(idSchema, id), d.action, d.speed);
  }
}
