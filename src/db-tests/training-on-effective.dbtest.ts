import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ownerDatabaseUrl } from './connections';
import { addMember, createFullAccessRole, MEMBER_PASSWORD, requestAs, seedTenant, type SeededTenant } from './fixtures';

// Training assigned when a version becomes effective (DEC-073), through the real
// routes and the application database role.
vi.mock('@/lib/controlled-storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/controlled-storage')>();
  const objects = new Map<string, { bytes: Uint8Array; contentType: string }>();
  return {
    ...actual,
    vercelBlobStorage: {
      async putObject(key: string, bytes: Uint8Array, contentType: string) { objects.set(key, { bytes, contentType }); },
      async getObject(key: string) {
        const object = objects.get(key);
        return object ? { key, bytes: object.bytes, contentType: object.contentType, size: object.bytes.byteLength } : null;
      },
      async headObject(key: string) {
        const object = objects.get(key);
        return object ? { key, contentType: object.contentType, size: object.bytes.byteLength } : null;
      },
      async deleteObject(key: string) { objects.delete(key); },
    },
  };
});

const owner = new PrismaClient({ datasourceUrl: ownerDatabaseUrl() });
let a: SeededTenant;
let b: SeededTenant;
const params = (id: string) => ({ params: Promise.resolve({ id }) });
const content = (text: string) => ({ contentBase64: Buffer.from(text).toString('base64'), fileName: 'sop.txt', mimeType: 'text/plain' });

beforeAll(async () => {
  const roleId = await createFullAccessRole(owner);
  a = await seedTenant(owner, 'Alpha', roleId);
  b = await seedTenant(owner, 'Bravo', roleId);
});

afterAll(async () => {
  await owner.$disconnect();
});

// A member of the tenant in a given department, active unless stated.
async function member(tenant: SeededTenant, label: string, department: string, accountStatus = 'ACTIVE') {
  const added = await addMember(owner, tenant, label);
  await owner.user.update({ where: { id: added.userId }, data: { department, accountStatus } });
  return added.userId;
}

async function lifecycle(tenant: SeededTenant, requiredRoles?: string) {
  const reviewer = await addMember(owner, tenant, `Reviewer${randomUUID().slice(0, 4)}`);
  const approver = await addMember(owner, tenant, `Approver${randomUUID().slice(0, 4)}`);
  // Reviewer and approver sit outside the training departments used below.
  await owner.user.updateMany({ where: { id: { in: [reviewer.userId, approver.userId] } }, data: { department: 'Signing' } });
  const as = (token: string) => ({ ...tenant, sessionToken: token });
  const { POST: create } = await import('@/app/api/documents/route');
  const { POST: submit } = await import('@/app/api/documents/[id]/submit-review/route');
  const { POST: review } = await import('@/app/api/documents/[id]/review/route');
  const { POST: approve } = await import('@/app/api/documents/[id]/approve/route');
  const { POST: release } = await import('@/app/api/documents/[id]/release/route');
  const { POST: revise } = await import('@/app/api/documents/[id]/revision/route');

  const created = await create(requestAs(tenant, '/api/documents', {
    method: 'POST', body: { title: 'Training SOP', classification: 'CONTROLLED', documentType: 'SOP', requiredRoles, ...content('version one') },
  }));
  expect(created.status).toBe(201);
  const documentId = (await created.json()).document.id as string;
  const signThrough = async () => {
    expect((await submit(requestAs(tenant, `/api/documents/${documentId}/submit-review`, { method: 'POST', body: { reviewerId: reviewer.userId, approverId: approver.userId } }), params(documentId))).status).toBe(200);
    expect((await review(requestAs(as(reviewer.sessionToken), `/api/documents/${documentId}/review`, { method: 'POST', body: { action: 'COMPLETE', password: MEMBER_PASSWORD } }), params(documentId))).status).toBe(200);
    expect((await approve(requestAs(as(approver.sessionToken), `/api/documents/${documentId}/approve`, { method: 'POST', body: { password: MEMBER_PASSWORD } }), params(documentId))).status).toBe(200);
    expect((await release(requestAs(as(approver.sessionToken), `/api/documents/${documentId}/release`, { method: 'POST', body: { password: MEMBER_PASSWORD } }), params(documentId))).status).toBe(200);
  };
  return {
    documentId,
    signThrough,
    revise: async () => expect((await revise(requestAs(tenant, `/api/documents/${documentId}/revision`, { method: 'POST', body: { reason: 'Annual review', ...content('version two') } }), params(documentId))).status).toBe(201),
    versionId: async (versionNumber: number) => (await owner.documentVersion.findUniqueOrThrow({ where: { documentId_versionNumber: { documentId, versionNumber } } })).id,
    assignments: () => owner.trainingAssignment.findMany({ where: { requirement: { documentId } }, select: { userId: true, status: true, documentVersionId: true, tenantId: true } }),
  };
}

