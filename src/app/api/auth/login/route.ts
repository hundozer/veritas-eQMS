import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { verifyPassword } from '@/lib/iam/password';
import { createIamSession } from '@/lib/iam/session';

const SESSION_COOKIE_NAME = 'iam-access-token';
const GENERIC_AUTH_FAILURE = {
  error: { code: 'Unauthorized', message: 'Invalid email or password' },
};

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

    const iamUser = await prisma.iamUser.findUnique({
      where: { email: email.trim().toLowerCase() },
      include: {
        memberships: {
          where: { status: 'ACTIVE', organization: { status: { in: ['ACTIVE', 'TRIAL'] } } },
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
        },
      },
    });

    if (
      !iamUser ||
      iamUser.accountStatus !== 'ACTIVE' ||
      !(await verifyPassword(password, iamUser.passwordHash))
    ) {
      return authenticationFailed();
    }

    if (iamUser.memberships.length > 1) {
      return NextResponse.json(
        { error: { code: 'MembershipSelectionRequired', message: 'Organization selection is required' } },
        { status: 409, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const membership = iamUser.memberships[0];
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
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
      userAgent: req.headers.get('user-agent') ?? undefined,
    });

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
