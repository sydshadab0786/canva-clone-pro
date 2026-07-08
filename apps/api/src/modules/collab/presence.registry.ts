/**
 * In-memory presence tracking for real-time collaboration rooms (one room per
 * project). Pure and side-effect free so it is directly unit-tested.
 *
 * For a single API instance this is the source of truth. To scale horizontally
 * you'd back the room membership with the Redis Socket.io adapter + a shared
 * store; the gateway talks to this class through a stable interface so that
 * swap is contained.
 */
export interface Participant {
  socketId: string;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  color: string;
}

// Distinct, pleasant cursor colours assigned round-robin per user.
const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];

export function colorForUser(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  return COLORS[hash % COLORS.length]!;
}

export class PresenceRegistry {
  private readonly rooms = new Map<string, Map<string, Participant>>();
  private readonly socketRoom = new Map<string, string>();

  join(room: string, participant: Participant): void {
    // A socket only ever belongs to one room; leave the previous one first.
    this.leaveSocket(participant.socketId);
    if (!this.rooms.has(room)) this.rooms.set(room, new Map());
    this.rooms.get(room)!.set(participant.socketId, participant);
    this.socketRoom.set(participant.socketId, room);
  }

  leaveSocket(socketId: string): { room: string; participant: Participant } | null {
    const room = this.socketRoom.get(socketId);
    if (!room) return null;
    const members = this.rooms.get(room);
    const participant = members?.get(socketId) ?? null;
    members?.delete(socketId);
    if (members && members.size === 0) this.rooms.delete(room);
    this.socketRoom.delete(socketId);
    return participant ? { room, participant } : null;
  }

  participants(room: string): Participant[] {
    return [...(this.rooms.get(room)?.values() ?? [])];
  }

  /** Distinct users in a room (a user may have multiple sockets/tabs). */
  uniqueUsers(room: string): Participant[] {
    const seen = new Map<string, Participant>();
    for (const p of this.participants(room)) if (!seen.has(p.userId)) seen.set(p.userId, p);
    return [...seen.values()];
  }

  count(room: string): number {
    return this.rooms.get(room)?.size ?? 0;
  }

  roomOf(socketId: string): string | undefined {
    return this.socketRoom.get(socketId);
  }
}
