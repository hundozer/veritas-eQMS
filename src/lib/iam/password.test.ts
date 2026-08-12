import argon2 from 'argon2';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { hashPassword, passwordNeedsRehash, verifyPassword } from './password';

describe('IAM Argon2id password utility', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('PASSWORD-T001: produces a standard encoded Argon2id credential', async () => {
    const encodedHash = await hashPassword('correct horse battery staple');

    expect(encodedHash).toMatch(/^\$argon2id\$v=19\$m=19456,p=1,t=2\$/);
  });

  it('PASSWORD-T002: verifies the correct password', async () => {
    const encodedHash = await hashPassword('valid password');

    await expect(verifyPassword('valid password', encodedHash)).resolves.toBe(true);
  });

  it('PASSWORD-T003: returns false for the wrong password', async () => {
    const encodedHash = await hashPassword('valid password');

    await expect(verifyPassword('wrong password', encodedHash)).resolves.toBe(false);
  });

  it('PASSWORD-T004: uses a unique random salt for each hash', async () => {
    const first = await hashPassword('same password');
    const second = await hashPassword('same password');

    expect(first).not.toBe(second);
  });

  it('PASSWORD-T005: rejects an empty password for hashing', async () => {
    await expect(hashPassword('')).rejects.toThrow('A non-empty password is required');
  });

  it('PASSWORD-T006: safely rejects a malformed stored hash', async () => {
    await expect(verifyPassword('password', '$argon2id$malformed')).resolves.toBe(false);
  });

  it('PASSWORD-T007: safely rejects an unknown legacy credential', async () => {
    await expect(verifyPassword('password', 'unknown-legacy-credential')).resolves.toBe(false);
  });

  it('PASSWORD-T008: rejects non-Argon2id encoded credentials', async () => {
    const argon2iHash = await argon2.hash('password', {
      type: argon2.argon2i,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    });

    await expect(verifyPassword('password', argon2iHash)).resolves.toBe(false);
  });

  it('PASSWORD-T009: never writes password or hash values to logs', async () => {
    const spies = [
      vi.spyOn(console, 'log').mockImplementation(() => undefined),
      vi.spyOn(console, 'info').mockImplementation(() => undefined),
      vi.spyOn(console, 'warn').mockImplementation(() => undefined),
      vi.spyOn(console, 'error').mockImplementation(() => undefined),
      vi.spyOn(console, 'debug').mockImplementation(() => undefined),
    ];
    const encodedHash = await hashPassword('log-safety-password');
    await verifyPassword('log-safety-password', encodedHash);

    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });

  it('PASSWORD-T010: detects current and weaker parameter profiles', async () => {
    const currentHash = await hashPassword('rehash test');
    const weakerHash = await argon2.hash('rehash test', {
      type: argon2.argon2id,
      memoryCost: 12_288,
      timeCost: 1,
      parallelism: 1,
    });

    expect(passwordNeedsRehash(currentHash)).toBe(false);
    expect(passwordNeedsRehash(weakerHash)).toBe(true);
    expect(passwordNeedsRehash('unknown-legacy-credential')).toBe(true);
  });
});
