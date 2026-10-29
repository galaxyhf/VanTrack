import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  doublePrecision,
  jsonb,
  index,
  uniqueIndex,
  check,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
export const roleEnum = pgEnum('user_role', ['admin', 'driver', 'teacher']);
export const tripEnum = pgEnum('trip_status', [
  'scheduled',
  'boarding',
  'in_progress',
  'completed',
  'cancelled',
]);
export const vehicleEnum = pgEnum('vehicle_status', [
  'available',
  'in_operation',
  'maintenance',
  'inactive',
]);
export const reservationEnum = pgEnum('reservation_status', [
  'confirmed',
  'cancelled',
  'boarded',
  'alighted',
]);
export const waitlistEnum = pgEnum('waitlist_status', [
  'waiting',
  'offered',
  'accepted',
  'expired',
  'cancelled',
]);
const id = () => uuid('id').defaultRandom().primaryKey();
const created = () => timestamp('created_at', { withTimezone: true }).defaultNow().notNull();
export const users = pgTable('users', {
  id: id(),
  name: varchar('name', { length: 100 }).notNull(),
  email: varchar('email', { length: 254 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: roleEnum('role').notNull().default('teacher'),
  phone: varchar('phone', { length: 25 }),
  avatarUrl: text('avatar_url'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: created(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
export const refreshSessions = pgTable(
  'refresh_sessions',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: created(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);
export const passwordResets = pgTable('password_resets', {
  id: id(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
});
export const vehicles = pgTable(
  'vehicles',
  {
    id: id(),
    plate: varchar('plate', { length: 7 }).notNull().unique(),
    model: varchar('model', { length: 80 }).notNull(),
    manufacturer: varchar('manufacturer', { length: 80 }).notNull(),
    year: integer('year').notNull(),
    color: varchar('color', { length: 30 }).notNull(),
    capacity: integer('capacity').notNull(),
    internalCode: varchar('internal_code', { length: 30 }).notNull().unique(),
    status: vehicleEnum('status').default('available').notNull(),
    createdAt: created(),
  },
  (t) => [check('capacity_positive', sql`${t.capacity} > 0`)],
);
export const routes = pgTable('routes', {
  id: id(),
  name: varchar('name', { length: 100 }).notNull(),
  origin: varchar('origin', { length: 100 }).notNull(),
  destination: varchar('destination', { length: 100 }).notNull(),
  direction: varchar('direction', { length: 10 }).notNull(),
  estimatedDistance: doublePrecision('estimated_distance').notNull(),
  estimatedDuration: integer('estimated_duration').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  geometry: jsonb('geometry').$type<[number, number][]>(),
  createdAt: created(),
});
export const stops = pgTable(
  'stops',
  {
    id: id(),
    name: varchar('name', { length: 100 }).notNull(),
    address: text('address').notNull(),
    latitude: doublePrecision('latitude').notNull(),
    longitude: doublePrecision('longitude').notNull(),
    isDemo: boolean('is_demo').default(false).notNull(),
  },
  (t) => [
    check('valid_stop_lat', sql`${t.latitude} between -90 and 90`),
    check('valid_stop_lon', sql`${t.longitude} between -180 and 180`),
  ],
);
export const routeStops = pgTable(
  'route_stops',
  {
    id: id(),
    routeId: uuid('route_id')
      .notNull()
      .references(() => routes.id, { onDelete: 'cascade' }),
    stopId: uuid('stop_id')
      .notNull()
      .references(() => stops.id, { onDelete: 'restrict' }),
    stopOrder: integer('stop_order').notNull(),
    estimatedOffsetMinutes: integer('estimated_offset_minutes').notNull(),
    kind: varchar('kind', { length: 10 }).notNull().default('both'),
  },
  (t) => [
    uniqueIndex('route_order_unique').on(t.routeId, t.stopOrder),
    uniqueIndex('route_stop_unique').on(t.routeId, t.stopId),
  ],
);
export const trips = pgTable(
  'trips',
  {
    id: id(),
    routeId: uuid('route_id')
      .notNull()
      .references(() => routes.id, { onDelete: 'restrict' }),
    vehicleId: uuid('vehicle_id')
      .notNull()
      .references(() => vehicles.id, { onDelete: 'restrict' }),
    driverId: uuid('driver_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    scheduledDeparture: timestamp('scheduled_departure', { withTimezone: true }).notNull(),
    scheduledArrival: timestamp('scheduled_arrival', { withTimezone: true }).notNull(),
    actualDeparture: timestamp('actual_departure', { withTimezone: true }),
    actualArrival: timestamp('actual_arrival', { withTimezone: true }),
    status: tripEnum('status').default('scheduled').notNull(),
    isDemo: boolean('is_demo').default(false).notNull(),
    trackingConsentAt: timestamp('tracking_consent_at', { withTimezone: true }),
    trackingPaused: boolean('tracking_paused').default(true).notNull(),
    createdAt: created(),
  },
  (t) => [
    index('trip_departure_idx').on(t.scheduledDeparture),
    index('trip_driver_idx').on(t.driverId),
    index('trip_vehicle_idx').on(t.vehicleId),
    check('valid_trip_window', sql`${t.scheduledArrival} > ${t.scheduledDeparture}`),
  ],
);
export const reservations = pgTable(
  'reservations',
  {
    id: id(),
    tripId: uuid('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'restrict' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    boardingStopId: uuid('boarding_stop_id')
      .notNull()
      .references(() => stops.id, { onDelete: 'restrict' }),
    status: reservationEnum('status').default('confirmed').notNull(),
    createdAt: created(),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    boardedAt: timestamp('boarded_at', { withTimezone: true }),
    alightedAt: timestamp('alighted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('one_active_reservation')
      .on(t.tripId, t.userId)
      .where(sql`${t.status} <> 'cancelled'`),
    index('reservation_user_idx').on(t.userId),
  ],
);
export const waitlist = pgTable(
  'waitlist',
  {
    id: id(),
    tripId: uuid('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'restrict' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    boardingStopId: uuid('boarding_stop_id')
      .notNull()
      .references(() => stops.id, { onDelete: 'restrict' }),
    position: integer('position').notNull(),
    status: waitlistEnum('status').default('waiting').notNull(),
    offeredAt: timestamp('offered_at', { withTimezone: true }),
    offerExpiresAt: timestamp('offer_expires_at', { withTimezone: true }),
    createdAt: created(),
  },
  (t) => [
    uniqueIndex('one_active_waitlist')
      .on(t.tripId, t.userId)
      .where(sql`${t.status} in ('waiting','offered')`),
    index('waitlist_queue_idx').on(t.tripId, t.position),
  ],
);
export const vehicleLocations = pgTable(
  'vehicle_locations',
  {
    id: id(),
    tripId: uuid('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    latitude: doublePrecision('latitude').notNull(),
    longitude: doublePrecision('longitude').notNull(),
    accuracy: doublePrecision('accuracy').notNull(),
    speed: doublePrecision('speed'),
    heading: doublePrecision('heading'),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull(),
    isSimulated: boolean('is_simulated').notNull(),
    createdAt: created(),
  },
  (t) => [
    index('location_trip_time_idx').on(t.tripId, t.recordedAt),
    check('location_lat', sql`${t.latitude} between -90 and 90`),
    check('location_lon', sql`${t.longitude} between -180 and 180`),
  ],
);
export const messages = pgTable(
  'messages',
  {
    id: id(),
    tripId: uuid('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    senderId: uuid('sender_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    content: text('content').notNull(),
    operational: boolean('operational').default(false).notNull(),
    createdAt: created(),
  },
  (t) => [index('message_trip_time_idx').on(t.tripId, t.createdAt)],
);
export const messageReads = pgTable(
  'message_reads',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tripId: uuid('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    readAt: timestamp('read_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.tripId] })],
);
export const notifications = pgTable(
  'notifications',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tripId: uuid('trip_id').references(() => trips.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 50 }).notNull(),
    title: varchar('title', { length: 150 }).notNull(),
    content: text('content').notNull(),
    isRead: boolean('is_read').default(false).notNull(),
    createdAt: created(),
  },
  (t) => [index('notification_user_time_idx').on(t.userId, t.createdAt)],
);
export const tripEvents = pgTable('trip_events', {
  id: id(),
  tripId: uuid('trip_id')
    .notNull()
    .references(() => trips.id, { onDelete: 'cascade' }),
  eventType: varchar('event_type', { length: 50 }).notNull(),
  description: text('description').notNull(),
  createdAt: created(),
});
export const auditLogs = pgTable('audit_logs', {
  id: id(),
  actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
  action: varchar('action', { length: 80 }).notNull(),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId: uuid('entity_id'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: created(),
});
export const settings = pgTable('settings', {
  key: varchar('key', { length: 80 }).primaryKey(),
  value: integer('value').notNull(),
});
