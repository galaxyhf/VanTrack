import { describe, expect, it } from 'vitest';
import {
  availableSeats,
  canTransition,
  estimateArrival,
  haversine,
  locationSchema,
  registerSchema,
} from './index';
describe('regras compartilhadas', () => {
  it('ofertas reservam capacidade e nunca há vagas negativas', () => {
    expect(availableSeats(16, 14, 2)).toBe(0);
    expect(availableSeats(16, 17)).toBe(0);
    expect(availableSeats(16, 8, 1)).toBe(7);
  });
  it('impede reabrir viagem encerrada ou iniciar sem embarque', () => {
    expect(canTransition('completed', 'in_progress')).toBe(false);
    expect(canTransition('scheduled', 'in_progress')).toBe(false);
    expect(canTransition('boarding', 'in_progress')).toBe(true);
    expect(canTransition('in_progress', 'cancelled')).toBe(false);
  });
  it('calcula ETA com paradas e atraso sem afirmar trânsito real', () => {
    const now = new Date('2026-10-28T12:00:00Z');
    const eta = estimateArrival(20000, 1200, 2, new Date('2026-10-28T12:15:00Z'), now);
    expect(eta.arrival).toBe('2026-10-28T12:22:00.000Z');
    expect(eta.minutes).toBe(22);
    expect(eta.delayMinutes).toBe(7);
    expect(eta.trafficAware).toBe(false);
  });
  it('valida GPS, senha e cadastro sem aceitar papel livre', () => {
    expect(
      locationSchema.safeParse({
        tripId: crypto.randomUUID(),
        latitude: 100,
        longitude: 0,
        accuracy: 2,
        recordedAt: new Date().toISOString(),
      }).success,
    ).toBe(false);
    expect(
      registerSchema.safeParse({ name: 'Teste', email: 'a@b.com', password: '12345678' }).success,
    ).toBe(false);
    expect(
      registerSchema.parse({
        name: 'Teste',
        email: 'a@b.com',
        password: '123456789',
        role: 'admin',
      }),
    ).not.toHaveProperty('role');
  });
  it('calcula distância geográfica em metros', () => {
    expect(haversine([-22.9, -43.1], [-22.9, -43.1])).toBe(0);
    expect(haversine([0, 0], [0, 1])).toBeCloseTo(111194.9, 0);
  });
});
