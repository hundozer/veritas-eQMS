import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { verifyPassword } from '@/lib/iam/password';
import { clientAddress, isLoginThrottled, recordLoginFailure } from '../../../../lib/iam/login-throttle';
import { prepareChallenge } from '../../../../lib/iam/mfa';
import { MfaNotConfiguredError, PENDING_SIGN_IN_SECONDS, signPendingSignIn } from '../../../../lib/iam/mfa-crypto';
import { resolveSignInMembership, setPendingSignIn } from '../../../../lib/iam/sign-in';

const GENERIC_AUTH_FAILURE = {
  error: { code: 'Unauthorized', message: 'Invalid email or password' },
};

function tooManyAttempts() {
  return NextResponse.json(
    { error: { code: 'TooManyAttempts', message: 'Too many failed sign-ins; try again in 15 minutes' } },
    { status: 429, headers: { 'Cache-Control': 'no-store', 'Retry-After': '900' } },
  );
}

function authenticationFailed() {
  return NextResponse.json(GENERIC_AUTH_FAILURE, {
    status: 401,
    headers: { 'Cache-Control': 'no-store' },
  });
}

// POST /api/auth/login - the password step. A correct password never opens a
// session by itself: it answers with the second step, two-step verification
// (DEC-080), and a short-lived pending cookie for POST /api/auth/mfa.
export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json();
    if (!body || typeof body !== 'object') return authenticationFailed();

    const { email, password } = body as Record<string, unknown>;
    if (
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      !email.trim() ||
      !password
    ) {
      return authenticationFailed();
    }

    // Failed sign-ins are limited before the password is checked (DEC-079).
    const normalizedEmail = email.trim().toLowerCase();
    const ipAddress = clientAddress(req.headers);
    if (await isLoginThrottled(normalizedEmail, ipAddress)) {
      await recordLoginFailure({ email: normalizedEmail, ipAddress, reason: 'TOO_MANY_ATTEMPTS' });
      return tooManyAttempts();
    }

    const iamUser = await prisma.iamUser.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, accountStatus: true, passwordHash: true },
    });

    if (!iamUser || iamUser.accountStatus !== 'ACTIVE' || !(await verifyPassword(password, iamUser.passwordHash))) {
      await recordLoginFailure({
        email: normalizedEmail,
        ipAddress,
        userId: iamUser?.id,
        reason: !iamUser ? 'UNKNOWN_ACCOUNT' : iamUser.accountStatus !== 'ACTIVE' ? 'INACTIVE_ACCOUNT' : 'PASSWORD_MISMATCH',
      });
      return authenticationFailed();
    }

    const resolution = await resolveSignInMembership(iamUser.id);
    if (!resolution.ok && resolution.reason === 'SelectionRequired') {
      return NextResponse.json(
        { error: { code: 'MembershipSelectionRequired', message: 'Organization selection is required' } },
        { status: 409, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    if (!resolution.ok) return authenticationFailed();

    const challenge = await prepareChallenge(iamUser.id, normalizedEmail);
    if (challenge.mfa === 'RESET_REQUIRED') {
      return NextResponse.json(
        { error: { code: 'MfaResetRequired', message: 'Your two-step verification must be reset by an administrator' } },
        { status: 409, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    const token = signPendingSignIn({
      iamUserId: iamUser.id,
      membershipId: resolution.membership.id,
      tenantId: resolution.membership.tenantId,
      enrolling: challenge.mfa === 'ENROLL',
    });
    const response = NextResponse.json(challenge, { headers: { 'Cache-Control': 'no-store' } });
    setPendingSignIn(response, token, PENDING_SIGN_IN_SECONDS);
    return response;
  } catch (error) {
    if (error instanceof MfaNotConfiguredError) {
      return NextResponse.json(
        { error: { code: 'MfaUnavailable', message: 'Sign-in is unavailable: two-step verification is not configured' } },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    return authenticationFailed();
  }
}
