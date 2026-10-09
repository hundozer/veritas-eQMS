import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ownerDatabaseUrl } from './connections';
import { addMember, createFullAccessRole, MEMBER_PASSWORD, requestAs, seedTenant, type SeededTenant } from './fixtures';

// Failed signing attempts are limited per signer (DEC-072), counted from their
// own SIGNATURE_FAILED audit rows through the real routes and database role.
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

beforeAll(async () => {
  const roleId = await createFullAccessRole(owner);
  a = await seedTenant(owner, 'Alpha', roleId);
  b = await seedTenant(owner, 'Bravo', roleId);
});

afterAll(async () => {
  await owner.$disconnect();
});

// A document of the tenant, reviewed and waiting for the approver's signature.
async function awaitingApproval(tenant: SeededTenant) {
  const reviewer = await addMember(owner, tenant, 'Reviewer');
  const approver = await addMember(owner, tenant, 'Approver');
  const { POST: create } = await import('@/app/api/documents/route');
  const { POST: submit } = await import('@/app/api/documents/[id]/submit-review/route');
  const { POST: review } = await import('@/app/api/documents/[id]/review/route');
  const created = await create(requestAs(tenant, '/api/documents', {
    method: 'POST',
    body: { title: 'Limit SOP', classification: 'CONTROLLED', documentType: 'SOP', contentBase64: Buffer.from('synthetic SOP').toString('base64'), fileName: 'sop.txt', mimeType: 'text/plain' },
  }));
  const documentId = (await created.json()).document.id as string;
  expect((await submit(requestAs(tenant, `/api/documents/${documentId}/submit-review`, { method: 'POST', body: { reviewerId: reviewer.userId, approverId: approver.userId } }), params(documentId))).status).toBe(200);
  expect((await review(requestAs({ ...tenant, sessionToken: reviewer.sessionToken }, `/api/documents/${documentId}/review`, { method: 'POST', body: { action: 'COMPLETE', password: MEMBER_PASSWORD } }), params(documentId))).status).toBe(200);

  const { POST: approve } = await import('@/app/api/documents/[id]/approve/route');
  return {
    documentId,
    approverId: approver.userId,
    approve: (password: string) => approve(requestAs({ ...tenant, sessionToken: approver.sessionToken }, `/api/documents/${documentId}/approve`, { method: 'POST', body: { password } }), params(documentId)),
  };
}

describe('limit on failed signing attempts', () => {
  it('SIGLIM-T001 after five wrong passwords the right one is refused too, nothing is signed, and other signers are unaffected', async () => {
    const alpha = await awaitingApproval(a);
    const bravo = await awaitingApproval(b);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await alpha.approve('not-the-password')).status).toBe(403);
    }
    const blocked = await alpha.approve(MEMBER_PASSWORD);
    expect(blocked.status).toBe(429);
    expect((await blocked.json()).error.message).toMatch(/15 minutes/);
    expect((await owner.document.findUniqueOrThrow({ where: { id: alpha.documentId } })).status).toBe('IN_REVIEW');
    const failures = await owner.auditLog.findMany({ where: { tenantId: a.tenantId, userId: alpha.approverId, action: 'SIGNATURE_FAILED' }, select: { payload: true } });
    expect(failures.map((row) => JSON.parse(row.payload).reason)).toEqual(expect.arrayContaining(['PASSWORD_MISMATCH', 'TOO_MANY_ATTEMPTS']));
    expect(failures).toHaveLength(6);

    // Another tenant's signer, with a wrong password of their own, still signs.
    expect((await bravo.approve('not-the-password')).status).toBe(403);
    expect((await bravo.approve(MEMBER_PASSWORD)).status).toBe(200);
    expect((await owner.document.findUniqueOrThrow({ where: { id: bravo.documentId } })).status).toBe('APPROVED');
  });

  it('SIGLIM-T002 wrong passwords older than 15 minutes no longer count', async () => {
    const alpha = await awaitingApproval(a);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await alpha.approve('not-the-password')).status).toBe(403);
    }
    // Audit rows are append-only, so age them by disabling the trigger as owner.
    await owner.$transaction([
      owner.$executeRawUnsafe('ALTER TABLE "AuditLog" DISABLE TRIGGER USER'),
      owner.$executeRaw`UPDATE "AuditLog" SET "timestamp" = now() - interval '16 minutes' WHERE "userId" = ${alpha.approverId} AND action = 'SIGNATURE_FAILED'`,
      owner.$executeRawUnsafe('ALTER TABLE "AuditLog" ENABLE TRIGGER USER'),
    ]);

    expect((await alpha.approve(MEMBER_PASSWORD)).status).toBe(200);
  });
});
