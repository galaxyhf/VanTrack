import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import { describeApi } from './common/openapi';
import { AppModule } from './app.module';
import { env } from './common/env';
import { ErrorFilter } from './common/http';
export async function bootstrap(port = env.PORT) {
  const app = await NestFactory.create(AppModule, { rawBody: false });
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: env.WEB_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin !== env.WEB_ORIGIN) {
      res.status(403).json({ error: { message: 'Origem não autorizada' } });
      return;
    }
    next();
  });
  app.useGlobalFilters(new ErrorFilter());
  app.enableShutdownHooks();
  const config = new DocumentBuilder()
    .setTitle('VanTrack API')
    .setDescription('API de transporte. Sessão HttpOnly e Origin obrigatório nas mutações.')
    .setVersion('1.0')
    .addCookieAuth('vt_access')
    .build();
  SwaggerModule.setup('docs', app, describeApi(SwaggerModule.createDocument(app, config)));
  await app.listen(port, '0.0.0.0');
  return app;
}
if (process.env.VANTRACK_TEST !== 'true') void bootstrap();
