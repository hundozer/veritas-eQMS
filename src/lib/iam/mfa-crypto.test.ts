import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { decryptMfaSecret, encryptMfaSecret, MfaNotConfiguredError, readPendingSignIn, signPendingSignIn } from './mfa-crypto';

const KEY = Buffer.alloc(32, 7).toString('base64');
const pending = { iamUserId: 'iam-1', membershipId: 'membership-1', tenantId: 'tenant-1', enrolling: false };

describe('two-step verification keys', () => {
  beforeEach(() => { process.env.MFA_ENCRYPTION_KEY = KEY; });
  afterEach(() => { delete process.env.MFA_ENCRYPTION_KEY; });

  it('MFA-T004 secrets are stored encrypted and only this key reads them back', () => {
    const stored = encryptMfaSecret('JBSWY3DPEHPK3PXP');
    expect(stored).not.toContain('JBSWY3DPEHPK3PXP');
    expect(stored).not.toBe(encryptMfaSecret('JBSWY3DPEHPK3PXP'));
    expect(decryptMfaSecret(stored)).toBe('JBSWY3DPEHPK3PXP');
    expect(decryptMfaSecret('JBSWY3DPEHPK3PXP')).toBeNull();
    expect(decryptMfaSecret(null)).toBeNull();
    process.env.MFA_ENCRYPTION_KEY = Buffer.alloc(32, 8).toString('base64');
    expect(decryptMfaSecret(stored)).toBeNull();
  });

  it('MFA-T005 the pending sign-in token is signed and expires after five minutes', () => {
    const now = Date.UTC(2026, 9, 10, 8);
    const token = signPendingSignIn(pending, now);
    expect(readPendingSignIn(token, now)).toMatchObject(pending);
    expect(readPendingSignIn(token, now + 5 * 60 * 1000)).toBeNull();
    const [payload, signature] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ ...pending, iamUserId: 'iam-2', expiresAt: now + 60_000 })).toString('base64url');
    expect(readPendingSignIn(`${forged}.${signature}`, now)).toBeNull();
    expect(readPendingSignIn(`${payload}.`, now)).toBeNull();
    expect(readPendingSignIn(undefined, now)).toBeNull();
  });

  it('MFA-T006 without a 32-byte key nothing is encrypted or signed: sign-in fails closed', () => {
    for (const value of [undefined, '', Buffer.alloc(16).toString('base64')]) {
      if (value === undefined) delete process.env.MFA_ENCRYPTION_KEY; else process.env.MFA_ENCRYPTION_KEY = value;
      expect(() => encryptMfaSecret('x')).toThrow(MfaNotConfiguredError);
      expect(() => signPendingSignIn(pending)).toThrow(MfaNotConfiguredError);
    }
  });
});
