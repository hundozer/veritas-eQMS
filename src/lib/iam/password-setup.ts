import { IamCredentialActionPurpose } from '@prisma/client';
import prisma from '../db';
import { consumeCredentialActionToken, CredentialActionError } from './credential-action-token';
import { hashPassword } from './password';
import { identityMemberships } from './session';

export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 128;

export type PasswordSetupFailure = 'WeakPassword' | 'InvalidLink';

export class PasswordSetupError extends Error {
  constructor(readonly failure: PasswordSetupFailure) {
    super(failure === 'WeakPassword'
      ? `Choose a password of ${MIN_PASSWORD_LENGTH} to ${MAX_PASSWORD_LENGTH} characters`
      : 'This link is invalid, already used or expired; ask for a new invitation');
    this.name = 'PasswordSetupError';
  }
}

/**
 * Sets the first password of an invited identity from its single-use link and
 * activates it. The password is checked before the link is consumed, so a
 * rejected password does not burn the link.
 */
export async function completePasswordSetup(token: unknown, password: unknown, ipAddress?: string | null) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    throw new PasswordSetupError('WeakPassword');
  }
  if (typeof token !== 'string' || !token) throw new PasswordSetupError('InvalidLink');

  let userId: string;
  try {
    ({ userId } = await consumeCredentialActionToken({ token, expectedPurpose: IamCredentialActionPurpose.PASSWORD_SETUP }));
  } catch (error) {
    if (error instanceof CredentialActionError) throw new PasswordSetupError('InvalidLink');
    throw error;
  }

  const passwordHash = await hashPassword(password);
  // Memberships are tenant data; only the sign-in lookup may list them here (DEC-069).
  const organizationId = (await identityMemberships(userId))[0]?.organizationId ?? null;
  await prisma.$transaction(async (tx) => {
    const activated = await tx.iamUser.updateMany({
      where: { id: userId, accountStatus: 'INVITED' },
      data: { passwordHash, accountStatus: 'ACTIVE', lastPasswordChange: new Date() },
    });
    if (activated.count !== 1) throw new PasswordSetupError('InvalidLink');
    const identity = await tx.iamUser.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true },
    });
    await tx.iamAuditTrail.create({
      data: {
        organizationId, userId, userEmail: identity.email,
        action: 'PASSWORD_SET', objectType: 'IamUser', objectId: userId,
        payload: JSON.stringify({ purpose: 'PASSWORD_SETUP', accountStatus: { before: 'INVITED', after: 'ACTIVE' } }),
        ipAddress: ipAddress ?? null,
      },
    });
  });
}
