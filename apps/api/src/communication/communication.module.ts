import { Module } from '@nestjs/common';
import { TripsReadModule } from '../operations/trips-read.module';
import { MessagesService } from './messages.service';
import { NotificationsService } from './notifications.service';
import { CommunicationController } from './communication.controller';
@Module({
  imports: [TripsReadModule],
  providers: [MessagesService, NotificationsService],
  controllers: [CommunicationController],
  exports: [MessagesService, NotificationsService],
})
export class CommunicationModule {}
