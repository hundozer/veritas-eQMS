import type { PrismaClient } from '@prisma/client';
import { NextRequest } from 'next/server';
import { decryptMfaSecret } from '@/lib/iam/mfa-crypto';
import { base32Decode, currentStep, totpCode } from '@/lib/iam/totp';

// Signs in through both real steps, password then authenticator code, the way
// the browser does (DEC-080). Each call uses a code step not used before.

export function loginRequest(email: string, password: string, ip = '203.0.113.9') {
  return new NextRequest('https://veritas.test/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify({ email, password }),
  });
}

export function codeRequest(code: string, pendingCookie: string | null, ip = '203.0.113.9') {
  return new NextRequest('https://veritas.test/api/auth/mfa', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip, ...(pendingCookie ? { cookie: pendingCookie } : {}) },
    body: JSON.stringify({ code }),
  });
}

export function pendingCookieOf(response: Response): string | null {
  const match = /veritas-mfa-pending=([^;]+)/.exec(response.headers.get('set-cookie') ?? '');
  return match && match[1] ? `veritas-mfa-pending=${match[1]}` : null;
}

/** A valid code for the identity's stored secret, on a step it has not used yet. */
export async function freshCode(owner: PrismaClient, email: string): Promise<string> {
  const identity = await owner.iamUser.findUniqueOrThrow({ where: { email } });
  const secret = decryptMfaSecret(identity.mfaSecret);
  if (!secret) throw new Error('no readable authenticator secret');
  const used = new Set((await owner.iamAuditTrail.findMany({ where: { userId: identity.id, action: 'MFA_VERIFIED' }, select: { payload: true } }))
    .map((row) => (JSON.parse(row.payload) as { step: number }).step));
  const now = currentStep();
  const step = [now, now + 1, now - 1].find((candidate) => !used.has(candidate));
  if (step === undefined) throw new Error('no unused code step left in this window');
  return totpCode(base32Decode(secret), step);
}

export async function signIn(owner: PrismaClient, email: string, password: string, ip?: string) {
  const { POST: login } = await import('@/app/api/auth/login/route');
  const { POST: mfa } = await import('@/app/api/auth/mfa/route');
  const first = await login(loginRequest(email, password, ip));
  if (first.status !== 200) return first;
  return mfa(codeRequest(await freshCode(owner, email.toLowerCase()), pendingCookieOf(first), ip));
}
