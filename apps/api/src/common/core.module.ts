import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { EventsService } from './events.service';
@Global()
@Module({ providers: [DatabaseService, EventsService], exports: [DatabaseService, EventsService] })
export class CoreModule {}
