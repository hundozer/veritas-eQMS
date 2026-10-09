import type { Prisma } from '@prisma/client';
import type { UserContext } from './auth';
import { writeMandatoryAudit } from './audit';

// Training on effective versions (DEC-073). A document's training requirement
// names departments; when a version becomes effective, every active member of
// those departments is assigned that version, and open assignments on earlier
// versions of the document are closed as SUPERSEDED. Who must train is a
// business rule, not an access decision.

/** Splits the stored list ("QA, Production") into distinct, trimmed department names. */
export function parseTrainingDepartments(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  const seen = new Map<string, string>();
  for (const part of value.split(',')) {
    const name = part.trim();
    if (name && !seen.has(name.toLowerCase())) seen.set(name.toLowerCase(), name);
  }
  return [...seen.values()];
}

/** Runs inside the release transaction, after the version is effective. */
export async function assignTrainingForEffectiveVersion(
  tx: Prisma.TransactionClient,
  input: {
    context: UserContext;
    documentId: string;
    version: { id: string; versionNumber: number };
    requestUrl?: string;
  },
) {
  const { context, documentId, version } = input;
  const requirement = await tx.trainingRequirement.findFirst({
    where: { documentId, tenantId: context.tenantId },
    select: { id: true, requiredForRoles: true },
  });
  if (!requirement) return { assigned: 0, superseded: 0 };

  const departments = parseTrainingDepartments(requirement.requiredForRoles);
  const trainees = departments.length === 0 ? [] : await tx.user.findMany({
    where: {
      tenantId: context.tenantId,
      accountStatus: 'ACTIVE',
      iamMembership: { status: 'ACTIVE' },
      OR: departments.map((department) => ({ department: { equals: department, mode: 'insensitive' as const } })),
    },
    select: { id: true },
    orderBy: { id: 'asc' },
  });

  const superseded = await tx.trainingAssignment.updateMany({
    where: {
      tenantId: context.tenantId,
      requirementId: requirement.id,
      status: 'ASSIGNED',
      OR: [{ documentVersionId: null }, { documentVersionId: { not: version.id } }],
    },
    data: { status: 'SUPERSEDED' },
  });
  const created = await tx.trainingAssignment.createMany({
    data: trainees.map((trainee) => ({
      requirementId: requirement.id,
      tenantId: context.tenantId,
      userId: trainee.id,
      documentVersionId: version.id,
      status: 'ASSIGNED',
    })),
    skipDuplicates: true,
  });

  await writeMandatoryAudit(tx, {
    context,
    action: 'TRAINING_ASSIGNED',
    objectType: 'DocumentVersion',
    objectId: version.id,
    payload: {
      documentId,
      version: version.versionNumber,
      departments,
      assignedUserIds: trainees.map((trainee) => trainee.id),
      supersededOpenAssignments: superseded.count,
    },
    requestUrl: input.requestUrl,
  });
  return { assigned: created.count, superseded: superseded.count };
}
