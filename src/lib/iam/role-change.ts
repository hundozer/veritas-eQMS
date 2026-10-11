import type { UserContext } from '../auth';
import { writeMandatoryAudit } from '../audit';
import { tenantTransaction } from '../tenant-db';
import { assignableRoles, isPlatformRole } from './provisioning';

// Changing a member's organisation role (VER-00.3). The membership's role is
// replaced in one transaction with both audit rows. Permissions are read from
// the membership's role on every request, so the new role applies to the
// member's existing sessions at their next request; nothing of the old role
// survives in a session.
//
// Not for oneself, so the administrator who makes the change keeps their own
// access; their membership is locked and re-checked in the transaction, as for
// deactivation, so two administrators cannot demote each other at once.

export class RoleChangeError extends Error {
  constructor(readonly status: 400 | 403 | 404 | 409, readonly code: string, readonly publicMessage: string) {
    super(publicMessage);
    this.name = 'RoleChangeError';
  }
}

export async function changeMemberRole(
  admin: UserContext,
  operationalUserId: string,
  input: { roleId: unknown; reason: unknown; requestUrl?: string },
): Promise<{ roleId: string; roleName: string }> {
  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  const roleId = typeof input.roleId === 'string' ? input.roleId.trim() : '';
  if (!reason || !roleId) throw new RoleChangeError(400, 'ValidationFailed', 'A role and a reason are required to change a member\'s role');
  if (operationalUserId === admin.id) throw new RoleChangeError(409, 'OwnAccount', 'You cannot change your own role');
  const role = (await assignableRoles(admin)).find((candidate) => candidate.id === roleId);
  if (!role) throw new RoleChangeError(403, 'RoleNotAssignable', 'You cannot assign this role');

  return tenantTransaction(admin.tenantId, async (tx) => {
    const actor = await tx.$queryRaw<Array<{ status: string }>>`
      SELECT "status" FROM "IamMembership"
      WHERE "id" = ${admin.membershipId} AND "tenantId" = ${admin.tenantId}
      FOR SHARE`;
    if (actor[0]?.status !== 'ACTIVE') throw new RoleChangeError(409, 'ActorInactive', 'Your own membership is no longer active');

    const membership = await tx.iamMembership.findFirst({
      where: { operationalUserId, tenantId: admin.tenantId },
      select: { id: true, organizationId: true, status: true, roleId: true, role: { select: { name: true } }, user: { select: { id: true, email: true } } },
    });
    if (!membership) throw new RoleChangeError(404, 'NotFound', 'Member not found');
    if (membership.status !== 'ACTIVE') throw new RoleChangeError(409, 'NotActive', 'This member is deactivated');
    if (isPlatformRole(membership.role.name)) throw new RoleChangeError(403, 'RoleNotAssignable', 'This member\'s role cannot be changed here');
    if (membership.roleId === role.id) throw new RoleChangeError(409, 'SameRole', 'The member already has this role');

    const changed = await tx.iamMembership.updateMany({
      where: { id: membership.id, tenantId: admin.tenantId, status: 'ACTIVE', roleId: membership.roleId },
      data: { roleId: role.id },
    });
    if (changed.count !== 1) throw new RoleChangeError(409, 'Conflict', 'The member changed meanwhile; reload and try again');

    const before = { roleId: membership.roleId, roleName: membership.role.name };
    const after = { roleId: role.id, roleName: role.name };
    await tx.iamAuditTrail.create({
      data: {
        organizationId: membership.organizationId, userId: admin.iamUserId, userEmail: admin.email, userRole: admin.membershipRole,
        action: 'MEMBER_ROLE_CHANGED', objectType: 'IamMembership', objectId: membership.id,
        payload: JSON.stringify({ email: membership.user.email, before, after }), status: 'SUCCESS', reason,
      },
    });
    await writeMandatoryAudit(tx, {
      context: admin, action: 'USER_ROLE_CHANGED', objectType: 'User', objectId: operationalUserId,
      payload: { email: membership.user.email, role: { before: before.roleName, after: after.roleName }, roleId: { before: before.roleId, after: after.roleId }, reason },
      requestUrl: input.requestUrl,
    });
    return after;
  });
}
