import { randomUUID } from 'crypto';
import type { Prisma } from '@prisma/client';
import type { UserContext } from './auth';

type MandatoryAuditInput = {
  context: UserContext;
  action: string;
  objectType: string;
  objectId?: string;
  payload: Record<string, unknown>;
  sourceIp?: string;
  requestUrl?: string;
};

export async function writeMandatoryAudit(
  tx: Prisma.TransactionClient,
  input: MandatoryAuditInput,
): Promise<void> {
  await tx.auditLog.create({
    data: {
      tenantId: input.context.tenantId,
      eventId: randomUUID(),
      userId: input.context.id,
      iamUserId: input.context.iamUserId,
      membershipId: input.context.membershipId,
      roleId: input.context.roleId,
      userEmail: input.context.email,
      userRole: input.context.membershipRole,
      action: input.action,
      objectType: input.objectType,
      objectId: input.objectId ?? null,
      payload: JSON.stringify(input.payload),
      status: 'Success',
      sourceIp: input.sourceIp ?? null,
      requestUrl: input.requestUrl ?? null,
    },
  });
}
