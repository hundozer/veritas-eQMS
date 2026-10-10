import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes, timingSafeEqual } from 'node:crypto';

// Keys for two-step verification (DEC-080), derived from MFA_ENCRYPTION_KEY
// (32 random bytes, base64), which lives only in the hosting environment:
// - authenticator secrets are stored AES-256-GCM encrypted;
// - the short-lived "password checked, code pending" token is HMAC-signed.
// Without the key, sign-in fails closed.

export class MfaNotConfiguredError extends Error {
  constructor() {
    super('Two-step verification is not configured');
    this.name = 'MfaNotConfiguredError';
  }
}

function masterKey(): Buffer {
  const encoded = process.env.MFA_ENCRYPTION_KEY;
  const key = encoded ? Buffer.from(encoded, 'base64') : Buffer.alloc(0);
  if (key.length !== 32) throw new MfaNotConfiguredError();
  return key;
}

function derived(purpose: string): Buffer {
  return Buffer.from(hkdfSync('sha256', masterKey(), Buffer.alloc(0), `veritas-mfa:${purpose}`, 32));
}

export function encryptMfaSecret(secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', derived('secret'), iv);
  const body = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), body.toString('base64')].join(':');
}

/** Returns null for anything that is not a secret this key encrypted. */
export function decryptMfaSecret(stored: string | null): string | null {
  if (!stored) return null;
  const [version, iv, tag, body] = stored.split(':');
  if (version !== 'v1' || !iv || !tag || !body) return null;
  const key = derived('secret');
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(body, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

export type PendingSignIn = { iamUserId: string; membershipId: string; tenantId: string; enrolling: boolean; expiresAt: number };

export const PENDING_SIGN_IN_SECONDS = 5 * 60;

export function signPendingSignIn(pending: Omit<PendingSignIn, 'expiresAt'>, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ ...pending, expiresAt: now + PENDING_SIGN_IN_SECONDS * 1000 })).toString('base64url');
  const signature = createHmac('sha256', derived('pending-sign-in')).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function readPendingSignIn(token: string | undefined, now = Date.now()): PendingSignIn | null {
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = createHmac('sha256', derived('pending-sign-in')).update(payload).digest();
  const given = Buffer.from(signature, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const pending = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as PendingSignIn;
    if (typeof pending.expiresAt !== 'number' || pending.expiresAt <= now) return null;
    if (typeof pending.iamUserId !== 'string' || typeof pending.membershipId !== 'string' || typeof pending.tenantId !== 'string') return null;
    return pending;
  } catch {
    return null;
  }
}
