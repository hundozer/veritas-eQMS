import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  document: { findFirst: vi.fn() },
  documentVersion: { findUnique: vi.fn(), findMany: vi.fn() },
  $transaction: vi.fn(),
}));
const authMock = vi.hoisted(() => ({ getContext: vi.fn(), logAuditEvent: vi.fn() }));
const rbacMock = vi.hoisted(() => ({ hasPermission: vi.fn() }));
const auditMock = vi.hoisted(() => ({ writeMandatoryAudit: vi.fn() }));
const lifecycleMock = vi.hoisted(() => ({
  assertTransition: vi.fn(),
  lifecycleErrorResponse: vi.fn(() => null),
}));

vi.mock('@/lib/tenant-db', async () => (await import('../test-support/tenant-db-double')).tenantDbDouble());
vi.mock('@/lib/db', () => ({ default: prismaMock }));
vi.mock('@/lib/auth', () => authMock);
vi.mock('@/lib/rbac', () => rbacMock);
vi.mock('@/lib/audit', () => auditMock);
vi.mock('@/lib/document-lifecycle', () => lifecycleMock);
vi.mock('@/lib/controlled-storage', () => ({
  cleanupUncontrolledObject: vi.fn(),
  createControlledObjectKey: vi.fn(),
  decodeControlledUpload: vi.fn(),
  vercelBlobStorage: {},
}));

const context = {
  id: 'qm-1', email: 'qm@example.invalid', fullName: 'QM', role: 'EMPLOYEE', department: 'QA',
  clearance: 'INTERNAL', tenantId: 'tenant-a', tenantName: 'Tenant A', membershipRole: 'QUALITY_MANAGER',
  iamUserId: 'iam-1', membershipId: 'membership-1', roleId: 'role-1', permissions: ['documents.obsolete'],
};

function request(body: Record<string, unknown>) {
  return {
    json: vi.fn().mockResolvedValue(body),
    nextUrl: new URL('https://veritas.invalid/api/documents/doc-1'),
  } as never;
}

function transactionWith(counts: { version: number; effective: number; document: number }) {
  const tx = {
    documentVersion: {
      updateMany: vi.fn()
        .mockResolvedValueOnce({ count: counts.version })
        .mockResolvedValueOnce({ count: counts.effective }),
    },
    document: {
      updateMany: vi.fn().mockResolvedValue({ count: counts.document }),
      findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'doc-1', status: 'OBSOLETE' }),
    },
  };
  prismaMock.$transaction.mockImplementation(async (callback: (value: typeof tx) => unknown) => callback(tx));
  return tx;
}

