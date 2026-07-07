import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppConfig } from '../../common/config/configuration';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Issues and rotates JWT access + opaque refresh tokens.
 *
 * Refresh tokens are random 384-bit strings; only their SHA-256 hash is
 * persisted (Session.refreshTokenHash). On refresh we rotate: the old
 * session row is revoked and a new one issued, so a stolen-and-replayed
 * refresh token is detectable (reuse of a revoked token → force logout).
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<AppConfig, true>,
    private readonly prisma: PrismaService,
  ) {}

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private signAccessToken(user: Pick<User, 'id' | 'email' | 'role'>): string {
    const jwtCfg = this.config.get('jwt', { infer: true });
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    return this.jwt.sign(payload, { secret: jwtCfg.accessSecret, expiresIn: jwtCfg.accessTtl });
  }

  /** Create a fresh access+refresh pair and persist the refresh session. */
  async issueTokens(
    user: Pick<User, 'id' | 'email' | 'role'>,
    context: { userAgent?: string; ipAddress?: string } = {},
  ): Promise<TokenPair> {
    const jwtCfg = this.config.get('jwt', { infer: true });
    const accessToken = this.signAccessToken(user);
    const refreshToken = randomBytes(48).toString('base64url');

    await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: this.hash(refreshToken),
        userAgent: context.userAgent,
        ipAddress: context.ipAddress,
        expiresAt: new Date(Date.now() + jwtCfg.refreshTtl * 1000),
      },
    });

    return { accessToken, refreshToken, expiresIn: jwtCfg.accessTtl };
  }

  /**
   * Rotate a refresh token. Returns a new pair, or null if the token is
   * unknown / expired / already revoked (caller returns 401).
   */
  async rotate(
    refreshToken: string,
    context: { userAgent?: string; ipAddress?: string } = {},
  ): Promise<TokenPair | null> {
    const session = await this.prisma.session.findUnique({
      where: { refreshTokenHash: this.hash(refreshToken) },
      include: { user: true },
    });

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      // Reuse of a revoked token is a red flag — revoke all sessions.
      if (session?.revokedAt) {
        await this.revokeAllForUser(session.userId);
      }
      return null;
    }

    await this.prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(session.user, context);
  }

  /** Revoke a single refresh session (logout on one device). */
  async revoke(refreshToken: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { refreshTokenHash: this.hash(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Revoke every active session for a user (logout everywhere). */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
