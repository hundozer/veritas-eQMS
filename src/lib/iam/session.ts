import 'server-only';

import { createHash, randomBytes } from 'node:crypto';
import prisma from '../db';

const SESSION_RANDOM_BYTES = 32;
const SESSION_LIFETIME_MS = 12 * 60 * 60 * 1000;
const MAX_TOKEN_ATTEMPTS = 3;
const ACCESSIBLE_ORGANIZATION_STATUSES = new Set(['ACTIVE', 'TRIAL']);
const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export class IamSessionCreationError extends Error {
  readonly code = 'IAM_SESSION_CREATION_DENIED';

  constructor() {
    super('Unable to create IAM session');
    this.name = 'IamSessionCreationError';
  }
}

export type CreateIamSessionInput = {
  userId: string;
  membershipId: string;
  ipAddress?: string;
  userAgent?: string;
  location?: string;
};

export type CreatedIamSession = {
  sessionToken: string;
  sessionId: string;
  expiresAt: Date;
};

function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export type ValidatedIamSession = {
  sessionId: string;
  userId: string;
  userEmail: string;
  membershipId: string;
  operationalUserId: string;
  organizationId: string;
  tenantId: string;
  roleId: string;
  roleName: string;
  permissions: readonly string[];
  expiresAt: Date;
};

function isValidSessionToken(token: unknown): token is string {
  return typeof token === 'string' && SESSION_TOKEN_PATTERN.test(token);
}

function isTokenHashCollision(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'P2002') {
    return false;
  }

  if (!('meta' in error) || !error.meta || typeof error.meta !== 'object') {
    return false;
  }

  const target = 'target' in error.meta ? error.meta.target : undefined;
  return Array.isArray(target)
    ? target.includes('tokenHash')
    : typeof target === 'string' && target.includes('tokenHash');
}

export async function createIamSession(
  input: CreateIamSessionInput,
): Promise<CreatedIamSession> {
  const [user, membership] = await Promise.all([
    prisma.iamUser.findUnique({
      where: { id: input.userId },
      select: { id: true, accountStatus: true },
    }),
    prisma.iamMembership.findUnique({
      where: { id: input.membershipId },
      include: { organization: true, role: true },
    }),
  ]);

  if (
    !user ||
    user.accountStatus !== 'ACTIVE' ||
    !membership ||
    membership.userId !== user.id ||
    membership.status !== 'ACTIVE' ||
    !membership.organization ||
    !ACCESSIBLE_ORGANIZATION_STATUSES.has(membership.organization.status) ||
    !membership.role
  ) {
    throw new IamSessionCreationError();
  }

  for (let attempt = 0; attempt < MAX_TOKEN_ATTEMPTS; attempt += 1) {
    const sessionToken = randomBytes(SESSION_RANDOM_BYTES).toString('base64url');
    const tokenHash = hashSessionToken(sessionToken);
    const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);

    try {
      const session = await prisma.iamSession.create({
        data: {
          userId: user.id,
          membershipId: membership.id,
          tokenHash,
          expiresAt,
          revokedAt: null,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          location: input.location,
        },
        select: { id: true },
      });

      return { sessionToken, sessionId: session.id, expiresAt };
    } catch (error) {
      if (!isTokenHashCollision(error) || attempt === MAX_TOKEN_ATTEMPTS - 1) {
        throw new IamSessionCreationError();
      }
    }
  }

  throw new IamSessionCreationError();
}

export async function validateIamSession(
  sessionToken: string,
): Promise<ValidatedIamSession | null> {
  if (!isValidSessionToken(sessionToken)) return null;

  const now = new Date();
  const session = await prisma.iamSession.findUnique({
    where: { tokenHash: hashSessionToken(sessionToken) },
    include: {
      user: true,
      membership: {
        include: {
          organization: true,
          role: { include: { permissions: { include: { permission: true } } } },
        },
      },
    },
  });

  if (
    !session ||
    session.revokedAt !== null ||
    session.expiresAt <= now ||
    session.user.accountStatus !== 'ACTIVE' ||
    session.membership.userId !== session.userId ||
    session.membership.status !== 'ACTIVE' ||
    session.membership.tenantId !== session.membership.organization.tenantId ||
    !ACCESSIBLE_ORGANIZATION_STATUSES.has(session.membership.organization.status) ||
    !session.membership.role
  ) {
    return null;
  }

  const activityUpdate = await prisma.iamSession.updateMany({
    where: {
      id: session.id,
      revokedAt: null,
      expiresAt: { gt: now },
    },
    data: { lastActiveAt: now },
  });
  if (activityUpdate.count !== 1) return null;

  return {
    sessionId: session.id,
    userId: session.userId,
    userEmail: session.user.email,
    membershipId: session.membershipId,
    operationalUserId: session.membership.operationalUserId,
    organizationId: session.membership.organizationId,
    tenantId: session.membership.organization.tenantId,
    roleId: session.membership.role.id,
    roleName: session.membership.role.name,
    permissions: session.membership.role.permissions.map(({ permission }) => permission.name),
    expiresAt: session.expiresAt,
  };
}

export async function revokeIamSession(sessionToken: string): Promise<boolean> {
  if (!isValidSessionToken(sessionToken)) return false;

  const result = await prisma.iamSession.updateMany({
    where: {
      tokenHash: hashSessionToken(sessionToken),
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });

  return result.count === 1;
}
