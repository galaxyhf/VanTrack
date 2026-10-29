import { z } from 'zod';
import type { OpenAPIObject, SchemaObject } from '@nestjs/swagger';
import {
  registerSchema,
  loginSchema,
  profileSchema,
  passwordSchema,
  vehicleSchema,
  routeSchema,
  stopSchema,
  tripSchema,
  reservationSchema,
  messageSchema,
  locationSchema,
} from '@vantrack/shared';
import { userSchema } from '../admin/admin.service';
export function describeApi(document: OpenAPIObject) {
  const bodies: Record<string, z.ZodType> = {
    'post /auth/register': registerSchema,
    'post /auth/login': loginSchema,
    'patch /auth/profile': profileSchema,
    'post /auth/password': z.object({ currentPassword: z.string(), password: passwordSchema }),
    'post /auth/forgot-password': z.object({ email: z.email() }),
    'post /auth/reset-password': z.object({ token: z.string(), password: passwordSchema }),
    'post /vehicles': vehicleSchema,
    'patch /vehicles/{id}': vehicleSchema,
    'post /stops': stopSchema,
    'patch /stops/{id}': stopSchema,
    'post /routes': routeSchema,
    'patch /routes/{id}': routeSchema,
    'post /trips': tripSchema,
    'patch /trips/{id}': tripSchema,
    'post /reservations': reservationSchema,
    'post /waitlist': reservationSchema,
    'post /reservations/{id}/attendance': z.object({ status: z.enum(['boarded', 'alighted']) }),
    'post /trips/{id}/messages': messageSchema,
    'post /trips/{id}/location': locationSchema,
    'post /trips/{id}/tracking-consent': z.object({ enabled: z.boolean() }),
    'post /trips/{id}/delay': z.object({
      minutes: z.number().int().min(1).max(240),
      description: z.string().min(3).max(500),
    }),
    'post /trips/{id}/incidents': z.object({ description: z.string().min(5).max(1000) }),
    'post /trips/{id}/simulator': z.object({
      action: z.enum(['start', 'pause', 'resume', 'reset', 'speed', 'delay']),
      speed: z.number().int().min(1).max(20).optional(),
    }),
    'post /users': userSchema,
    'patch /users/{id}': userSchema,
    'patch /admin/settings': z.object({
      cancellation_cutoff_minutes: z.number().int().min(0).max(1440),
      waitlist_offer_minutes: z.number().int().min(1).max(120),
      location_retention_days: z.number().int().min(1).max(365),
    }),
  };
  for (const [path, item] of Object.entries(document.paths))
    for (const method of ['get', 'post', 'patch', 'delete'] as const) {
      const operation = item?.[method];
      if (!operation) continue;
      operation.summary ??= `${method.toUpperCase()} ${path}`;
      const schema = bodies[`${method} ${path}`];
      if (schema)
        operation.requestBody = {
          required: true,
          content: {
            'application/json': {
              schema: z.toJSONSchema(schema, {
                io: 'input',
                unrepresentable: 'any',
              }) as SchemaObject,
            },
          },
        };
      operation.responses['400'] = {
        description: 'Entrada inválida. Corpo: {error:{message,issues?},statusCode}',
      };
      operation.responses['401'] = { description: 'Sessão ausente ou expirada' };
      operation.responses['403'] = { description: 'Papel, participação ou origem não autorizada' };
      operation.responses['409'] = { description: 'Conflito de estado, capacidade ou agenda' };
      operation.responses['429'] = { description: 'Limite de requisições excedido' };
      if (
        method === 'get' &&
        [
          '/trips',
          '/vehicles',
          '/users',
          '/routes',
          '/stops',
          '/notifications',
          '/admin/audit',
          '/admin/reservations',
          '/trips/{id}/messages',
          '/trips/{id}/location-history',
        ].includes(path)
      )
        operation.parameters = [
          ...(operation.parameters ?? []),
          { in: 'query', name: 'page', schema: { type: 'integer', minimum: 1, default: 1 } },
          {
            in: 'query',
            name: 'limit',
            schema: { type: 'integer', minimum: 1, maximum: 100, default: 30 },
          },
        ];
    }
  return document;
}
