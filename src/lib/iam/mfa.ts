import QRCode from 'qrcode';
import prisma from '../db';
import type { UserContext } from '../auth';
import { writeMandatoryAudit } from '../audit';
import { tenantRead, tenantTransaction } from '../tenant-db';
import { identityMemberships } from './session';
import { decryptMfaSecret, encryptMfaSecret } from './mfa-crypto';
import { generateTotpSecret, otpauthUri, verifyTotp } from './totp';

// Two-step verification for everyone (DEC-080). After the password, a person
// enters a 6-digit code from an authenticator app. Someone without it sets it up
// at that point: a new secret is stored encrypted and switched on only when a
// code from it is accepted. Wrong codes are limited like passwords, and a code
// is accepted once. Every step is recorded in the identity audit trail.

export const MAX_FAILED_CODES = 5;
const WINDOW_MS = 15 * 60 * 1000;

export type MfaChallenge =
  | { mfa: 'VERIFY' }
  | { mfa: 'ENROLL'; setupKey: string; otpauthUri: string; qrSvg: string }
  | { mfa: 'RESET_REQUIRED' };

/** The second step to show after a correct password. */
export async function prepareChallenge(iamUserId: string, email: string): Promise<MfaChallenge> {
  const identity = await prisma.iamUser.findUniqueOrThrow({ where: { id: iamUserId }, select: { mfaEnabled: true, mfaSecret: true } });
  if (identity.mfaEnabled) {
    // A secret this key cannot read (e.g. a changed key) needs an administrator reset.
    return decryptMfaSecret(identity.mfaSecret) ? { mfa: 'VERIFY' } : { mfa: 'RESET_REQUIRED' };
  }
  const setupKey = generateTotpSecret();
  await prisma.iamUser.updateMany({ where: { id: iamUserId, mfaEnabled: false }, data: { mfaSecret: encryptMfaSecret(setupKey) } });
  const uri = otpauthUri(setupKey, email);
  return { mfa: 'ENROLL', setupKey, otpauthUri: uri, qrSvg: await QRCode.toString(uri, { type: 'svg', margin: 1 }) };
}

export type CodeCheck = { ok: true; enrolled: boolean } | { ok: false; reason: 'TOO_MANY_ATTEMPTS' | 'CODE_MISMATCH' | 'RESET_REQUIRED' };

export async function checkCode(input: { iamUserId: string; email: string; code: unknown; ipAddress: string | null }): Promise<CodeCheck> {
  const { iamUserId, email, ipAddress } = input;
  if (await tooManyFailedCodes(iamUserId)) {
    await record(iamUserId, email, ipAddress, 'MFA_FAILED', { reason: 'TOO_MANY_ATTEMPTS' }, 'DENIED', 'TOO_MANY_ATTEMPTS');
    return { ok: false, reason: 'TOO_MANY_ATTEMPTS' };
  }
  const identity = await prisma.iamUser.findUnique({ where: { id: iamUserId }, select: { mfaEnabled: true, mfaSecret: true, accountStatus: true } });
  const secret = identity?.accountStatus === 'ACTIVE' ? decryptMfaSecret(identity.mfaSecret) : null;
  if (!identity || !secret) return { ok: false, reason: 'RESET_REQUIRED' };

  const step = verifyTotp(secret, input.code);
  const used = step === null ? 0 : await prisma.iamAuditTrail.count({
    where: { userId: iamUserId, action: 'MFA_VERIFIED', payload: JSON.stringify({ step }) },
  });
  if (step === null || used > 0) {
    await record(iamUserId, email, ipAddress, 'MFA_FAILED', { reason: step === null ? 'CODE_MISMATCH' : 'CODE_REUSED' }, 'FAILED', 'CODE_MISMATCH');
    return { ok: false, reason: 'CODE_MISMATCH' };
  }

  const enrolled = !identity.mfaEnabled;
  await prisma.$transaction(async (tx) => {
    if (enrolled) {
      await tx.iamUser.updateMany({ where: { id: iamUserId, mfaEnabled: false }, data: { mfaEnabled: true } });
      await tx.iamAuditTrail.create({ data: entry(iamUserId, email, ipAddress, 'MFA_ENROLLED', { method: 'TOTP' }, 'SUCCESS') });
    }
    await tx.iamAuditTrail.create({ data: entry(iamUserId, email, ipAddress, 'MFA_VERIFIED', { step }, 'SUCCESS') });
  });
  return { ok: true, enrolled };
}

