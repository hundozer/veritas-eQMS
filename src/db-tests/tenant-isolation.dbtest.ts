import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ownerDatabaseUrl } from './connections';
import { createFullAccessRole, markers, requestAs, seedTenant, type SeededTenant } from './fixtures';

const owner = new PrismaClient({ datasourceUrl: ownerDatabaseUrl() });
let a: SeededTenant;
let b: SeededTenant;

const params = (id: string) => ({ params: Promise.resolve({ id }) });

async function bodyText(response: Response): Promise<string> {
  return response.text();
}

function expectNoneOf(text: string, tenant: SeededTenant) {
  for (const marker of markers(tenant)) expect(text).not.toContain(marker);
}

beforeAll(async () => {
  const roleId = await createFullAccessRole(owner);
  a = await seedTenant(owner, 'Alpha', roleId);
  b = await seedTenant(owner, 'Bravo', roleId);
});

afterAll(async () => {
  await owner.$disconnect();
});

describe('two-tenant isolation through the real routes and the application database role', () => {
  it('ISO-T001 the document list shows only the caller\'s tenant', async () => {
    const { GET } = await import('@/app/api/documents/route');
    const response = await GET(requestAs(a, '/api/documents'));
    const text = await bodyText(response);

    expect(response.status).toBe(200);
    expect(text).toContain(a.documentId);
    expectNoneOf(text, b);
  });

  it('ISO-T002 another tenant\'s document reads as not found', async () => {
    const { GET } = await import('@/app/api/documents/[id]/route');
    const own = await GET(requestAs(a, `/api/documents/${a.documentId}`), params(a.documentId));
    const other = await GET(requestAs(a, `/api/documents/${b.documentId}`), params(b.documentId));

    expect(own.status).toBe(200);
    expect(other.status).toBe(404);
    expectNoneOf(await bodyText(other), b);
  });

  it('ISO-T003 another tenant\'s document cannot be rendered as a PDF view', async () => {
    const { GET } = await import('@/app/api/documents/[id]/pdf/route');
    const response = await GET(requestAs(a, `/api/documents/${b.documentId}/pdf`), params(b.documentId));

    expect(response.status).toBe(404);
    expectNoneOf(await bodyText(response), b);
  });

  it('ISO-T004 another tenant\'s draft cannot be edited', async () => {
    const { PUT } = await import('@/app/api/documents/[id]/route');
    const response = await PUT(
      requestAs(a, `/api/documents/${b.documentId}`, { method: 'PUT', body: { title: 'Changed by another tenant', description: 'x' } }),
      params(b.documentId),
    );

    expect(response.status).toBe(404);
    const stored = await owner.document.findUniqueOrThrow({ where: { id: b.documentId } });
    expect(stored.title).toBe(b.documentTitle);
  });

  it('ISO-T005 another tenant\'s document cannot be obsoleted', async () => {
    const { DELETE } = await import('@/app/api/documents/[id]/route');
    const response = await DELETE(
      requestAs(a, `/api/documents/${b.documentId}`, { method: 'DELETE', body: { reason: 'cross-tenant attempt' } }),
      params(b.documentId),
    );

    expect(response.status).toBe(404);
    const stored = await owner.document.findUniqueOrThrow({ where: { id: b.documentId } });
    expect(stored.status).toBe('DRAFT');
    expect(await owner.auditLog.count({ where: { tenantId: b.tenantId, action: 'DOCUMENT_OBSOLETED' } })).toBe(0);
  });

  it('ISO-T006 the audit index shows only the caller\'s tenant', async () => {
    const { GET } = await import('@/app/api/audit/route');
    const response = await GET(requestAs(a, '/api/audit?limit=200'));
    const text = await bodyText(response);

    expect(response.status).toBe(200);
    expect(text).toContain(a.auditEventId);
    expectNoneOf(text, b);
  });

  it('ISO-T007 the training matrix shows only the caller\'s tenant', async () => {
    const { GET } = await import('@/app/api/trainings/route');
    const response = await GET(requestAs(a, '/api/trainings'));
    const text = await bodyText(response);

    expect(response.status).toBe(200);
    expect(text).toContain(a.assignmentId);
    expectNoneOf(text, b);
  });

  it('ISO-T008 the user list shows only the caller\'s tenant', async () => {
    const { GET } = await import('@/app/api/users/route');
    const response = await GET(requestAs(a, '/api/users'));
    const text = await bodyText(response);

    expect(response.status).toBe(200);
    expect(text).toContain(a.colleagueId);
    expectNoneOf(text, b);
  });

  it('ISO-T009 notifications show only the caller\'s own', async () => {
    const { GET } = await import('@/app/api/notifications/route');
    const response = await GET(requestAs(a, '/api/notifications'));
    const text = await bodyText(response);

    expect(response.status).toBe(200);
    expect(text).toContain(a.notificationId);
    expectNoneOf(text, b);
  });

  it('ISO-T010 isolation holds in the other direction too', async () => {
    const list = await (await import('@/app/api/documents/route')).GET(requestAs(b, '/api/documents'));
    const detail = await (await import('@/app/api/documents/[id]/route')).GET(
      requestAs(b, `/api/documents/${a.documentId}`), params(a.documentId),
    );

    expect(list.status).toBe(200);
    expectNoneOf(await bodyText(list), a);
    expect(detail.status).toBe(404);
  });
});
