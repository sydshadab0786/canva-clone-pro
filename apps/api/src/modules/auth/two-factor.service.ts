import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { AppConfig } from '../../common/config/configuration';

/**
 * TOTP-based two-factor authentication (RFC 6238), compatible with
 * Google Authenticator / Authy / 1Password.
 *
 * NOTE: in production the secret should be encrypted at rest (e.g. via a
 * KMS-backed envelope) before being stored on User.twoFactorSecret. The
 * encryption boundary is intentionally isolated to this service.
 */
@Injectable()
export class TwoFactorService {
  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  generateSecret(): string {
    return authenticator.generateSecret();
  }

  /** otpauth:// URI + data-URL QR the client renders during setup. */
  async buildKeyUri(
    email: string,
    secret: string,
  ): Promise<{ otpauthUrl: string; qrDataUrl: string }> {
    const issuer = this.config.get('twoFactor', { infer: true }).issuer;
    const otpauthUrl = authenticator.keyuri(email, issuer, secret);
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl);
    return { otpauthUrl, qrDataUrl };
  }

  verify(code: string, secret: string): boolean {
    return authenticator.verify({ token: code, secret });
  }

  /** Generate N recovery codes; return plaintext (shown once) + hashes to store. */
  generateBackupCodes(count = 10): { plaintext: string[]; hashes: string[] } {
    const plaintext: string[] = [];
    const hashes: string[] = [];
    for (let i = 0; i < count; i += 1) {
      const code = randomBytes(5).toString('hex'); // 10 hex chars
      plaintext.push(code);
      hashes.push(this.hashCode(code));
    }
    return { plaintext, hashes };
  }

  hashCode(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }
}