describe('training assigned when a version becomes effective', () => {
  it('TRN-T001 release assigns the active members of the training departments, and only them, the effective version', async () => {
    const qa = await member(a, 'Qa', 'QA');
    const production = await member(a, 'Line', 'Production');
    const administration = await member(a, 'Admin', 'Administration');
    const inactive = await member(a, 'Former', 'QA', 'INACTIVE');
    const otherTenant = await member(b, 'Qa', 'QA');

    const sop = await lifecycle(a, 'qa, Production, QA');
    expect(await sop.assignments()).toEqual([]);
    await sop.signThrough();

    const v1 = await sop.versionId(1);
    const assigned = await sop.assignments();
    const assignedUsers = assigned.map((row) => row.userId);
    expect(assignedUsers).toEqual(expect.arrayContaining([qa, production, a.operationalUserId]));
    expect(assignedUsers).not.toEqual(expect.arrayContaining([administration]));
    expect(assignedUsers).not.toContain(inactive);
    expect(assignedUsers).not.toContain(otherTenant);
    // The seeded colleague is in QA but has no membership, so cannot sign in or train.
    expect(assignedUsers).not.toContain(a.colleagueId);
    expect(new Set(assigned.map((row) => [row.status, row.documentVersionId, row.tenantId].join()))).toEqual(new Set([['ASSIGNED', v1, a.tenantId].join()]));

    const audit = await owner.auditLog.findFirstOrThrow({ where: { tenantId: a.tenantId, action: 'TRAINING_ASSIGNED', objectId: v1 } });
    expect(JSON.parse(audit.payload)).toMatchObject({ documentId: sop.documentId, version: 1, departments: ['qa', 'Production'] });
    expect(await owner.trainingRequirement.findUniqueOrThrow({ where: { documentId: sop.documentId } })).toMatchObject({ requiredForRoles: 'qa, Production' });

    // The trainee's own list names the version to train on; the other tenant sees none of it.
    const { GET } = await import('@/app/api/trainings/route');
    const own = await (await GET(requestAs(a, '/api/trainings'))).json();
    expect(own.assignments.find((row: { requirement: { document: { id: string } } }) => row.requirement.document.id === sop.documentId))
      .toMatchObject({ status: 'ASSIGNED', documentVersion: { versionNumber: 1 } });
    expect(JSON.stringify(await (await GET(requestAs(b, '/api/trainings'))).json())).not.toContain(sop.documentId);
  });

  it('TRN-T002 a new effective version supersedes open assignments, keeps completed ones, and assigns the new version', async () => {
    const qa = await member(a, 'Trainee', 'QA');
    const done = await member(a, 'Done', 'QA');
    const sop = await lifecycle(a, 'QA');
    await sop.signThrough();
    const v1 = await sop.versionId(1);
    await owner.trainingAssignment.updateMany({ where: { userId: done, documentVersionId: v1 }, data: { status: 'COMPLETED', completedAt: new Date() } });

    await sop.revise();
    await sop.signThrough();
    const v2 = await sop.versionId(2);

    const rows = await sop.assignments();
    const of = (userId: string, versionId: string) => rows.find((row) => row.userId === userId && row.documentVersionId === versionId)?.status;
    expect([of(qa, v1), of(qa, v2)]).toEqual(['SUPERSEDED', 'ASSIGNED']);
    expect([of(done, v1), of(done, v2)]).toEqual(['COMPLETED', 'ASSIGNED']);
    expect(rows.filter((row) => row.status === 'ASSIGNED').every((row) => row.documentVersionId === v2)).toBe(true);
  });

  it('TRN-T003 a document without training departments assigns nobody', async () => {
    const sop = await lifecycle(a);
    await sop.signThrough();
    expect(await sop.assignments()).toEqual([]);
    expect(await owner.trainingRequirement.count({ where: { documentId: sop.documentId } })).toBe(0);
    expect(await owner.auditLog.count({ where: { action: 'TRAINING_ASSIGNED', objectId: await sop.versionId(1) } })).toBe(0);
  });
});
