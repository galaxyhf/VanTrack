import { Inject } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  OnGatewayConnection,
  WsException,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { parse as parseCookie } from 'cookie';
import { z } from 'zod';
import { idSchema, locationSchema, messageSchema } from '@vantrack/shared';
import { AuthService } from '../auth/auth.service';
import { TripsRepository } from '../operations/trips.repository';
import { EventsService } from '../common/events.service';
import { MessagesService } from '../communication/messages.service';
import { TrackingService } from './tracking.service';
import { env } from '../common/env';
@WebSocketGateway({
  cors: { origin: env.WEB_ORIGIN, credentials: true },
  maxHttpBufferSize: 8192,
  transports: ['websocket'],
  allowRequest: (req, callback) => callback(null, req.headers.origin === env.WEB_ORIGIN),
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection {
  @WebSocketServer() server!: Server;
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(TripsRepository) private readonly trips: TripsRepository,
    @Inject(EventsService) private readonly events: EventsService,
    @Inject(TrackingService) private readonly tracking: TrackingService,
    @Inject(MessagesService) private readonly messages: MessagesService,
  ) {}
  afterInit(server: Server) {
    this.events.server = server;
    server.use(async (socket, next) => {
      try {
        await this.principal(socket);
        next();
      } catch {
        next(new Error('Não autorizado'));
      }
    });
  }
  private async principal(socket: Socket) {
    const cookies = parseCookie(socket.handshake.headers.cookie ?? '');
    return this.auth.authenticate(cookies.vt_access ?? '');
  }
  async handleConnection(socket: Socket) {
    try {
      const user = await this.principal(socket);
      await socket.join(`user:${user.id}`);
      await socket.join(`session:${user.sessionId}`);
      const expires = setTimeout(() => socket.disconnect(true), 15 * 60000);
      socket.on('disconnect', () => clearTimeout(expires));
    } catch {
      socket.disconnect(true);
    }
  }
  private rate(socket: Socket) {
    const now = Date.now();
    if (!socket.data.window || now - socket.data.window > 60000) {
      socket.data.window = now;
      socket.data.count = 0;
    }
    if (++socket.data.count > 100) throw new WsException('Muitas atualizações');
  }
  @SubscribeMessage('trip:join') async join(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: unknown,
  ) {
    try {
      this.rate(socket);
      const id = z.object({ tripId: idSchema }).parse(body).tripId;
      const user = await this.principal(socket);
      await this.trips.authorize(user, id);
      for (const room of socket.rooms) if (room.startsWith('trip:')) await socket.leave(room);
      await socket.join(`trip:${id}`);
      return { ok: true };
    } catch {
      throw new WsException('Acesso à viagem negado');
    }
  }
  @SubscribeMessage('vehicle:location') async location(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: unknown,
  ) {
    try {
      this.rate(socket);
      return await this.tracking.record(await this.principal(socket), locationSchema.parse(body));
    } catch {
      throw new WsException('Localização não aceita');
    }
  }
  @SubscribeMessage('trip:message') async message(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: unknown,
  ) {
    try {
      this.rate(socket);
      const data = messageSchema.extend({ tripId: idSchema }).parse(body);
      return await this.messages.send(await this.principal(socket), data.tripId, data);
    } catch {
      throw new WsException('Mensagem não aceita');
    }
  }
}
