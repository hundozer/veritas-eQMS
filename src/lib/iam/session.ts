import 'server-only';

import { createHash, randomBytes } from 'node:crypto';
import prisma from '../db';

const SESSION_RANDOM_BYTES = 32;
const SESSION_LIFETIME_MS = 12 * 60 * 60 * 1000;
const MAX_TOKEN_ATTEMPTS = 3;
const ACCESSIBLE_ORGANIZATION_STATUSES = new Set(['ACTIVE', 'TRIAL']);

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
