import { describe, expect, it } from 'vitest';
import { authenticator } from 'otplib';
import { TwoFactorService } from './two-factor.service';

// Minimal ConfigService stub — only twoFactor.issuer is read.
const configStub = { get: () => ({ issuer: 'CanvaClonePro' }) } as never;

describe('TwoFactorService', () => {
  const service = new TwoFactorService(configStub);

  it('generates a usable TOTP secret and verifies a valid code', () => {
    const secret = service.generateSecret();
    const code = authenticator.generate(secret);
    expect(service.verify(code, secret)).toBe(true);
  });

  it('rejects an invalid TOTP code', () => {
    const secret = service.generateSecret();
    expect(service.verify('000000', secret)).toBe(false);
  });

  it('produces unique backup codes with matching hashes', () => {
    const { plaintext, hashes } = service.generateBackupCodes(8);
    expect(plaintext).toHaveLength(8);
    expect(new Set(plaintext).size).toBe(8);
    plaintext.forEach((code, i) => {
      expect(service.hashCode(code)).toBe(hashes[i]);
    });
  });

  it('builds an otpauth key URI and a QR data URL', async () => {
    const secret = service.generateSecret();
    const { otpauthUrl, qrDataUrl } = await service.buildKeyUri('jane@example.com', secret);
    expect(otpauthUrl).toContain('otpauth://totp/');
    expect(otpauthUrl).toContain('CanvaClonePro');
    expect(qrDataUrl.startsWith('data:image/png;base64,')).toBe(true);
  });
});