describe('document obsolescence route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    authMock.getContext.mockResolvedValue(context);
    rbacMock.hasPermission.mockReturnValue(true);
    auditMock.writeMandatoryAudit.mockResolvedValue(undefined);
  });

  it('OBSOLETE-T001 refuses while a revision is open and leaves the effective version untouched', async () => {
    prismaMock.document.findFirst.mockResolvedValue({ id: 'doc-1', tenantId: 'tenant-a', status: 'DRAFT', currentVersionNumber: 2 });
    prismaMock.documentVersion.findUnique.mockResolvedValue({ id: 'v2', versionNumber: 2, status: 'DRAFT' });
    prismaMock.documentVersion.findMany.mockResolvedValue([{ id: 'v1', versionNumber: 1 }]);

    const { DELETE } = await import('../app/api/documents/[id]/route');
    const response = await DELETE(request({ reason: 'abandon revision' }), { params: Promise.resolve({ id: 'doc-1' }) });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'RevisionInProgress' } });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(auditMock.writeMandatoryAudit).not.toHaveBeenCalled();
  });

  it('OBSOLETE-T002 retires the current effective version with a mandatory audit row', async () => {
    prismaMock.document.findFirst.mockResolvedValue({ id: 'doc-1', tenantId: 'tenant-a', status: 'EFFECTIVE', currentVersionNumber: 1 });
    prismaMock.documentVersion.findUnique.mockResolvedValue({ id: 'v1', versionNumber: 1, status: 'EFFECTIVE' });
    prismaMock.documentVersion.findMany.mockResolvedValue([]);
    const tx = transactionWith({ version: 1, effective: 0, document: 1 });

    const { DELETE } = await import('../app/api/documents/[id]/route');
    const response = await DELETE(request({ reason: 'process retired' }), { params: Promise.resolve({ id: 'doc-1' }) });

    expect(response.status).toBe(200);
    expect(tx.documentVersion.updateMany).toHaveBeenNthCalledWith(1, { where: { id: 'v1', status: 'EFFECTIVE' }, data: { status: 'OBSOLETE' } });
    expect(auditMock.writeMandatoryAudit).toHaveBeenCalledTimes(1);
    expect(auditMock.writeMandatoryAudit).toHaveBeenCalledWith(tx, expect.objectContaining({
      action: 'DOCUMENT_OBSOLETED',
      objectId: 'v1',
      payload: expect.objectContaining({ before: 'EFFECTIVE', reason: 'process retired' }),
    }));
  });

  it('OBSOLETE-T003 obsoletes a first draft that never became effective', async () => {
    prismaMock.document.findFirst.mockResolvedValue({ id: 'doc-1', tenantId: 'tenant-a', status: 'DRAFT', currentVersionNumber: 1 });
    prismaMock.documentVersion.findUnique.mockResolvedValue({ id: 'v1', versionNumber: 1, status: 'DRAFT' });
    prismaMock.documentVersion.findMany.mockResolvedValue([]);
    transactionWith({ version: 1, effective: 0, document: 1 });

    const { DELETE } = await import('../app/api/documents/[id]/route');
    const response = await DELETE(request({ reason: 'not needed' }), { params: Promise.resolve({ id: 'doc-1' }) });

    expect(response.status).toBe(200);
    expect(auditMock.writeMandatoryAudit).toHaveBeenCalledTimes(1);
  });

  it('OBSOLETE-T004 requires a reason before reading any record', async () => {
    const { DELETE } = await import('../app/api/documents/[id]/route');
    const response = await DELETE(request({}), { params: Promise.resolve({ id: 'doc-1' }) });

    expect(response.status).toBe(400);
    expect(prismaMock.document.findFirst).not.toHaveBeenCalled();
  });

  it('OBSOLETE-T005 refuses without documents.obsolete before reading input or records', async () => {
    rbacMock.hasPermission.mockReturnValue(false);
    const req = request({ reason: 'not allowed' });

    const { DELETE } = await import('../app/api/documents/[id]/route');
    const response = await DELETE(req, { params: Promise.resolve({ id: 'doc-1' }) });

    expect(response.status).toBe(403);
    expect(rbacMock.hasPermission).toHaveBeenCalledWith(context, 'documents.obsolete');
    expect((req as unknown as { json: ReturnType<typeof vi.fn> }).json).not.toHaveBeenCalled();
    expect(prismaMock.document.findFirst).not.toHaveBeenCalled();
  });

  it('OBSOLETE-T006 treats another tenant\'s document as not found', async () => {
    prismaMock.document.findFirst.mockResolvedValue(null);

    const { DELETE } = await import('../app/api/documents/[id]/route');
    const response = await DELETE(request({ reason: 'cross-tenant' }), { params: Promise.resolve({ id: 'doc-other-tenant' }) });

    expect(response.status).toBe(404);
    expect(prismaMock.document.findFirst).toHaveBeenCalledWith({ where: { id: 'doc-other-tenant', tenantId: 'tenant-a' } });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('OBSOLETE-T007 reports a stale action when the version changed under the request', async () => {
    prismaMock.document.findFirst.mockResolvedValue({ id: 'doc-1', tenantId: 'tenant-a', status: 'EFFECTIVE', currentVersionNumber: 1 });
    prismaMock.documentVersion.findUnique.mockResolvedValue({ id: 'v1', versionNumber: 1, status: 'EFFECTIVE' });
    prismaMock.documentVersion.findMany.mockResolvedValue([]);
    transactionWith({ version: 0, effective: 0, document: 1 });

    const { DELETE } = await import('../app/api/documents/[id]/route');
    const response = await DELETE(request({ reason: 'race' }), { params: Promise.resolve({ id: 'doc-1' }) });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'StaleWorkflowAction' } });
    expect(auditMock.writeMandatoryAudit).not.toHaveBeenCalled();
  });
});
