import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TripsReadModule } from '../operations/trips-read.module';
import { CommunicationModule } from '../communication/communication.module';
import { ProximityService } from './proximity.service';
import { TrackingService } from './tracking.service';
import { TrackingController } from './tracking.controller';
import { RoutingService } from './routing.service';
import { EtaService } from './eta.service';
import { SimulatorService } from './simulator.service';
import { RealtimeGateway } from './realtime.gateway';
@Module({
  imports: [AuthModule, TripsReadModule, CommunicationModule],
  providers: [
    ProximityService,
    TrackingService,
    RoutingService,
    EtaService,
    SimulatorService,
    RealtimeGateway,
  ],
  controllers: [TrackingController],
})
export class TrackingModule {}
