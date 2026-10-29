import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  OnModuleDestroy,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { trips, vehicleLocations } from '@vantrack/database';
import type { Principal } from '../auth/auth.service';
import { DatabaseService } from '../common/database.service';
import { TripsRepository } from '../operations/trips.repository';
import { TrackingService } from './tracking.service';
import { EtaService } from './eta.service';
import { env } from '../common/env';
type Simulation = {
  timer: ReturnType<typeof setInterval> | null;
  index: number;
  speed: number;
  points: [number, number][];
  owner: Principal;
  delayTicks: number;
};
@Injectable()
export class SimulatorService implements OnModuleDestroy {
  private readonly runs = new Map<string, Simulation>();
  constructor(
    @Inject(TripsRepository) private readonly repository: TripsRepository,
    @Inject(TrackingService) private readonly tracking: TrackingService,
    @Inject(EtaService) private readonly eta: EtaService,
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}
  async control(
    user: Principal,
    id: string,
    action: 'start' | 'pause' | 'resume' | 'reset' | 'speed' | 'delay',
    speed = 1,
  ) {
    if (env.SIMULATOR_ENABLED !== 'true' || env.NODE_ENV === 'production')
      throw new ForbiddenException('Simulador desativado');
    const trip = await this.repository.authorize(user, id);
    if (!trip.isDemo || user.role === 'teacher' || trip.status !== 'in_progress')
      throw new ForbiddenException('O simulador exige viagem de demonstração em andamento');
    let run = this.runs.get(id);
    if (action === 'start' && !run) {
      const route = await this.eta.geometry(trip.routeId);
      const points: [number, number][] = [];
      for (let i = 1; i < route.geometry.length; i++) {
        const a = route.geometry[i - 1],
          b = route.geometry[i];
        for (let k = 0; k < 4; k++)
          points.push([a[0] + ((b[0] - a[0]) * k) / 4, a[1] + ((b[1] - a[1]) * k) / 4]);
      }
      points.push(route.geometry.at(-1)!);
      run = { timer: null, index: 0, speed, points, owner: user, delayTicks: 0 };
      this.runs.set(id, run);
    }
    if (!run) throw new BadRequestException('Inicie a simulação');
    if (action === 'pause' || action === 'reset') {
      if (run.timer) clearInterval(run.timer);
      run.timer = null;
      await this.database.db.update(trips).set({ trackingPaused: true }).where(eq(trips.id, id));
      if (action === 'reset') {
        run.index = 0;
        await this.database.db.delete(vehicleLocations).where(eq(vehicleLocations.tripId, id));
      }
    }
    if (action === 'speed') run.speed = speed;
    if (action === 'delay') run.delayTicks = 6;
    if (['start', 'resume'].includes(action) && !run.timer) {
      const current = run;
      run.timer = setInterval(
        () =>
          void this.tick(id, current).catch(() => {
            if (current.timer) clearInterval(current.timer);
            current.timer = null;
          }),
        6000,
      );
      await this.tick(id, run);
    }
    return { running: !!run.timer, index: run.index, total: run.points.length, speed: run.speed };
  }
  private async tick(id: string, run: Simulation) {
    const trip = await this.repository.trip(id);
    if (trip.status !== 'in_progress') {
      if (run.timer) clearInterval(run.timer);
      this.runs.delete(id);
      return;
    }
    const point = run.points[Math.min(run.index, run.points.length - 1)];
    await this.tracking.record(
      run.owner,
      {
        tripId: id,
        latitude: point[0],
        longitude: point[1],
        accuracy: 8,
        speed: run.delayTicks ? 0 : 12 + Math.random() * 8,
        heading: 0,
        recordedAt: new Date().toISOString(),
      },
      true,
    );
    if (run.delayTicks) run.delayTicks--;
    else if (run.index % 25 !== 24 || Math.random() > 0.5)
      run.index = Math.min(run.points.length - 1, run.index + run.speed);
    if (run.index >= run.points.length - 1 && run.timer) {
      clearInterval(run.timer);
      run.timer = null;
    }
  }
  onModuleDestroy() {
    for (const run of this.runs.values()) if (run.timer) clearInterval(run.timer);
  }
}