async function tooManyFailedCodes(iamUserId: string): Promise<boolean> {
  const windowStart = new Date(Date.now() - WINDOW_MS);
  const lastSuccess = await prisma.iamAuditTrail.findFirst({
    where: { userId: iamUserId, action: 'MFA_VERIFIED', createdAt: { gte: windowStart } },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  const failures = await prisma.iamAuditTrail.count({
    where: { userId: iamUserId, action: 'MFA_FAILED', reason: 'CODE_MISMATCH', createdAt: { gt: lastSuccess?.createdAt ?? windowStart } },
  });
  return failures >= MAX_FAILED_CODES;
}

function entry(userId: string, userEmail: string, ipAddress: string | null, action: string, payload: object, status: string, reason?: string) {
  return { userId, userEmail, action, objectType: 'IamUser', objectId: userId, payload: JSON.stringify(payload), status, ipAddress, reason: reason ?? null };
}

async function record(userId: string, email: string, ipAddress: string | null, action: string, payload: object, status: string, reason?: string) {
  try {
    await prisma.iamAuditTrail.create({ data: entry(userId, email, ipAddress, action, payload, status, reason) });
  } catch {
    // The attempt is still refused; only its trace is missing.
  }
}

export class MfaResetError extends Error {
  constructor(readonly status: 400 | 404 | 409, readonly code: string, readonly publicMessage: string) {
    super(publicMessage);
    this.name = 'MfaResetError';
  }
}

/**
 * An administrator resets a member's two-step verification, e.g. after a lost
 * phone; the member sets it up again at their next sign-in. Not for oneself, and
 * not for an identity that also belongs to another organisation.
 */
export async function resetMfa(
  admin: UserContext,
  operationalUserId: string,
  input: { reason: unknown; requestUrl?: string },
) {
  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  if (!reason) throw new MfaResetError(400, 'ValidationFailed', 'A reason is required to reset two-step verification');
  if (operationalUserId === admin.id) throw new MfaResetError(409, 'OwnAccount', 'You cannot reset your own two-step verification');
  const membership = await tenantRead(admin.tenantId, (tx) => tx.iamMembership.findFirst({
    where: { operationalUserId, tenantId: admin.tenantId },
    select: { organizationId: true, user: { select: { id: true, email: true, mfaEnabled: true } } },
  }));
  if (!membership) throw new MfaResetError(404, 'NotFound', 'Member not found');
  const identity = membership.user;
  const elsewhere = (await identityMemberships(identity.id)).some((other) => other.tenantId !== admin.tenantId);
  if (elsewhere) throw new MfaResetError(409, 'OtherOrganisation', 'This person also belongs to another organisation; their two-step verification cannot be reset here');

  await tenantTransaction(admin.tenantId, async (tx) => {
    await tx.iamUser.update({ where: { id: identity.id }, data: { mfaEnabled: false, mfaSecret: null } });
    await tx.iamAuditTrail.create({
      data: {
        organizationId: membership.organizationId, userId: admin.iamUserId, userEmail: admin.email, userRole: admin.membershipRole,
        action: 'MFA_RESET', objectType: 'IamUser', objectId: identity.id,
        payload: JSON.stringify({ email: identity.email, wasEnabled: identity.mfaEnabled }), status: 'SUCCESS', reason,
      },
    });
    await writeMandatoryAudit(tx, {
      context: admin, action: 'MFA_RESET', objectType: 'User', objectId: operationalUserId,
      payload: { email: identity.email, mfaEnabled: { before: identity.mfaEnabled, after: false }, reason },
      requestUrl: input.requestUrl,
    });
  });
}
