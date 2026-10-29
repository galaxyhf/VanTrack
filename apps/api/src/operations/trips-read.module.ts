import { Module } from '@nestjs/common';
import { TripsRepository } from './trips.repository';
@Module({ providers: [TripsRepository], exports: [TripsRepository] })
export class TripsReadModule {}
