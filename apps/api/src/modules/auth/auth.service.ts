import { createHash, randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { AuditAction, UserStatus, VerificationTokenType } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TokenService, TokenPair } from './token.service';
import { TwoFactorService } from './two-factor.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';

export interface RequestContext {
  userAgent?: string;
  ipAddress?: string;
}

export interface AuthResult {
  user: { id: string; email: string; displayName: string; role: string };
  tokens: TokenPair;
}

// Dummy argon2 hash used to equalise timing when an email is unknown.
const DUMMY_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHR2YWx1ZQ$3b1Y0Zx1qJ7m9k5xq1n2b3c4d5e6f7g8h9i0j1k2l3m';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly twoFactor: TwoFactorService,
  ) {}

  // ── Helpers ──────────────────────────────────────────────────────

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async createVerificationToken(
    userId: string,
    type: VerificationTokenType,
    ttlSeconds: number,
  ): Promise<string> {
    const raw = randomBytes(32).toString('base64url');
    await this.prisma.verificationToken.create({
      data: {
        userId,
        type,
        tokenHash: this.hashToken(raw),
        expiresAt: new Date(Date.now() + ttlSeconds * 1000),
      },
    });
    return raw;
  }

  private async audit(
    action: AuditAction,
    userId: string | null,
    ctx: RequestContext,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        action,
        userId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        metadata: metadata ?? undefined,
      },
    });
  }

  // ── Registration ────────────────────────────────────────────────

  async register(
    dto: RegisterDto,
    ctx: RequestContext,
  ): Promise<AuthResult & { verificationToken: string }> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        displayName: dto.displayName,
        status: UserStatus.PENDING,
      },
    });

    // In production this token is emailed; we return it so the flow is
    // testable end-to-end without a live SMTP server.
    const verificationToken = await this.createVerificationToken(
      user.id,
      VerificationTokenType.EMAIL_VERIFICATION,
      60 * 60 * 24,
    );

    await this.audit(AuditAction.USER_REGISTERED, user.id, ctx);
    const tokens = await this.tokens.issueTokens(user, ctx);

    return {
      user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role },
      tokens,
      verificationToken,
    };
  }

  // ── Login ────────────────────────────────────────────────────────

  async login(dto: LoginDto, ctx: RequestContext): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    // Verify against a dummy hash when the user is missing to avoid leaking
    // which emails are registered via response timing.
    const hash = user?.passwordHash ?? DUMMY_HASH;
    const passwordValid = await argon2.verify(hash, dto.password).catch(() => false);

    if (!user || !user.passwordHash || !passwordValid) {
      await this.audit(AuditAction.USER_LOGIN_FAILED, user?.id ?? null, ctx, { email: dto.email });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status === UserStatus.SUSPENDED || user.status === UserStatus.DEACTIVATED) {
      throw new UnauthorizedException('Account is not active');
    }

    if (user.twoFactorEnabled) {
      if (!dto.twoFactorCode) {
        throw new UnauthorizedException('TWO_FACTOR_REQUIRED');
      }
      const ok = user.twoFactorSecret
        ? this.twoFactor.verify(dto.twoFactorCode, user.twoFactorSecret)
        : false;
      if (!ok && !(await this.consumeBackupCode(user.id, dto.twoFactorCode))) {
        throw new UnauthorizedException('Invalid two-factor code');
      }
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await this.audit(AuditAction.USER_LOGIN, user.id, ctx);

    const tokens = await this.tokens.issueTokens(user, ctx);
    return {
      user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role },
      tokens,
    };
  }

  private async consumeBackupCode(userId: string, code: string): Promise<boolean> {
    const hash = this.twoFactor.hashCode(code);
    const match = await this.prisma.backupCode.findFirst({
      where: { userId, codeHash: hash, usedAt: null },
    });
    if (!match) return false;
    await this.prisma.backupCode.update({ where: { id: match.id }, data: { usedAt: new Date() } });
    return true;
  }

  // ── Token lifecycle ──────────────────────────────────────────────

  async refresh(refreshToken: string, ctx: RequestContext): Promise<TokenPair> {
    const pair = await this.tokens.rotate(refreshToken, ctx);
    if (!pair) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    return pair;
  }

  async logout(refreshToken: string): Promise<void> {
    await this.tokens.revoke(refreshToken);
  }

  // ── Email verification ───────────────────────────────────────────

  async verifyEmail(token: string): Promise<void> {
    const record = await this.prisma.verificationToken.findUnique({
      where: { tokenHash: this.hashToken(token) },
    });
    if (
      !record ||
      record.usedAt ||
      record.expiresAt < new Date() ||
      record.type !== VerificationTokenType.EMAIL_VERIFICATION
    ) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: new Date(), status: UserStatus.ACTIVE },
      }),
      this.prisma.verificationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);
    await this.audit(AuditAction.EMAIL_VERIFIED, record.userId, {});
  }

  // ── Password reset ───────────────────────────────────────────────

  async requestPasswordReset(email: string, ctx: RequestContext): Promise<string | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return null; // Do not reveal whether the email exists.

    const token = await this.createVerificationToken(
      user.id,
      VerificationTokenType.PASSWORD_RESET,
      60 * 30,
    );
    await this.audit(AuditAction.PASSWORD_RESET_REQUESTED, user.id, ctx);
    return token;
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const record = await this.prisma.verificationToken.findUnique({
      where: { tokenHash: this.hashToken(token) },
    });
    if (
      !record ||
      record.usedAt ||
      record.expiresAt < new Date() ||
      record.type !== VerificationTokenType.PASSWORD_RESET
    ) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await argon2.hash(newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      this.prisma.verificationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);
    // Invalidate all sessions after a password change.
    await this.tokens.revokeAllForUser(record.userId);
    await this.audit(AuditAction.PASSWORD_CHANGED, record.userId, {});
  }

  // ── Two-factor setup ─────────────────────────────────────────────

  async beginTwoFactorSetup(userId: string, email: string) {
    const secret = this.twoFactor.generateSecret();
    // Store provisional secret; only "enabled" after confirmation.
    await this.prisma.user.update({ where: { id: userId }, data: { twoFactorSecret: secret } });
    return this.twoFactor.buildKeyUri(email, secret);
  }

  async confirmTwoFactor(userId: string, code: string, ctx: RequestContext): Promise<string[]> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.twoFactorSecret) {
      throw new BadRequestException('Two-factor setup was not started');
    }
    if (!this.twoFactor.verify(code, user.twoFactorSecret)) {
      throw new BadRequestException('Invalid two-factor code');
    }

    const { plaintext, hashes } = this.twoFactor.generateBackupCodes();
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: true } }),
      this.prisma.backupCode.deleteMany({ where: { userId } }),
      this.prisma.backupCode.createMany({ data: hashes.map((codeHash) => ({ userId, codeHash })) }),
    ]);
    await this.audit(AuditAction.TWO_FACTOR_ENABLED, userId, ctx);
    return plaintext;
  }

  async disableTwoFactor(userId: string, ctx: RequestContext): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { twoFactorEnabled: false, twoFactorSecret: null },
      }),
      this.prisma.backupCode.deleteMany({ where: { userId } }),
    ]);
    await this.audit(AuditAction.TWO_FACTOR_DISABLED, userId, ctx);
  }
}
