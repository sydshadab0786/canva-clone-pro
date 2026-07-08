import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { AppConfig } from '../../common/config/configuration';
import { JwtPayload } from '../auth/token.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { colorForUser, PresenceRegistry, type Participant } from './presence.registry';

interface SocketUser {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

const roomOf = (projectId: string) => `project:${projectId}`;

/**
 * Real-time collaboration gateway (Socket.io namespace `/collab`).
 *
 * Auth: the client passes its access token in the handshake (`auth.token`); we
 * verify it exactly like the HTTP JwtStrategy. Unauthenticated sockets are
 * disconnected. Presence is tracked per project room; cursor moves and scene
 * ops are relayed to the other participants (last-write-wins at this layer —
 * CRDT/OT is a later refinement).
 */
@WebSocketGateway({ namespace: '/collab', cors: { origin: true, credentials: true } })
export class CollabGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(CollabGateway.name);
  private readonly registry = new PresenceRegistry();

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<AppConfig, true>,
    private readonly prisma: PrismaService,
  ) {}

  // ── Connection lifecycle ─────────────────────────────────────────
  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.extractToken(client);
      const secret = this.config.get('jwt', { infer: true }).accessSecret;
      const payload = this.jwt.verify<JwtPayload>(token, { secret });
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, displayName: true, avatarUrl: true },
      });
      if (!user) throw new Error('user not found');
      (client.data as { user?: SocketUser }).user = user;
    } catch {
      client.emit('error', { message: 'Unauthorized' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    const left = this.registry.leaveSocket(client.id);
    if (left) {
      this.server.to(left.room).emit('presence:leave', { userId: left.participant.userId });
      this.broadcastPresence(left.room);
    }
  }

  private extractToken(client: Socket): string {
    const auth = client.handshake.auth as { token?: string } | undefined;
    if (auth?.token) return auth.token;
    const header = client.handshake.headers.authorization;
    if (header?.startsWith('Bearer ')) return header.slice(7);
    throw new Error('missing token');
  }

  private user(client: Socket): SocketUser | undefined {
    return (client.data as { user?: SocketUser }).user;
  }

  private broadcastPresence(room: string): void {
    this.server.to(room).emit('presence:state', this.registry.uniqueUsers(room));
  }

  // ── Rooms / presence ─────────────────────────────────────────────
  @SubscribeMessage('project:join')
  onJoin(client: Socket, payload: { projectId: string }): void {
    const user = this.user(client);
    if (!user || !payload?.projectId) return;
    const room = roomOf(payload.projectId);
    void client.join(room);
    const participant: Participant = {
      socketId: client.id,
      userId: user.id,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      color: colorForUser(user.id),
    };
    this.registry.join(room, participant);
    client.to(room).emit('presence:join', participant);
    this.broadcastPresence(room);
  }

  @SubscribeMessage('project:leave')
  onLeave(client: Socket): void {
    const left = this.registry.leaveSocket(client.id);
    if (left) {
      void client.leave(left.room);
      this.server.to(left.room).emit('presence:leave', { userId: left.participant.userId });
      this.broadcastPresence(left.room);
    }
  }

  // ── Live cursor ──────────────────────────────────────────────────
  @SubscribeMessage('cursor:move')
  onCursor(client: Socket, payload: { x: number; y: number }): void {
    const user = this.user(client);
    const room = this.registry.roomOf(client.id);
    if (!user || !room) return;
    client.to(room).emit('cursor:move', {
      userId: user.id,
      displayName: user.displayName,
      color: colorForUser(user.id),
      x: payload.x,
      y: payload.y,
    });
  }

  // ── Scene operations (relayed to peers) ──────────────────────────
  @SubscribeMessage('scene:op')
  onSceneOp(client: Socket, payload: unknown): void {
    const user = this.user(client);
    const room = this.registry.roomOf(client.id);
    if (!user || !room) return;
    client.to(room).emit('scene:op', { by: user.id, op: payload });
  }

  // ── Comments (relayed for instant appearance) ────────────────────
  @SubscribeMessage('comment:new')
  onComment(client: Socket, payload: unknown): void {
    const room = this.registry.roomOf(client.id);
    if (!room) return;
    client.to(room).emit('comment:new', payload);
  }
}
