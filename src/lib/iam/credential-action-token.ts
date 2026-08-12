import 'server-only';

import { createHash, randomBytes } from 'node:crypto';
import { IamCredentialActionPurpose } from '@prisma/client';
import prisma from '../db';

const TOKEN_RANDOM_BYTES = 32;
const TOKEN_LIFETIME_MS = 30 * 60 * 1000;
const MAX_TOKEN_ATTEMPTS = 3;
const VALID_PURPOSES = new Set<IamCredentialActionPurpose>([
  IamCredentialActionPurpose.PASSWORD_SETUP,
  IamCredentialActionPurpose.PASSWORD_RESET,
]);

export class CredentialActionError extends Error {
  readonly code = 'CREDENTIAL_ACTION_DENIED';

  constructor() {
    super('Unable to complete credential action');
    this.name = 'CredentialActionError';
  }
}

export type CreateCredentialActionTokenInput = {
  userId: string;
  purpose: IamCredentialActionPurpose;
};

export type CreatedCredentialActionToken = {
  token: string;
  expiresAt: Date;
};

export type ConsumeCredentialActionTokenInput = {
  token: string;
  expectedPurpose: IamCredentialActionPurpose;
};

export type ConsumedCredentialAction = {
  userId: string;
};

function isValidPurpose(value: unknown): value is IamCredentialActionPurpose {
  return VALID_PURPOSES.has(value as IamCredentialActionPurpose);
}

function hashToken(token: string): string {
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

export async function createCredentialActionToken(
  input: CreateCredentialActionTokenInput,
): Promise<CreatedCredentialActionToken> {
  if (!isValidPurpose(input.purpose)) {
    throw new CredentialActionError();
  }

  for (let attempt = 0; attempt < MAX_TOKEN_ATTEMPTS; attempt += 1) {
    const token = randomBytes(TOKEN_RANDOM_BYTES).toString('base64url');
    const tokenHash = hashToken(token);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + TOKEN_LIFETIME_MS);

    try {
      await prisma.$transaction(async tx => {
        const user = await tx.iamUser.findUnique({
          where: { id: input.userId },
          select: { id: true, accountStatus: true },
        });

        if (!user || user.accountStatus !== 'ACTIVE') {
          throw new CredentialActionError();
        }

        await tx.iamCredentialActionToken.updateMany({
          where: {
            userId: user.id,
            purpose: input.purpose,
            consumedAt: null,
            expiresAt: { gt: now },
          },
          data: { consumedAt: now },
        });

        await tx.iamCredentialActionToken.create({
          data: {
            userId: user.id,
            purpose: input.purpose,
            tokenHash,
            expiresAt,
            consumedAt: null,
          },
          select: { id: true },
        });
      });

      return { token, expiresAt };
    } catch (error) {
      if (error instanceof CredentialActionError) throw error;
      if (!isTokenHashCollision(error) || attempt === MAX_TOKEN_ATTEMPTS - 1) {
        throw new CredentialActionError();
      }
    }
  }

  throw new CredentialActionError();
}

export async function consumeCredentialActionToken(
  input: ConsumeCredentialActionTokenInput,
): Promise<ConsumedCredentialAction> {
  if (!input.token || !isValidPurpose(input.expectedPurpose)) {
    throw new CredentialActionError();
  }

  const tokenHash = hashToken(input.token);
  const now = new Date();

  try {
    return await prisma.$transaction(async tx => {
      const actionToken = await tx.iamCredentialActionToken.findUnique({
        where: { tokenHash },
        include: {
          user: { select: { id: true, accountStatus: true } },
        },
      });

      if (
        !actionToken ||
        actionToken.purpose !== input.expectedPurpose ||
        actionToken.consumedAt !== null ||
        actionToken.expiresAt <= now ||
        !actionToken.user ||
        actionToken.user.accountStatus !== 'ACTIVE'
      ) {
        throw new CredentialActionError();
      }

      const consumed = await tx.iamCredentialActionToken.updateMany({
        where: {
          id: actionToken.id,
          purpose: input.expectedPurpose,
          consumedAt: null,
          expiresAt: { gt: now },
        },
        data: { consumedAt: now },
      });

      if (consumed.count !== 1) {
        throw new CredentialActionError();
      }

      return { userId: actionToken.user.id };
    });
  } catch {
    throw new CredentialActionError();
  }
}
