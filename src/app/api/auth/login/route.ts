import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { verifyPassword } from '@/lib/iam/password';
import { createIamSession, identityMemberships } from '@/lib/iam/session';
import { tenantRead } from '@/lib/tenant-db';
import { clientAddress, isLoginThrottled, recordLoginFailure, recordLoginSuccess } from '../../../../lib/iam/login-throttle';

const SESSION_COOKIE_NAME = 'iam-access-token';
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

    const memberships = await identityMemberships(iamUser.id);
    if (memberships.length > 1) {
      return NextResponse.json(
        { error: { code: 'MembershipSelectionRequired', message: 'Organization selection is required' } },
        { status: 409, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    if (memberships.length === 0) return authenticationFailed();

    // The rest of the membership is read as its tenant (DEC-069).
    const { membershipId, tenantId } = memberships[0];
    const membership = await tenantRead(tenantId, (tx) => tx.iamMembership.findFirst({
      where: { id: membershipId, tenantId, userId: iamUser.id },
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
    if (
      !membership ||
      membership.status !== 'ACTIVE' ||
      membership.tenantId !== membership.organization.tenantId ||
      !['ACTIVE', 'TRIAL'].includes(membership.organization.status) ||
      !membership.role
    ) {
      return authenticationFailed();
    }

    const operationalUser = membership.operationalUser;
    if (
      !operationalUser ||
      operationalUser.accountStatus !== 'ACTIVE' ||
      (operationalUser.expiresAt !== null && operationalUser.expiresAt <= new Date()) ||
      operationalUser.tenantId !== membership.organization.tenantId
    ) {
      return authenticationFailed();
    }

    const session = await createIamSession({
      userId: iamUser.id,
      membershipId: membership.id,
      tenantId: membership.tenantId,
      ipAddress: ipAddress ?? undefined,
      userAgent: req.headers.get('user-agent') ?? undefined,
    });

    await recordLoginSuccess({ email: normalizedEmail, ipAddress, userId: iamUser.id, organizationId: membership.organizationId, membershipId: membership.id });

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
    response.cookies.delete('user-email');
    return response;
  } catch {
    return authenticationFailed();
  }
}
