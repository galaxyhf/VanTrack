import { z } from 'zod';
export const roles = ['admin', 'driver', 'teacher'] as const;
export const tripStatuses = [
  'scheduled',
  'boarding',
  'in_progress',
  'completed',
  'cancelled',
] as const;
export type Role = (typeof roles)[number];
export type TripStatus = (typeof tripStatuses)[number];
export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone: string | null;
  avatarUrl: string | null;
};
export const idSchema = z.uuid();
export const passwordSchema = z.string().min(9, 'Use pelo menos 9 caracteres').max(128);
export const loginSchema = z.object({ email: z.email(), password: z.string().min(1).max(128) });
export const registerSchema = loginSchema.extend({
  name: z.string().trim().min(2).max(100),
  password: passwordSchema,
});
export const profileSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().max(25).nullable().optional(),
});
export const vehicleSchema = z.object({
  plate: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/),
  model: z.string().trim().min(2).max(80),
  manufacturer: z.string().trim().min(2).max(80),
  year: z.coerce.number().int().min(1990).max(2100),
  color: z.string().trim().min(2).max(30),
  capacity: z.coerce.number().int().min(1).max(60),
  internalCode: z.string().trim().min(1).max(30),
  status: z.enum(['available', 'in_operation', 'maintenance', 'inactive']),
});
export const stopSchema = z.object({
  name: z.string().trim().min(2).max(100),
  address: z.string().trim().min(3).max(250),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  isDemo: z.boolean().default(false),
});
export const routeSchema = z.object({
  name: z.string().trim().min(3).max(100),
  origin: z.string().min(2).max(100),
  destination: z.string().min(2).max(100),
  direction: z.enum(['outbound', 'inbound']),
  estimatedDistance: z.coerce.number().positive().max(2000000),
  estimatedDuration: z.coerce.number().int().positive().max(100000),
  isActive: z.boolean().default(true),
  stops: z
    .array(
      z.object({
        stopId: idSchema,
        estimatedOffsetMinutes: z.coerce.number().int().nonnegative(),
        kind: z.enum(['boarding', 'alighting', 'both']).default('both'),
      }),
    )
    .min(2)
    .max(100),
});
export const tripSchema = z
  .object({
    routeId: idSchema,
    vehicleId: idSchema,
    driverId: idSchema,
    scheduledDeparture: z.iso.datetime(),
    scheduledArrival: z.iso.datetime(),
    isDemo: z.boolean().default(false),
  })
  .refine((v) => new Date(v.scheduledArrival) > new Date(v.scheduledDeparture), {
    message: 'A chegada deve ser após a saída',
  });
export const reservationSchema = z.object({ tripId: idSchema, boardingStopId: idSchema });
export const messageSchema = z.object({
  content: z.string().trim().min(1).max(2000),
  operational: z.boolean().default(false),
});
export const locationSchema = z.object({
  tripId: idSchema,
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(500),
  speed: z.number().min(0).max(60).nullable().default(null),
  heading: z.number().min(0).max(360).nullable().default(null),
  recordedAt: z.iso.datetime(),
});
export type LocationInput = z.infer<typeof locationSchema>;
export const labels: Record<string, string> = {
  scheduled: 'Programada',
  boarding: 'Embarque aberto',
  in_progress: 'Em andamento',
  completed: 'Concluída',
  cancelled: 'Cancelada',
  confirmed: 'Confirmada',
  boarded: 'Embarcou',
  alighted: 'Desembarcou',
  waiting: 'Na fila',
  offered: 'Vaga oferecida',
  expired: 'Expirada',
  available: 'Disponível',
  in_operation: 'Em operação',
  maintenance: 'Em manutenção',
  inactive: 'Inativo',
  admin: 'Administrador',
  driver: 'Motorista',
  teacher: 'Professor',
};
export const transitions: Record<TripStatus, TripStatus[]> = {
  scheduled: ['boarding', 'cancelled'],
  boarding: ['in_progress', 'cancelled'],
  in_progress: ['completed'],
  completed: [],
  cancelled: [],
};
export function canTransition(from: TripStatus, to: TripStatus) {
  return transitions[from].includes(to);
}
export function availableSeats(capacity: number, occupied: number, offers = 0) {
  return Math.max(0, capacity - occupied - offers);
}
export function haversine(a: [number, number], b: [number, number]) {
  const rad = Math.PI / 180;
  const dlat = (b[0] - a[0]) * rad,
    dlon = (b[1] - a[1]) * rad;
  const s =
    Math.sin(dlat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dlon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}
export function estimateArrival(
  distance: number,
  duration: number,
  stops: number,
  scheduledArrival: Date,
  now = new Date(),
) {
  const seconds = Math.max(0, duration) + Math.max(0, stops) * 60;
  const arrival = new Date(now.getTime() + seconds * 1000);
  return {
    arrival: arrival.toISOString(),
    minutes: Math.ceil(seconds / 60),
    distance: Math.round(Math.max(0, distance)),
    delayMinutes: Math.max(0, Math.ceil((arrival.getTime() - scheduledArrival.getTime()) / 60000)),
    trafficAware: false,
  };
}
