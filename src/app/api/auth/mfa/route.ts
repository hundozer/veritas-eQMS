import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../lib/db';
import { clientAddress } from '../../../../lib/iam/login-throttle';
import { checkCode } from '../../../../lib/iam/mfa';
import { MfaNotConfiguredError, readPendingSignIn } from '../../../../lib/iam/mfa-crypto';
import { clearPendingSignIn, completeSignIn, PENDING_COOKIE_NAME, resolveSignInMembership } from '../../../../lib/iam/sign-in';

function failure(status: number, code: string, message: string, endPending = false) {
  const response = NextResponse.json({ error: { code, message } }, { status, headers: { 'Cache-Control': 'no-store' } });
  if (endPending) clearPendingSignIn(response);
  return response;
}

// POST /api/auth/mfa - the code step of sign-in (DEC-080). Needs the pending
// cookie from a correct password within the last five minutes; opens the
// session only when the authenticator code is accepted.
export async function POST(req: NextRequest) {
  try {
    const pending = readPendingSignIn(req.cookies.get(PENDING_COOKIE_NAME)?.value);
    if (!pending) return failure(401, 'SignInExpired', 'Your sign-in expired; enter your email and password again', true);
    const body = await req.json().catch(() => ({}));

    const identity = await prisma.iamUser.findUnique({ where: { id: pending.iamUserId }, select: { email: true } });
    if (!identity) return failure(401, 'SignInExpired', 'Your sign-in expired; enter your email and password again', true);
    const check = await checkCode({ iamUserId: pending.iamUserId, email: identity.email, code: body?.code, ipAddress: clientAddress(req.headers) });
    if (!check.ok && check.reason === 'TOO_MANY_ATTEMPTS') {
      return NextResponse.json(
        { error: { code: 'TooManyAttempts', message: 'Too many wrong codes; try again in 15 minutes' } },
        { status: 429, headers: { 'Cache-Control': 'no-store', 'Retry-After': '900' } },
      );
    }
    if (!check.ok && check.reason === 'RESET_REQUIRED') {
      return failure(409, 'MfaResetRequired', 'Your two-step verification must be reset by an administrator', true);
    }
    if (!check.ok) return failure(401, 'CodeMismatch', 'The code did not match; enter the current code from your authenticator app');

    // Membership and account are checked again: they may have changed since the password step.
    const resolution = await resolveSignInMembership(pending.iamUserId);
    if (!resolution.ok || resolution.membership.id !== pending.membershipId || resolution.membership.tenantId !== pending.tenantId) {
      return failure(401, 'Unauthorized', 'Invalid email or password', true);
    }
    return completeSignIn(req, { iamUserId: pending.iamUserId, email: identity.email, membership: resolution.membership });
  } catch (error) {
    if (error instanceof MfaNotConfiguredError) {
      return failure(503, 'MfaUnavailable', 'Sign-in is unavailable: two-step verification is not configured', true);
    }
    return failure(401, 'Unauthorized', 'Sign-in failed; enter your email and password again', true);
  }
}
