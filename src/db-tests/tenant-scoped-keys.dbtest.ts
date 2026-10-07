import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { appDatabaseUrl, ownerDatabaseUrl } from './connections';
import { asTenant, createFullAccessRole, seedTenant, type SeededTenant } from './fixtures';

// The database itself must refuse a row that links records of two tenants, even
// when application code passes it a wrong identifier. Writes go through the
// application role inside a tenant transaction, as in production.
const owner = new PrismaClient({ datasourceUrl: ownerDatabaseUrl() });
const app = new PrismaClient({ datasourceUrl: appDatabaseUrl() });
let a: SeededTenant;
let b: SeededTenant;
let aVersionId: string;

const FOREIGN_KEY_VIOLATION = /Foreign key constraint|violates foreign key/i;

beforeAll(async () => {
  const roleId = await createFullAccessRole(owner);
  a = await seedTenant(owner, 'Alpha', roleId);
  b = await seedTenant(owner, 'Bravo', roleId);
  const version = await owner.documentVersion.findFirstOrThrow({ where: { documentId: a.documentId } });
  aVersionId = version.id;
});

afterAll(async () => {
  await Promise.all([owner.$disconnect(), app.$disconnect()]);
});

describe('tenant-scoped keys reject cross-tenant links', () => {
  it('TKEY-T001 every existing document row carries the tenant of its document', async () => {
    const version = await owner.documentVersion.findUniqueOrThrow({ where: { id: aVersionId } });
    const assignment = await owner.trainingAssignment.findUniqueOrThrow({ where: { id: a.assignmentId } });

    expect(version.tenantId).toBe(a.tenantId);
    expect(assignment.tenantId).toBe(a.tenantId);
  });

  it('TKEY-T002 a document cannot be owned by another tenant\'s user', async () => {
    await expect(asTenant(app, a.tenantId, (tx) => tx.document.create({
      data: { title: 'cross-tenant', description: '', classification: 'CONTROLLED', status: 'DRAFT', ownerId: b.operationalUserId, tenantId: a.tenantId },
    }))).rejects.toThrow(FOREIGN_KEY_VIOLATION);
  });

  it('TKEY-T003 a version cannot attach to another tenant\'s document or author', async () => {
    const version = { versionNumber: 99, status: 'DRAFT', filePath: '', hash: 'b'.repeat(64), createdBy: 'test' };

    await expect(asTenant(app, a.tenantId, (tx) => tx.documentVersion.create({
      data: { ...version, documentId: b.documentId, tenantId: a.tenantId },
    }))).rejects.toThrow(FOREIGN_KEY_VIOLATION);
    await expect(asTenant(app, a.tenantId, (tx) => tx.documentVersion.create({
      data: { ...version, documentId: a.documentId, tenantId: a.tenantId, authoredById: b.operationalUserId },
    }))).rejects.toThrow(FOREIGN_KEY_VIOLATION);
  });

  it('TKEY-T004 an approval step cannot name another tenant\'s approver', async () => {
    const route = await asTenant(app, a.tenantId, (tx) => tx.approvalRoute.create({
      data: { documentVersionId: aVersionId, tenantId: a.tenantId, status: 'PENDING' },
    }));

    await expect(asTenant(app, a.tenantId, (tx) => tx.approvalRouteStep.create({
      data: { approvalRouteId: route.id, tenantId: a.tenantId, approverId: b.colleagueId, sequence: 1, status: 'PENDING' },
    }))).rejects.toThrow(FOREIGN_KEY_VIOLATION);
    // Acting as Bravo, so row-level security allows the row and the key decides.
    await expect(asTenant(app, b.tenantId, (tx) => tx.approvalRoute.create({
      data: { documentVersionId: aVersionId, tenantId: b.tenantId, status: 'PENDING' },
    }))).rejects.toThrow(FOREIGN_KEY_VIOLATION);
  });

  it('TKEY-T005 a signature cannot be recorded by another tenant\'s user', async () => {
    await expect(asTenant(app, a.tenantId, (tx) => tx.signatureManifest.create({
      data: { documentVersionId: aVersionId, tenantId: a.tenantId, signedBy: b.operationalUserId, meaning: 'Approval', hashSigned: 'b'.repeat(64), ipAddress: '192.0.2.1' },
    }))).rejects.toThrow(FOREIGN_KEY_VIOLATION);
  });

  it('TKEY-T006 training cannot be assigned to another tenant\'s user', async () => {
    const assignment = await owner.trainingAssignment.findUniqueOrThrow({ where: { id: a.assignmentId } });

    await expect(asTenant(app, a.tenantId, (tx) => tx.trainingAssignment.create({
      data: { requirementId: assignment.requirementId, tenantId: a.tenantId, userId: b.colleagueId, status: 'ASSIGNED' },
    }))).rejects.toThrow(FOREIGN_KEY_VIOLATION);
    await expect(asTenant(app, a.tenantId, (tx) => tx.quizResult.create({
      data: { userId: b.colleagueId, tenantId: a.tenantId, score: 100, passed: true },
    }))).rejects.toThrow(FOREIGN_KEY_VIOLATION);
  });

  it('TKEY-T007 a notification cannot address another tenant\'s user', async () => {
    await expect(asTenant(app, a.tenantId, (tx) => tx.notification.create({
      data: { tenantId: a.tenantId, userId: b.colleagueId, title: 'cross-tenant', message: '', type: 'DOCUMENT_REVIEW' },
    }))).rejects.toThrow(FOREIGN_KEY_VIOLATION);
  });

  it('TKEY-T008 moving a user to another tenant cannot silently move their records', async () => {
    await expect(owner.user.update({
      where: { id: a.operationalUserId },
      data: { tenantId: b.tenantId },
    })).rejects.toThrow(FOREIGN_KEY_VIOLATION);

    const document = await owner.document.findUniqueOrThrow({ where: { id: a.documentId } });
    expect(document.tenantId).toBe(a.tenantId);
  });

  it('TKEY-T009 same-tenant links still work for the application role', async () => {
    const quiz = await asTenant(app, a.tenantId, (tx) => tx.quizResult.create({
      data: { id: randomUUID(), userId: a.colleagueId, tenantId: a.tenantId, score: 80, passed: true },
    }));
    expect(quiz.tenantId).toBe(a.tenantId);
  });

  it('TKEY-T010 a change request cannot link another tenant\'s document', async () => {
    const changeRequest = await asTenant(app, a.tenantId, (tx) => tx.changeRequest.create({
      data: { tenantId: a.tenantId, title: 'Alpha change', reason: 'test', riskLevel: 'LOW', status: 'DRAFT' },
    }));

    await expect(asTenant(app, a.tenantId, (tx) => tx.changeRequestDocument.create({
      data: { changeRequestId: changeRequest.id, tenantId: a.tenantId, documentId: b.documentId },
    }))).rejects.toThrow(FOREIGN_KEY_VIOLATION);
    const linked = await asTenant(app, a.tenantId, (tx) => tx.changeRequestDocument.create({
      data: { changeRequestId: changeRequest.id, tenantId: a.tenantId, documentId: a.documentId },
    }));
    expect(linked.tenantId).toBe(a.tenantId);
  });
});
