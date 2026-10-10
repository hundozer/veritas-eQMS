import { describe, expect, it } from 'vitest';
import { base32Decode, base32Encode, generateTotpSecret, otpauthUri, totpCode, verifyTotp } from './totp';

// RFC 6238 appendix B, SHA-1 secret "12345678901234567890".
const rfcSecret = Buffer.from('12345678901234567890');

describe('time-based one-time codes', () => {
  it('MFA-T001 matches the RFC 6238 test vectors', () => {
    expect(totpCode(rfcSecret, Math.floor(59 / 30), 8)).toBe('94287082');
    expect(totpCode(rfcSecret, Math.floor(1111111109 / 30), 8)).toBe('07081804');
    expect(totpCode(rfcSecret, Math.floor(1234567890 / 30), 8)).toBe('89005924');
    expect(totpCode(rfcSecret, Math.floor(2000000000 / 30), 8)).toBe('69279037');
  });

  it('MFA-T002 accepts the current code and one step either side, nothing older or malformed', () => {
    const secret = base32Encode(rfcSecret);
    const at = 1111111109 * 1000;
    const code = (seconds: number) => totpCode(rfcSecret, Math.floor(seconds / 30));
    expect(verifyTotp(secret, code(1111111109), at)).toBe(Math.floor(1111111109 / 30));
    expect(verifyTotp(secret, code(1111111109 - 30), at)).not.toBeNull();
    expect(verifyTotp(secret, code(1111111109 + 30), at)).not.toBeNull();
    expect(verifyTotp(secret, code(1111111109 - 90), at)).toBeNull();
    for (const bad of ['', '12345', '1234567', 'abcdef', 123456, null]) expect(verifyTotp(secret, bad, at)).toBeNull();
  });

  it('MFA-T003 secrets are 160-bit base32 and round-trip; the setup link names issuer and account', () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Decode(secret)).toHaveLength(20);
    expect(base32Encode(base32Decode(secret))).toBe(secret);
    expect(otpauthUri(secret, 'qa@example.invalid')).toBe(
      `otpauth://totp/Simpleafied%20Veritas%3Aqa%40example.invalid?secret=${secret}&issuer=Simpleafied+Veritas&algorithm=SHA1&digits=6&period=30`,
    );
  });
});
