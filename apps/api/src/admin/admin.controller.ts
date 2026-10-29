import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Res } from '@nestjs/common';
import { ApiTags, ApiCookieAuth } from '@nestjs/swagger';
import type { Response } from 'express';
import { z } from 'zod';
import { idSchema } from '@vantrack/shared';
import { CurrentUser, Roles } from '../auth/auth.guard';
import type { Principal } from '../auth/auth.service';
import { parse } from '../common/validation';
import { AdminService, userSchema } from './admin.service';
@ApiTags('Administração')
@ApiCookieAuth()
@Roles('admin')
@Controller()
export class AdminController {
  constructor(@Inject(AdminService) private readonly service: AdminService) {}
  @Get('users') list(@Query() q: unknown) {
    return this.service.list(q);
  }
  @Post('users') create(@CurrentUser() u: Principal, @Body() b: unknown) {
    return this.service.save(u, parse(userSchema, b));
  }
  @Patch('users/:id') update(
    @CurrentUser() u: Principal,
    @Param('id') id: string,
    @Body() b: unknown,
  ) {
    return this.service.save(u, parse(userSchema, b), parse(idSchema, id));
  }
  @Get('admin/live') live() {
    return this.service.live();
  }
  @Get('admin/dashboard') dashboard(@Query() q: unknown) {
    return this.service.dashboard(q);
  }
  @Get('admin/reports') reports(@Query() q: unknown) {
    return this.service.dashboard(q);
  }
  @Get('admin/reports.csv') async csv(@Query() q: unknown, @Res() res: Response) {
    const rows = (await this.service.dashboard(q)).data;
    const keys = [
      'id',
      'route',
      'plate',
      'driver',
      'status',
      'is_demo',
      'scheduled_departure',
      'actual_departure',
      'scheduled_arrival',
      'actual_arrival',
      'capacity',
      'passengers',
      'cancellations',
    ];
    const escape = (v: unknown) => {
      let s = String(v ?? '');
      if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
      return '"' + s.replaceAll('"', '""') + '"';
    };
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="vantrack-relatorio.csv"');
    res.send(
      '\uFEFF' +
        [keys.join(';'), ...rows.map((row) => keys.map((k) => escape(row[k])).join(';'))].join(
          '\r\n',
        ),
    );
  }
  @Get('admin/audit') audit(@Query() q: unknown) {
    return this.service.audit(q);
  }
  @Get('admin/reservations') reservations(@Query() q: unknown) {
    return this.service.reservations(q);
  }
  @Get('admin/settings') settings() {
    return this.service.settings();
  }
  @Patch('admin/settings') configure(@CurrentUser() u: Principal, @Body() b: unknown) {
    return this.service.configure(
      u,
      parse(
        z.object({
          cancellation_cutoff_minutes: z.number().int().min(0).max(1440),
          waitlist_offer_minutes: z.number().int().min(1).max(120),
          location_retention_days: z.number().int().min(1).max(365),
        }),
        b,
      ),
    );
  }
}
