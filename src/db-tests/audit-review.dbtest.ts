import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ownerDatabaseUrl } from './connections';
import { addMember, createFullAccessRole, requestAs, seedTenant, type SeededTenant } from './fixtures';
import { pdfText } from '../test-support/pdf-text';

// The audit review list (DEC-077) through the real route and application role.
const owner = new PrismaClient({ datasourceUrl: ownerDatabaseUrl() });
let a: SeededTenant;
let b: SeededTenant;
const objectId = randomUUID();

beforeAll(async () => {
  const roleId = await createFullAccessRole(owner);
  a = await seedTenant(owner, 'Alpha', roleId);
  b = await seedTenant(owner, 'Bravo', roleId);
  await owner.auditLog.create({
    data: {
      tenantId: a.tenantId, eventId: randomUUID(), userId: a.operationalUserId, userEmail: a.email, userRole: 'Quality Manager',
      action: 'DOCUMENT_APPROVED', objectType: 'DocumentVersion', objectId, status: 'Success',
      payload: JSON.stringify({ documentId: a.documentId, version: 1, before: 'IN_REVIEW', after: 'APPROVED', comment: 'checked' }),
    },
  });
});

afterAll(async () => {
  await owner.$disconnect();
});

describe('audit review', () => {
  it('AUDREV-T004 an entry shows who, the field change and the details, never the raw payload, and only to its tenant', async () => {
    const { GET } = await import('@/app/api/audit/route');
    const response = await GET(requestAs(a, `/api/audit?objectId=${objectId}`));
    expect(response.status).toBe(200);
    const { logs } = await response.json();

    expect(logs).toEqual([expect.objectContaining({
      action: 'DOCUMENT_APPROVED', userEmail: a.email, objectId,
      changes: [{ field: 'status', before: 'IN_REVIEW', after: 'APPROVED' }],
      details: expect.arrayContaining([{ field: 'comment', value: 'checked' }, { field: 'version', value: '1' }]),
    })]);
    expect(logs[0]).not.toHaveProperty('payload');

    const other = await (await GET(requestAs(b, `/api/audit?objectId=${objectId}`))).json();
    expect(other.logs).toEqual([]);
  });

  it('AUDPDF-T004 the PDF export holds the tenant\'s matching entries, is itself audited, and needs audit.export', async () => {
    const { GET } = await import('@/app/api/audit/export/route');
    const response = await GET(requestAs(a, `/api/audit/export?objectId=${objectId}`));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(response.headers.get('content-disposition')).toMatch(/^attachment; filename="audit-review-\d{4}-\d{2}-\d{2}\.pdf"$/);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const text = pdfText(new Uint8Array(await response.arrayBuffer()));
    expect(text).toContain(`Filters: object ${objectId}`);
    expect(text).toContain('1 entries, newest first');
    expect(text).toContain('status: IN_REVIEW -> APPROVED');
    expect(text).toContain(`By ${a.email}`);

    const exported = await owner.auditLog.findFirstOrThrow({ where: { tenantId: a.tenantId, action: 'AUDIT_EXPORTED' }, orderBy: { timestamp: 'desc' } });
    expect(JSON.parse(exported.payload)).toMatchObject({ format: 'PDF', filters: `object ${objectId}`, entries: 1, truncated: false });

    const otherTenant = pdfText(new Uint8Array(await (await GET(requestAs(b, `/api/audit/export?objectId=${objectId}`))).arrayBuffer()));
    expect(otherTenant).toContain('0 entries');
    expect(otherTenant).not.toContain(a.email);

    const readerRole = await owner.iamRole.create({ data: { name: `Audit reader ${randomUUID()}`, description: 'test', isSystem: false } });
    const auditRead = await owner.iamPermission.findUniqueOrThrow({ where: { name: 'audit.read' } });
    await owner.iamRolePermission.create({ data: { roleId: readerRole.id, permissionId: auditRead.id } });
    const reader = await addMember(owner, a, 'Reader', readerRole.id);
    expect((await GET(requestAs({ ...a, sessionToken: reader.sessionToken }, '/api/audit/export'))).status).toBe(403);
    expect(await owner.auditLog.count({ where: { action: 'AUDIT_EXPORTED', userId: reader.userId } })).toBe(0);
  });
});
