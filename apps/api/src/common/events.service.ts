import { Injectable } from '@nestjs/common';
import type { Server } from 'socket.io';
@Injectable()
export class EventsService {
  server?: Server;
  disconnectSession(id: string) {
    this.server?.in(`session:${id}`).disconnectSockets(true);
  }
  disconnectUser(id: string) {
    this.server?.in(`user:${id}`).disconnectSockets(true);
  }
  leaveTrip(userId: string, tripId: string) {
    this.server?.in(`user:${userId}`).socketsLeave(`trip:${tripId}`);
  }
  trip(id: string, event: string, data: unknown) {
    this.server?.to(`trip:${id}`).emit(event, data);
  }
  user(id: string, event: string, data: unknown) {
    this.server?.to(`user:${id}`).emit(event, data);
  }
}
