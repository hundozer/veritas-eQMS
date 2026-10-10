import prisma from '../db';

// Failed sign-ins are limited (DEC-079). Every failure is recorded in the identity
// audit trail under the email that was tried, known or not, so the limit says
// nothing about which accounts exist. A successful sign-in clears the count for
// that email; refusals made by the limit itself are recorded but not counted.

export const MAX_FAILED_LOGINS_PER_EMAIL = 5;
export const MAX_FAILED_LOGINS_PER_ADDRESS = 20;
const WINDOW_MS = 15 * 60 * 1000;

export type LoginFailureReason = 'UNKNOWN_ACCOUNT' | 'INACTIVE_ACCOUNT' | 'PASSWORD_MISMATCH' | 'TOO_MANY_ATTEMPTS';

export async function isLoginThrottled(email: string, ipAddress: string | null): Promise<boolean> {
  const windowStart = new Date(Date.now() - WINDOW_MS);
  const lastSuccess = await prisma.iamAuditTrail.findFirst({
    where: { action: 'LOGIN_SUCCEEDED', userEmail: email, createdAt: { gte: windowStart } },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  const counted = { action: 'LOGIN_FAILED', NOT: { reason: 'TOO_MANY_ATTEMPTS' } };
  const forEmail = await prisma.iamAuditTrail.count({
    where: { ...counted, userEmail: email, createdAt: { gt: lastSuccess?.createdAt ?? windowStart } },
  });
  if (forEmail >= MAX_FAILED_LOGINS_PER_EMAIL) return true;
  if (!ipAddress) return false;
  const forAddress = await prisma.iamAuditTrail.count({
    where: { ...counted, ipAddress, createdAt: { gte: windowStart } },
  });
  return forAddress >= MAX_FAILED_LOGINS_PER_ADDRESS;
}

/** Best effort: a failed write must not turn a refused sign-in into an error page. */
export async function recordLoginFailure(input: { email: string; ipAddress: string | null; userId?: string; reason: LoginFailureReason }) {
  try {
    await prisma.iamAuditTrail.create({
      data: {
        userId: input.userId ?? null,
        userEmail: input.email,
        action: 'LOGIN_FAILED',
        objectType: 'IamUser',
        objectId: input.userId ?? null,
        payload: JSON.stringify({ reason: input.reason }),
        status: input.reason === 'TOO_MANY_ATTEMPTS' ? 'DENIED' : 'FAILED',
        ipAddress: input.ipAddress,
        reason: input.reason,
      },
    });
  } catch {
    // The attempt is still refused; only its trace is missing.
  }
}

export async function recordLoginSuccess(input: { email: string; ipAddress: string | null; userId: string; organizationId: string; membershipId: string }) {
  await prisma.iamAuditTrail.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId,
      userEmail: input.email,
      action: 'LOGIN_SUCCEEDED',
      objectType: 'IamMembership',
      objectId: input.membershipId,
      payload: JSON.stringify({ membershipId: input.membershipId }),
      status: 'SUCCESS',
      ipAddress: input.ipAddress,
    },
  });
}

export function clientAddress(headers: Headers): string | null {
  return headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
}
