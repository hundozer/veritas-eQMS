import { randomBytes } from 'node:crypto';
import { IamCredentialActionPurpose, Prisma } from '@prisma/client';
import prisma from '../db';
import { logSecurityEventBestEffort, type UserContext } from '../auth';
import { writeMandatoryAudit } from '../audit';
import { tenantRead, tenantTransaction } from '../tenant-db';
import { createCredentialActionToken } from './credential-action-token';
import { sendCredentialActionEmail } from './credential-email';
import { hashPassword } from './password';

// Audited provisioning (DEC-063). An administrator invites a person into their
// own organisation with one role. The identity, operational user, membership
// and both audit rows are written in one tenant transaction; the person then
// sets their own password from a single-use emailed link. Nobody else ever
// knows or chooses that password.

const PLATFORM_ROLES = new Set(['System Administrator']);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ProvisioningFailure =
  | 'ValidationFailed'
  | 'EmailInUse'
  | 'RoleNotAssignable'
  | 'InvitationEmailUnavailable'
  | 'InvitationNotSent'
  | 'NotFound'
  | 'AlreadyActivated';

const FAILURE_MESSAGES: Record<ProvisioningFailure, string> = {
  ValidationFailed: 'Name, a valid email address, department and role are required',
  EmailInUse: 'A user with this email address already exists',
  RoleNotAssignable: 'You cannot assign this role',
  InvitationEmailUnavailable: 'Invitation email is not configured; nobody was invited',
  InvitationNotSent: 'The user was created but the invitation email could not be sent; resend it',
  NotFound: 'User not found',
  AlreadyActivated: 'This user has already set a password',
};

const FAILURE_STATUS: Record<ProvisioningFailure, number> = {
  ValidationFailed: 400,
  EmailInUse: 409,
  RoleNotAssignable: 403,
  InvitationEmailUnavailable: 503,
  InvitationNotSent: 502,
  NotFound: 404,
  AlreadyActivated: 409,
};

export class ProvisioningError extends Error {
  constructor(readonly failure: ProvisioningFailure, readonly operationalUserId?: string) {
    super(FAILURE_MESSAGES[failure]);
    this.name = 'ProvisioningError';
  }

  get status() {
    return FAILURE_STATUS[this.failure];
  }

  get publicMessage() {
    return FAILURE_MESSAGES[this.failure];
  }
}

export type InviteInput = {
  email: unknown;
  firstName: unknown;
  lastName: unknown;
  department: unknown;
  roleId: unknown;
};

function text(value: unknown, max = 100): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= max ? trimmed : null;
}

function invitationEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim() && process.env.APP_ORIGIN?.trim());
}

/** Roles the inviter may hand out: never a platform role, never more than they hold. */
export async function assignableRoles(inviter: UserContext) {
  const held = new Set(inviter.permissions);
  const roles = await prisma.iamRole.findMany({
    select: { id: true, name: true, description: true, permissions: { select: { permission: { select: { name: true } } } } },
    orderBy: { name: 'asc' },
  });
  return roles
    .filter((role) => !PLATFORM_ROLES.has(role.name))
    .filter((role) => role.permissions.every(({ permission }) => held.has(permission.name)))
    .map(({ id, name, description }) => ({ id, name, description }));
}

async function sendInvitation(inviter: UserContext, iamUserId: string, operationalUserId: string, email: string) {
  try {
    const { token } = await createCredentialActionToken({ userId: iamUserId, purpose: IamCredentialActionPurpose.PASSWORD_SETUP });
    await sendCredentialActionEmail(email, token, IamCredentialActionPurpose.PASSWORD_SETUP);
  } catch {
    await logSecurityEventBestEffort({
      tenantId: inviter.tenantId,
      userId: inviter.id,
      userEmail: inviter.email,
      userRole: inviter.membershipRole,
      action: 'INVITATION_EMAIL_FAILED',
      objectType: 'User',
      objectId: operationalUserId,
      payload: { email },
      status: 'Failed',
    });
    throw new ProvisioningError('InvitationNotSent', operationalUserId);
  }
}

