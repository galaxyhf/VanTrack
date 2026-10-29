import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Req,
  Res,
  Inject,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiBody, ApiCookieAuth } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  loginSchema,
  registerSchema,
  profileSchema,
  passwordSchema,
  idSchema,
} from '@vantrack/shared';
import { AuthService, type Principal } from './auth.service';
import { Public, CurrentUser } from './auth.guard';
import { parse } from '../common/validation';
import { env } from '../common/env';
@ApiTags('Autenticação')
@ApiCookieAuth()
@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}
  private cookies(res: Response, result: { access: string; refresh: string; user: unknown }) {
    const opts = {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
    };
    res.cookie('vt_access', result.access, { ...opts, maxAge: 15 * 60000 });
    res.cookie('vt_refresh', result.refresh, { ...opts, path: '/auth', maxAge: 7 * 86400000 });
    return result.user;
  }
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Cadastro público como professor' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name', 'email', 'password'],
      properties: {
        name: { type: 'string' },
        email: { type: 'string', format: 'email' },
        password: { type: 'string', minLength: 9 },
      },
    },
  })
  async register(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    return this.cookies(res, await this.auth.register(parse(registerSchema, body)));
  }
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Iniciar sessão' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['email', 'password'],
      properties: { email: { type: 'string' }, password: { type: 'string' } },
    },
  })
  async login(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    return this.cookies(res, await this.auth.login(parse(loginSchema, body)));
  }
  @Public() @Post('refresh') async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.cookies(res, await this.auth.refresh(req.cookies?.vt_refresh ?? ''));
  }
  @Public() @Post('logout') async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logout(req.cookies?.vt_refresh);
    res.clearCookie('vt_access', { path: '/' });
    res.clearCookie('vt_refresh', { path: '/auth' });
    return { ok: true };
  }
  @Get('me') me(@CurrentUser() user: Principal) {
    const { sessionId: _sessionId, ...profile } = user;
    return profile;
  }
  @Patch('profile') profile(@CurrentUser() u: Principal, @Body() b: unknown) {
    return this.auth.updateProfile(u, parse(profileSchema, b));
  }
  @Get('sessions') sessions(@CurrentUser() u: Principal) {
    return this.auth.sessions(u);
  }
  @Delete('sessions/:id') revoke(@CurrentUser() u: Principal, @Param('id') id: string) {
    return this.auth.revoke(u, parse(idSchema, id));
  }
  @Post('password') password(@CurrentUser() u: Principal, @Body() b: unknown) {
    const d = parse(
      z.object({ currentPassword: z.string().min(1).max(128), password: passwordSchema }),
      b,
    );
    return this.auth.changePassword(u, d.currentPassword, d.password);
  }
  @Throttle({ default: { limit: 10, ttl: 60000 } }) @Public() @Post('forgot-password') forgot(
    @Body() b: unknown,
  ) {
    return this.auth.forgot(parse(z.object({ email: z.email() }), b).email);
  }
  @Throttle({ default: { limit: 10, ttl: 60000 } }) @Public() @Post('reset-password') reset(
    @Body() b: unknown,
  ) {
    const d = parse(z.object({ token: z.string().min(40).max(100), password: passwordSchema }), b);
    return this.auth.reset(d.token, d.password);
  }
}
