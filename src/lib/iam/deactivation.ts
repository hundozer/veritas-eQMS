import type { UserContext } from '../auth';
import { writeMandatoryAudit } from '../audit';
import { tenantTransaction } from '../tenant-db';

// Deactivating a member who has left (VER-00.4). Their membership is suspended,
// their operational user set inactive and every session they hold in this
// organisation revoked, in one transaction with the audit rows. Nothing they
// authored, signed or were assigned is changed or deleted: the response lists
// their open work so it can be reassigned through the normal workflows.
//
// An administrator cannot deactivate themselves, so the organisation always
// keeps the person who ran the deactivation. Their own membership is locked and
// re-checked in the transaction, so two administrators deactivating each other
// at the same moment cannot both succeed.

export class DeactivationError extends Error {
  constructor(readonly status: 400 | 404 | 409, readonly code: string, readonly publicMessage: string) {
    super(publicMessage);
    this.name = 'DeactivationError';
  }
}

export type OpenWork = {
  approvalSteps: Array<{ stepId: string; stepType: string; documentId: string; documentTitle: string }>;
  trainingAssignments: Array<{ assignmentId: string; documentId: string; documentTitle: string }>;
  ownedDocuments: Array<{ documentId: string; documentNumber: string | null; title: string; status: string }>;
};

export type DeactivationResult = { revokedSessions: number; openWork: OpenWork };

export async function deactivateMember(
  admin: UserContext,
  operationalUserId: string,
  input: { reason: unknown; requestUrl?: string },
): Promise<DeactivationResult> {
  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  if (!reason) throw new DeactivationError(400, 'ValidationFailed', 'A reason is required to deactivate a member');
  if (operationalUserId === admin.id) throw new DeactivationError(409, 'OwnAccount', 'You cannot deactivate your own account');

  return tenantTransaction(admin.tenantId, async (tx) => {
    const actor = await tx.$queryRaw<Array<{ status: string }>>`
      SELECT "status" FROM "IamMembership"
      WHERE "id" = ${admin.membershipId} AND "tenantId" = ${admin.tenantId}
      FOR SHARE`;
    if (actor[0]?.status !== 'ACTIVE') throw new DeactivationError(409, 'ActorInactive', 'Your own membership is no longer active');

    const membership = await tx.iamMembership.findFirst({
      where: { operationalUserId, tenantId: admin.tenantId },
      select: {
        id: true, organizationId: true, status: true,
        user: { select: { id: true, email: true } },
        operationalUser: { select: { accountStatus: true } },
      },
    });
    if (!membership) throw new DeactivationError(404, 'NotFound', 'Member not found');

    const suspended = await tx.iamMembership.updateMany({
      where: { id: membership.id, tenantId: admin.tenantId, status: 'ACTIVE' },
      data: { status: 'SUSPENDED' },
    });
    if (suspended.count !== 1) throw new DeactivationError(409, 'NotActive', 'This member is already deactivated');
    await tx.user.updateMany({
      where: { id: operationalUserId, tenantId: admin.tenantId },
      data: { accountStatus: 'INACTIVE' },
    });
    const revoked = await tx.iamSession.updateMany({
      where: { membershipId: membership.id, tenantId: admin.tenantId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    const [approvalSteps, trainingAssignments, ownedDocuments] = await Promise.all([
      tx.approvalRouteStep.findMany({
        where: { approverId: operationalUserId, tenantId: admin.tenantId, status: 'PENDING' },
        select: { id: true, stepType: true, approvalRoute: { select: { documentVersion: { select: { document: { select: { id: true, title: true } } } } } } },
      }),
      tx.trainingAssignment.findMany({
        where: { userId: operationalUserId, tenantId: admin.tenantId, status: { in: ['ASSIGNED', 'OVERDUE'] } },
        select: { id: true, requirement: { select: { document: { select: { id: true, title: true } } } } },
      }),
      tx.document.findMany({
        where: { ownerId: operationalUserId, tenantId: admin.tenantId, status: { not: 'OBSOLETE' } },
        select: { id: true, documentNumber: true, title: true, status: true },
        orderBy: { title: 'asc' },
      }),
    ]);
    const openWork: OpenWork = {
      approvalSteps: approvalSteps.map((step) => {
        const document = step.approvalRoute.documentVersion.document;
        return { stepId: step.id, stepType: step.stepType, documentId: document.id, documentTitle: document.title };
      }),
      trainingAssignments: trainingAssignments.map((assignment) => ({
        assignmentId: assignment.id, documentId: assignment.requirement.document.id, documentTitle: assignment.requirement.document.title,
      })),
      ownedDocuments: ownedDocuments.map((document) => ({
        documentId: document.id, documentNumber: document.documentNumber, title: document.title, status: document.status,
      })),
    };

    const before = { membershipStatus: membership.status, accountStatus: membership.operationalUser.accountStatus };
    const after = { membershipStatus: 'SUSPENDED', accountStatus: 'INACTIVE' };
    await tx.iamAuditTrail.create({
      data: {
        organizationId: membership.organizationId, userId: admin.iamUserId, userEmail: admin.email, userRole: admin.membershipRole,
        action: 'MEMBER_DEACTIVATED', objectType: 'IamMembership', objectId: membership.id,
        payload: JSON.stringify({ email: membership.user.email, before, after, revokedSessions: revoked.count }), status: 'SUCCESS', reason,
      },
    });
    await writeMandatoryAudit(tx, {
      context: admin, action: 'USER_DEACTIVATED', objectType: 'User', objectId: operationalUserId,
      payload: {
        email: membership.user.email, before, after, revokedSessions: revoked.count, reason,
        openWork: {
          approvalSteps: openWork.approvalSteps.length,
          trainingAssignments: openWork.trainingAssignments.length,
          ownedDocuments: openWork.ownedDocuments.length,
        },
      },
      requestUrl: input.requestUrl,
    });

    return { revokedSessions: revoked.count, openWork };
  });
}
