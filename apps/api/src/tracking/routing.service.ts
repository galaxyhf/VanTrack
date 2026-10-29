import { Injectable } from '@nestjs/common';
import { haversine } from '@vantrack/shared';
import { env } from '../common/env';
export interface RoutingProvider {
  route(points: [number, number][]): Promise<{
    distance: number;
    duration: number;
    geometry: [number, number][];
    source: 'osrm' | 'estimate';
  }>;
}
@Injectable()
export class RoutingService implements RoutingProvider {
  async route(points: [number, number][]) {
    try {
      if (points.length < 2) throw new Error();
      const coords = points.map(([lat, lon]) => `${lon},${lat}`).join(';');
      const response = await fetch(
        `${env.ROUTING_URL}/route/v1/driving/${coords}?overview=full&geometries=geojson`,
        { signal: AbortSignal.timeout(4000) },
      );
      if (!response.ok) throw new Error();
      const json = (await response.json()) as {
        routes?: {
          distance: number;
          duration: number;
          geometry: { coordinates: [number, number][] };
        }[];
      };
      const r = json.routes?.[0];
      if (!r) throw new Error();
      return {
        distance: r.distance,
        duration: r.duration,
        geometry: r.geometry.coordinates.map(([lon, lat]): [number, number] => [lat, lon]),
        source: 'osrm' as const,
      };
    } catch {
      const distance =
        points.reduce((n, p, i) => (i ? n + haversine(points[i - 1], p) : n), 0) * 1.35;
      return {
        distance,
        duration: distance / (45 / 3.6),
        geometry: points,
        source: 'estimate' as const,
      };
    }
  }
}
