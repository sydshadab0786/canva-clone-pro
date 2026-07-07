import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import { TokenService } from './token.service';

const jwtCfg = {
  accessSecret: 'test_access',
  accessTtl: 900,
  refreshSecret: 'test_refresh',
  refreshTtl: 1_209_600,
};
const configStub = { get: () => jwtCfg } as never;

interface SessionRow {
  id: string;
  userId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  user: { id: string; email: string; role: string };
}

// Minimal in-memory stand-in for the parts of PrismaService TokenService uses.
function makeFakePrisma() {
  const rows: SessionRow[] = [];
  let seq = 0;
  const user = { id: 'u1', email: 'jane@example.com', role: 'USER' };
  return {
    rows,
    session: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row: SessionRow = {
          id: `s${(seq += 1)}`,
          userId: data.userId as string,
          refreshTokenHash: data.refreshTokenHash as string,
          expiresAt: data.expiresAt as Date,
          revokedAt: null,
          user,
        };
        rows.push(row);
        return row;
      },
      findUnique: async ({ where }: { where: { refreshTokenHash: string } }) =>
        rows.find((r) => r.refreshTokenHash === where.refreshTokenHash) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = rows.find((r) => r.id === where.id)!;
        Object.assign(row, data);
        return row;
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: { refreshTokenHash?: string; userId?: string; revokedAt?: null };
        data: Record<string, unknown>;
      }) => {
        let count = 0;
        for (const row of rows) {
          if (where.refreshTokenHash && row.refreshTokenHash !== where.refreshTokenHash) continue;
          if (where.userId && row.userId !== where.userId) continue;
          if (where.revokedAt === null && row.revokedAt !== null) continue;
          Object.assign(row, data);
          count += 1;
        }
        return { count };
      },
    },
  };
}

const hash = (t: string) => createHash('sha256').update(t).digest('hex');
const user = { id: 'u1', email: 'jane@example.com', role: 'USER' };

describe('TokenService', () => {
  let prisma: ReturnType<typeof makeFakePrisma>;
  let service: TokenService;

  beforeEach(() => {
    prisma = makeFakePrisma();
    service = new TokenService(new JwtService({}), configStub, prisma as never);
  });

  it('issues an access token and persists a hashed refresh session', async () => {
    const pair = await service.issueTokens(user);
    expect(pair.accessToken.split('.')).toHaveLength(3); // JWT
    expect(pair.expiresIn).toBe(900);
    expect(prisma.rows).toHaveLength(1);
    // Raw refresh token is never stored — only its hash.
    expect(prisma.rows[0]!.refreshTokenHash).toBe(hash(pair.refreshToken));
    expect(prisma.rows[0]!.refreshTokenHash).not.toBe(pair.refreshToken);
  });

  it('rotates a valid refresh token, revoking the old session', async () => {
    const first = await service.issueTokens(user);
    const rotated = await service.rotate(first.refreshToken);
    expect(rotated).not.toBeNull();
    expect(rotated!.refreshToken).not.toBe(first.refreshToken);
    const old = prisma.rows.find((r) => r.refreshTokenHash === hash(first.refreshToken))!;
    expect(old.revokedAt).not.toBeNull();
    expect(prisma.rows).toHaveLength(2);
  });

  it('returns null for an unknown refresh token', async () => {
    expect(await service.rotate('does-not-exist')).toBeNull();
  });

  it('detects reuse of a revoked token and revokes all user sessions', async () => {
    const first = await service.issueTokens(user);
    await service.rotate(first.refreshToken); // consumes + revokes `first`
    const replay = await service.rotate(first.refreshToken);
    expect(replay).toBeNull();
    expect(prisma.rows.every((r) => r.revokedAt !== null)).toBe(true);
  });
});