export async function inviteMember(inviter: UserContext, input: InviteInput, requestUrl?: string) {
  const email = text(input.email, 254)?.toLowerCase() ?? null;
  const firstName = text(input.firstName);
  const lastName = text(input.lastName);
  const department = text(input.department);
  const roleId = text(input.roleId);
  if (!email || !EMAIL_PATTERN.test(email) || !firstName || !lastName || !department || !roleId) {
    throw new ProvisioningError('ValidationFailed');
  }
  const role = (await assignableRoles(inviter)).find((candidate) => candidate.id === roleId);
  if (!role) throw new ProvisioningError('RoleNotAssignable');
  if (!invitationEmailConfigured()) throw new ProvisioningError('InvitationEmailUnavailable');

  const organization = await prisma.iamOrganization.findUnique({ where: { tenantId: inviter.tenantId }, select: { id: true } });
  if (!organization) throw new ProvisioningError('NotFound');

  // Nobody knows this password; the identity cannot sign in until its owner sets one.
  const unusablePasswordHash = await hashPassword(randomBytes(32).toString('base64url'));
  const fullName = `${firstName} ${lastName}`;

  let created: { iamUserId: string; operationalUserId: string };
  try {
    created = await tenantTransaction(inviter.tenantId, async (tx) => {
      const iamUser = await tx.iamUser.create({
        data: { email, passwordHash: unusablePasswordHash, firstName, lastName, accountStatus: 'INVITED' },
      });
      const user = await tx.user.create({
        data: { email, fullName, firstName, lastName, role: 'EMPLOYEE', department, tenantId: inviter.tenantId, accountStatus: 'ACTIVE' },
      });
      const membership = await tx.iamMembership.create({
        data: {
          userId: iamUser.id, organizationId: organization.id, tenantId: inviter.tenantId, operationalUserId: user.id,
          roleId: role.id, status: 'ACTIVE', createdBy: inviter.iamUserId, approvedBy: inviter.iamUserId,
        },
      });
      const payload = { email, fullName, department, roleId: role.id, roleName: role.name, membershipId: membership.id };
      await tx.iamAuditTrail.create({
        data: {
          organizationId: organization.id, userId: inviter.iamUserId, userEmail: inviter.email, userRole: inviter.membershipRole,
          action: 'USER_INVITED', objectType: 'IamUser', objectId: iamUser.id, payload: JSON.stringify(payload),
        },
      });
      await writeMandatoryAudit(tx, {
        context: inviter, action: 'USER_INVITED', objectType: 'User', objectId: user.id, payload, requestUrl,
      });
      return { iamUserId: iamUser.id, operationalUserId: user.id };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ProvisioningError('EmailInUse');
    }
    throw error;
  }

  await sendInvitation(inviter, created.iamUserId, created.operationalUserId, email);
  return { userId: created.operationalUserId, email, fullName, roleName: role.name };
}

/** Sends a fresh setup link to someone in the inviter's organisation who has not set a password yet. */
export async function resendInvitation(inviter: UserContext, operationalUserId: string, requestUrl?: string) {
  if (!invitationEmailConfigured()) throw new ProvisioningError('InvitationEmailUnavailable');
  const membership = await prisma.iamMembership.findFirst({
    where: { operationalUserId, tenantId: inviter.tenantId },
    select: { user: { select: { id: true, email: true, accountStatus: true } } },
  });
  if (!membership) throw new ProvisioningError('NotFound');
  if (membership.user.accountStatus !== 'INVITED') throw new ProvisioningError('AlreadyActivated');

  await sendInvitation(inviter, membership.user.id, operationalUserId, membership.user.email);
  await tenantTransaction(inviter.tenantId, (tx) => writeMandatoryAudit(tx, {
    context: inviter, action: 'USER_INVITATION_RESENT', objectType: 'User', objectId: operationalUserId,
    payload: { email: membership.user.email }, requestUrl,
  }));
}

/** Operational user ids in the tenant whose owner has not set a password yet. */
export async function pendingInvitationUserIds(tenantId: string): Promise<Set<string>> {
  const pending = await tenantRead(tenantId, (tx) => tx.iamMembership.findMany({
    where: { tenantId, user: { accountStatus: 'INVITED' } },
    select: { operationalUserId: true },
  }));
  return new Set(pending.map((membership) => membership.operationalUserId));
}
