import { Inject, Injectable } from '@nestjs/common';
import { notifications } from '@vantrack/database';
import { DatabaseService } from '../common/database.service';
import { EventsService } from '../common/events.service';
import { TripsRepository } from '../operations/trips.repository';
@Injectable()
export class NotificationsService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(EventsService) private readonly events: EventsService,
    @Inject(TripsRepository) private readonly trips: TripsRepository,
  ) {}
  async send(userId: string, type: string, title: string, content: string, tripId?: string) {
    const [n] = await this.database.db
      .insert(notifications)
      .values({ userId, type, title, content, tripId })
      .returning();
    this.events.user(userId, 'notification:new', n);
    return n;
  }
  async trip(id: string, type: string, title: string, content: string) {
    for (const user of await this.trips.participants(id))
      await this.send(user, type, title, content, id);
  }
}
