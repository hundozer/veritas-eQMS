import { NextResponse } from 'next/server';
import { tenantRead } from '../tenant-db';
import { createIamSession, identityMemberships } from './session';
import { clientAddress, recordLoginSuccess } from './login-throttle';

// The steps shared by password sign-in and the code step of two-step
// verification (DEC-080): find the one membership an identity may sign in
// with, then open its session.

export const SESSION_COOKIE_NAME = 'iam-access-token';
export const PENDING_COOKIE_NAME = 'veritas-mfa-pending';

export type SignInMembership = NonNullable<Awaited<ReturnType<typeof loadMembership>>>;

export type MembershipResolution =
  | { ok: true; membership: SignInMembership }
  | { ok: false; reason: 'SelectionRequired' | 'NotAllowed' };

export async function resolveSignInMembership(iamUserId: string): Promise<MembershipResolution> {
  const memberships = await identityMemberships(iamUserId);
  if (memberships.length > 1) return { ok: false, reason: 'SelectionRequired' };
  if (memberships.length === 0) return { ok: false, reason: 'NotAllowed' };

  // The rest of the membership is read as its tenant (DEC-069).
  const { membershipId, tenantId } = memberships[0];
  const membership = await loadMembership(iamUserId, membershipId, tenantId);
  if (
    !membership ||
    membership.status !== 'ACTIVE' ||
    membership.tenantId !== membership.organization.tenantId ||
    !['ACTIVE', 'TRIAL'].includes(membership.organization.status) ||
    !membership.role
  ) {
    return { ok: false, reason: 'NotAllowed' };
  }
  const operationalUser = membership.operationalUser;
  if (
    !operationalUser ||
    operationalUser.accountStatus !== 'ACTIVE' ||
    (operationalUser.expiresAt !== null && operationalUser.expiresAt <= new Date()) ||
    operationalUser.tenantId !== membership.organization.tenantId
  ) {
    return { ok: false, reason: 'NotAllowed' };
  }
  return { ok: true, membership };
}

function loadMembership(iamUserId: string, membershipId: string, tenantId: string) {
  return tenantRead(tenantId, (tx) => tx.iamMembership.findFirst({
    where: { id: membershipId, tenantId, userId: iamUserId },
    include: {
      organization: { select: { tenantId: true, status: true } },
      role: { select: { id: true } },
      operationalUser: {
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          department: true,
          clearance: true,
          tenantId: true,
          accountStatus: true,
          expiresAt: true,
          tenant: { select: { name: true } },
        },
      },
    },
  }));
}

/** Opens the session, records the sign-in and returns the response that carries the cookie. */
export async function completeSignIn(
  req: { headers: Headers },
  input: { iamUserId: string; email: string; membership: SignInMembership },
) {
  const { membership } = input;
  const ipAddress = clientAddress(req.headers);
  const session = await createIamSession({
    userId: input.iamUserId,
    membershipId: membership.id,
    tenantId: membership.tenantId,
    ipAddress: ipAddress ?? undefined,
    userAgent: req.headers.get('user-agent') ?? undefined,
  });
  await recordLoginSuccess({ email: input.email, ipAddress, userId: input.iamUserId, organizationId: membership.organizationId, membershipId: membership.id });

  const operationalUser = membership.operationalUser;
  const response = NextResponse.json({
    user: {
      id: operationalUser.id,
      email: operationalUser.email,
      fullName: operationalUser.fullName,
      role: operationalUser.role,
      department: operationalUser.department,
      clearance: operationalUser.clearance,
      tenantId: operationalUser.tenantId,
      tenantName: operationalUser.tenant.name,
    },
  }, { headers: { 'Cache-Control': 'no-store' } });
  response.cookies.set(SESSION_COOKIE_NAME, session.sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: session.expiresAt,
    maxAge: Math.max(0, Math.floor((session.expiresAt.getTime() - Date.now()) / 1000)),
  });
  clearPendingSignIn(response);
  response.cookies.delete('user-email');
  return response;
}

/** The pending cookie only travels to the code step. */
export function setPendingSignIn(response: NextResponse, token: string, maxAgeSeconds: number) {
  response.cookies.set(PENDING_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/auth/mfa',
    maxAge: maxAgeSeconds,
  });
}

export function clearPendingSignIn(response: NextResponse) {
  response.cookies.set(PENDING_COOKIE_NAME, '', { httpOnly: true, path: '/api/auth/mfa', maxAge: 0 });
}
