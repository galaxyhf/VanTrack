import { BadRequestException, PipeTransform } from '@nestjs/common';
import { z } from 'zod';
export class ZodPipe<T> implements PipeTransform {
  constructor(private readonly schema: z.ZodType<T>) {}
  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success)
      throw new BadRequestException({
        message: 'Verifique os campos informados',
        issues: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    return result.data;
  }
}
export const parse = <T>(schema: z.ZodType<T>, value: unknown) =>
  new ZodPipe(schema).transform(value);
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  search: z.string().max(100).optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
  vehicleId: z.uuid().optional(),
  routeId: z.uuid().optional(),
  driverId: z.uuid().optional(),
});
export const pageInfo = (q: unknown) => {
  const p = parse(paginationSchema, q);
  return { ...p, offset: (p.page - 1) * p.limit };
};
