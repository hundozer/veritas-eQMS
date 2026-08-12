import 'server-only';

import argon2 from 'argon2';

// OWASP's interactive-login Argon2id profile: 19 MiB, two iterations, one lane.
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

const ARGON2ID_PATTERN =
  /^\$argon2id\$v=19\$m=\d+,p=\d+,t=\d+\$[A-Za-z0-9+/]+={0,2}\$[A-Za-z0-9+/]+={0,2}$/;

function isSupportedArgon2idHash(encodedHash: unknown): encodedHash is string {
  return typeof encodedHash === 'string' && ARGON2ID_PATTERN.test(encodedHash);
}

export async function hashPassword(plaintextPassword: string): Promise<string> {
  if (typeof plaintextPassword !== 'string' || plaintextPassword.length === 0) {
    throw new TypeError('A non-empty password is required');
  }

  return argon2.hash(plaintextPassword, ARGON2_OPTIONS);
}

export async function verifyPassword(
  plaintextPassword: string,
  encodedHash: string,
): Promise<boolean> {
  if (typeof plaintextPassword !== 'string' || !isSupportedArgon2idHash(encodedHash)) {
    return false;
  }

  try {
    return await argon2.verify(encodedHash, plaintextPassword);
  } catch {
    return false;
  }
}

export function passwordNeedsRehash(encodedHash: string): boolean {
  if (!isSupportedArgon2idHash(encodedHash)) {
    return true;
  }

  try {
    return argon2.needsRehash(encodedHash, ARGON2_OPTIONS);
  } catch {
    return true;
  }
}
