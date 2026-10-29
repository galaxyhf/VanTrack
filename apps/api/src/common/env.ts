import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
for (const p of [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')])
  if (existsSync(p)) {
    config({ path: p, quiet: true });
    break;
  }
export const env = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().default(4000),
    WEB_ORIGIN: z.url().default('http://localhost:3000'),
    DATABASE_URL: z.string().min(1),
    JWT_SECRET: z.string().min(40),
    SIMULATOR_ENABLED: z.enum(['true', 'false']).default('false'),
    ROUTING_URL: z.url().default('https://router.project-osrm.org'),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().default(587),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    MAIL_FROM: z.string().default('VanTrack <nao-responda@localhost>'),
  })
  .parse(process.env);
if (env.NODE_ENV === 'production' && !env.WEB_ORIGIN.startsWith('https://'))
  throw new Error('Produção exige HTTPS');
