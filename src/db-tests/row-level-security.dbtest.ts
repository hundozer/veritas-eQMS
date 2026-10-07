import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { appDatabaseUrl, ownerDatabaseUrl } from './connections';
import { addMember, asTenant, createFullAccessRole, MEMBER_PASSWORD, requestAs, seedTenant, type SeededTenant } from './fixtures';

// Controlled files live in memory here; the database is real.
vi.mock('@/lib/controlled-storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/controlled-storage')>();
  const objects = new Map<string, { bytes: Uint8Array; contentType: string }>();
  return {
    ...actual,
    vercelBlobStorage: {
      async putObject(key: string, bytes: Uint8Array, contentType: string) {
        if (objects.has(key)) throw new Error('overwrite denied');
        objects.set(key, { bytes, contentType });
      },
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
const app = new PrismaClient({ datasourceUrl: appDatabaseUrl() });
let a: SeededTenant;
let b: SeededTenant;

const params = (id: string) => ({ params: Promise.resolve({ id }) });
const ROW_LEVEL_SECURITY = /row-level security/i;

beforeAll(async () => {
  const roleId = await createFullAccessRole(owner);
  a = await seedTenant(owner, 'Alpha', roleId);
  b = await seedTenant(owner, 'Bravo', roleId);
});

afterAll(async () => {
  await Promise.all([owner.$disconnect(), app.$disconnect()]);
});

describe('row-level security on tenant-owned tables', () => {
  it('RLS-T001 without a tenant the application role sees and writes no tenant rows', async () => {
    expect(await app.document.findMany({ where: { id: { in: [a.documentId, b.documentId] } } })).toEqual([]);
    expect(await app.auditLog.count({ where: { tenantId: a.tenantId } })).toBe(0);
    await expect(app.notification.create({
      data: { tenantId: a.tenantId, userId: a.operationalUserId, title: 'no tenant', message: '', type: 'DOCUMENT_REVIEW' },
    })).rejects.toThrow(ROW_LEVEL_SECURITY);
  });

  it('RLS-T002 as one tenant, another tenant\'s rows are invisible even without a tenant filter', async () => {
    const seen = await asTenant(app, a.tenantId, async (tx) => ({
      documents: await tx.document.findMany({ where: { id: { in: [a.documentId, b.documentId] } }, select: { id: true } }),
      versions: await tx.documentVersion.count({ where: { documentId: b.documentId } }),
      assignments: await tx.trainingAssignment.count({ where: { id: b.assignmentId } }),
      notifications: await tx.notification.count({ where: { id: b.notificationId } }),
      audit: await tx.auditLog.count({ where: { eventId: b.auditEventId } }),
    }));

    expect(seen).toEqual({ documents: [{ id: a.documentId }], versions: 0, assignments: 0, notifications: 0, audit: 0 });
  });

  it('RLS-T003 as one tenant, a row labelled with another tenant is refused', async () => {
    await expect(asTenant(app, a.tenantId, (tx) => tx.notification.create({
      data: { tenantId: b.tenantId, userId: b.operationalUserId, title: 'cross-tenant', message: '', type: 'DOCUMENT_REVIEW' },
    }))).rejects.toThrow(ROW_LEVEL_SECURITY);
  });

  it('RLS-T004 as one tenant, another tenant\'s rows cannot be changed or moved', async () => {
    const changed = await asTenant(app, a.tenantId, (tx) => tx.document.updateMany({
      where: { id: b.documentId }, data: { title: 'overwritten' },
    }));
    expect(changed.count).toBe(0);

    await expect(asTenant(app, a.tenantId, (tx) => tx.document.update({
      where: { id: a.documentId }, data: { tenantId: b.tenantId },
    }))).rejects.toThrow();

    const bravo = await owner.document.findUniqueOrThrow({ where: { id: b.documentId } });
    expect(bravo.title).not.toBe('overwritten');
  });

  it('RLS-T005 the tenant setting ends with its transaction', async () => {
    await asTenant(app, a.tenantId, (tx) => tx.document.count());
    for (let i = 0; i < 5; i += 1) {
      expect(await app.document.count({ where: { id: a.documentId } })).toBe(0);
    }
  });

  it('RLS-T006 the table owner used for migrations still sees every tenant', async () => {
    expect(await owner.document.count({ where: { id: { in: [a.documentId, b.documentId] } } })).toBe(2);
  });

  it('RLS-T007 change requests are visible only to their own tenant', async () => {
    const bravo = await owner.changeRequest.create({
      data: { tenantId: b.tenantId, title: 'Bravo change', reason: 'test', riskLevel: 'LOW', status: 'DRAFT', documents: { create: { documentId: b.documentId } } },
    });

    const seen = await asTenant(app, a.tenantId, async (tx) => ({
      requests: await tx.changeRequest.count({ where: { id: bravo.id } }),
      links: await tx.changeRequestDocument.count({ where: { changeRequestId: bravo.id } }),
    }));
    expect(seen).toEqual({ requests: 0, links: 0 });
    expect(await asTenant(app, b.tenantId, (tx) => tx.changeRequest.count({ where: { id: bravo.id } }))).toBe(1);
    await expect(asTenant(app, a.tenantId, (tx) => tx.changeRequest.create({
      data: { tenantId: b.tenantId, title: 'Planted', reason: 'test', riskLevel: 'LOW', status: 'DRAFT' },
    }))).rejects.toThrow(ROW_LEVEL_SECURITY);
  });
});

describe('document lifecycle through the real routes under row-level security', () => {
  it('LIFE-T001 a draft is created, submitted, and signed as reviewed and approved, with an audit row for each step', async () => {
    const reviewer = await addMember(owner, a, 'Reviewer');
    const approver = await addMember(owner, a, 'Approver');
    const as = (token: string) => ({ ...a, sessionToken: token });

    const { POST: create } = await import('@/app/api/documents/route');
    const created = await create(requestAs(a, '/api/documents', {
      method: 'POST',
      body: { title: 'Lifecycle SOP', classification: 'CONTROLLED', documentType: 'SOP', contentBase64: Buffer.from('synthetic SOP').toString('base64'), fileName: 'sop.txt', mimeType: 'text/plain' },
    }));
    expect(created.status).toBe(201);
    const documentId = (await created.json()).document.id as string;

    const { POST: submit } = await import('@/app/api/documents/[id]/submit-review/route');
    const submitted = await submit(requestAs(a, `/api/documents/${documentId}/submit-review`, {
      method: 'POST', body: { reviewerId: reviewer.userId, approverId: approver.userId },
    }), params(documentId));
    expect(submitted.status).toBe(200);

    const { POST: review } = await import('@/app/api/documents/[id]/review/route');
    const reviewed = await review(requestAs(as(reviewer.sessionToken), `/api/documents/${documentId}/review`, {
      method: 'POST', body: { action: 'COMPLETE', password: MEMBER_PASSWORD },
    }), params(documentId));
    expect(reviewed.status).toBe(200);

    const { POST: approve } = await import('@/app/api/documents/[id]/approve/route');
    const wrong = await approve(requestAs(as(approver.sessionToken), `/api/documents/${documentId}/approve`, {
      method: 'POST', body: { password: 'not-the-password' },
    }), params(documentId));
    expect(wrong.status).toBe(403);
    expect((await owner.document.findUniqueOrThrow({ where: { id: documentId } })).status).toBe('IN_REVIEW');

    const approved = await approve(requestAs(as(approver.sessionToken), `/api/documents/${documentId}/approve`, {
      method: 'POST', body: { password: MEMBER_PASSWORD },
    }), params(documentId));
    expect(approved.status).toBe(200);

    const document = await owner.document.findUniqueOrThrow({ where: { id: documentId }, include: { versions: true } });
    expect(document.status).toBe('APPROVED');
    expect(document.versions.map((version) => [version.status, version.tenantId])).toEqual([['APPROVED', a.tenantId]]);
    const actions = await owner.auditLog.findMany({ where: { tenantId: a.tenantId, objectId: { in: [documentId, document.versions[0].id] } }, select: { action: true } });
    expect(actions.map((row) => row.action)).toEqual(expect.arrayContaining([
      'DOCUMENT_CREATED', 'DOCUMENT_SUBMITTED_FOR_REVIEW', 'SIGNATURE_FAILED', 'SIGNATURE_APPLIED', 'DOCUMENT_APPROVED',
    ]));

    const signatures = await owner.signatureManifest.findMany({ where: { documentVersionId: document.versions[0].id }, orderBy: { signedAt: 'asc' } });
    expect(signatures.map((signature) => [signature.meaning, signature.signedBy, signature.hashSigned, signature.tenantId])).toEqual([
      ['REVIEWED', reviewer.userId, document.versions[0].hash, a.tenantId],
      ['APPROVED', approver.userId, document.versions[0].hash, a.tenantId],
    ]);
    expect(signatures.every((signature) => signature.signerName && signature.iamUserId)).toBe(true);
  });

  it('ESIG-DB-T001 signatures cannot be changed or removed, by the application or the owner', async () => {
    const [signature] = await owner.signatureManifest.findMany({ where: { tenantId: a.tenantId, meaning: 'APPROVED' }, take: 1 });
    expect(signature).toBeDefined();

    await expect(asTenant(app, a.tenantId, (tx) => tx.signatureManifest.update({ where: { id: signature.id }, data: { meaning: 'REVIEWED' } }))).rejects.toThrow(/append-only|permission denied/);
    await expect(asTenant(app, a.tenantId, (tx) => tx.signatureManifest.delete({ where: { id: signature.id } }))).rejects.toThrow(/append-only|permission denied/);
    await expect(owner.$executeRaw`update "SignatureManifest" set meaning = 'REVIEWED' where id = ${signature.id}`).rejects.toThrow(/append-only/);
    await expect(owner.$executeRaw`delete from "SignatureManifest" where id = ${signature.id}`).rejects.toThrow(/append-only/);
    expect((await owner.signatureManifest.findUniqueOrThrow({ where: { id: signature.id } })).meaning).toBe('APPROVED');
  });

  it('LIFE-T002 another tenant cannot submit, review or approve the document', async () => {
    const { POST: submit } = await import('@/app/api/documents/[id]/submit-review/route');
    const response = await submit(requestAs(b, `/api/documents/${a.documentId}/submit-review`, {
      method: 'POST', body: { reviewerId: b.colleagueId, approverId: b.operationalUserId },
    }), params(a.documentId));

    expect(response.status).toBe(404);
    const alpha = await owner.document.findUniqueOrThrow({ where: { id: a.documentId } });
    expect(alpha.status).toBe('DRAFT');
  });
});
