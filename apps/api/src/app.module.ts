import { Module, Controller, Get, Inject } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { sql } from 'drizzle-orm';
import { DatabaseService } from './common/database.service';
import { AuthGuard, Public } from './auth/auth.guard';
import { CoreModule } from './common/core.module';
import { AuthModule } from './auth/auth.module';
import { OperationsModule } from './operations/operations.module';
import { ReservationsModule } from './reservations/reservations.module';
import { CommunicationModule } from './communication/communication.module';
import { TrackingModule } from './tracking/tracking.module';
import { AdminModule } from './admin/admin.module';
@Controller('health')
class HealthController {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}
  @Public() @Get() async health() {
    await this.database.db.execute(sql`select 1`);
    return { status: 'ok' };
  }
}
@Module({
  imports: [
    CoreModule,
    AuthModule,
    OperationsModule,
    ReservationsModule,
    CommunicationModule,
    TrackingModule,
    AdminModule,
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
