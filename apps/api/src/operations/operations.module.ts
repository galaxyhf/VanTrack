import { Module } from '@nestjs/common';
import { TripsReadModule } from './trips-read.module';
import { CommunicationModule } from '../communication/communication.module';
import { OperationsController } from './operations.controller';
import { OperationsService } from './operations.service';
@Module({
  imports: [TripsReadModule, CommunicationModule],
  providers: [OperationsService],
  controllers: [OperationsController],
})
export class OperationsModule {}
