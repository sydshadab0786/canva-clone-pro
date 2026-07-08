import { describe, expect, it } from 'vitest';
import { colorForUser, PresenceRegistry, type Participant } from './presence.registry';

const p = (socketId: string, userId: string): Participant => ({
  socketId,
  userId,
  displayName: userId,
  avatarUrl: null,
  color: colorForUser(userId),
});

describe('PresenceRegistry', () => {
  it('tracks participants joining a room', () => {
    const r = new PresenceRegistry();
    r.join('proj1', p('s1', 'u1'));
    r.join('proj1', p('s2', 'u2'));
    expect(r.count('proj1')).toBe(2);
    expect(r.participants('proj1').map((x) => x.userId).sort()).toEqual(['u1', 'u2']);
  });

  it('removes a socket and cleans up empty rooms', () => {
    const r = new PresenceRegistry();
    r.join('proj1', p('s1', 'u1'));
    const left = r.leaveSocket('s1');
    expect(left?.room).toBe('proj1');
    expect(left?.participant.userId).toBe('u1');
    expect(r.count('proj1')).toBe(0);
    expect(r.roomOf('s1')).toBeUndefined();
  });

  it('moves a socket to a new room on re-join', () => {
    const r = new PresenceRegistry();
    r.join('proj1', p('s1', 'u1'));
    r.join('proj2', p('s1', 'u1'));
    expect(r.count('proj1')).toBe(0);
    expect(r.count('proj2')).toBe(1);
    expect(r.roomOf('s1')).toBe('proj2');
  });

  it('dedupes users with multiple tabs in uniqueUsers', () => {
    const r = new PresenceRegistry();
    r.join('proj1', p('s1', 'u1'));
    r.join('proj1', p('s2', 'u1')); // same user, second tab
    r.join('proj1', p('s3', 'u2'));
    expect(r.count('proj1')).toBe(3);
    expect(r.uniqueUsers('proj1').map((x) => x.userId).sort()).toEqual(['u1', 'u2']);
  });

  it('assigns a stable colour per user', () => {
    expect(colorForUser('user-abc')).toBe(colorForUser('user-abc'));
    expect(colorForUser('user-abc')).toMatch(/^#[0-9a-f]{6}$/);
  });
});
