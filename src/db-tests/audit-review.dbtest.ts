import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ownerDatabaseUrl } from './connections';
import { createFullAccessRole, requestAs, seedTenant, type SeededTenant } from './fixtures';

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
});
