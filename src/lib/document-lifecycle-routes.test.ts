import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  document: { findFirst: vi.fn() },
  documentVersion: { findUnique: vi.fn() },
  user: { findMany: vi.fn() },
  approvalRoute: { findFirst: vi.fn() },
  $transaction: vi.fn(),
}));
const authMock = vi.hoisted(() => ({ getContext: vi.fn() }));
const rbacMock = vi.hoisted(() => ({ hasPermission: vi.fn() }));
const auditMock = vi.hoisted(() => ({ writeMandatoryAudit: vi.fn() }));
const lifecycleMock = vi.hoisted(() => ({
  assertTransition: vi.fn(),
  verifyLifecycleIntegrity: vi.fn(),
  lifecycleErrorResponse: vi.fn(() => null),
}));

vi.mock('@/lib/tenant-db', async () => (await import('../test-support/tenant-db-double')).tenantDbDouble());
vi.mock('@/lib/db', () => ({ default: prismaMock }));
vi.mock('@/lib/auth', () => authMock);
vi.mock('@/lib/rbac', () => rbacMock);
vi.mock('@/lib/audit', () => auditMock);
vi.mock('@/lib/document-lifecycle', () => lifecycleMock);

const context = {
  id: 'approver-1', email: 'qa@example.invalid', fullName: 'QA', role: 'EMPLOYEE', department: 'QA',
  clearance: 'INTERNAL', tenantId: 'tenant-a', tenantName: 'Tenant A', membershipRole: 'QUALITY_MANAGER',
  iamUserId: 'iam-1', membershipId: 'membership-1', roleId: 'role-1',
};
const document = { id: 'doc-1', tenantId: 'tenant-a', ownerId: 'author-1', currentVersionNumber: 1, status: 'DRAFT' };
const version = {
  id: 'version-1', documentId: 'doc-1', versionNumber: 1, status: 'DRAFT', authoredById: 'author-1',
  storageKey: 'immutable/key', hash: 'sha256', sizeBytes: 3,
};

function request(body: Record<string, unknown>) {
  return { json: vi.fn().mockResolvedValue(body), nextUrl: new URL('https://veritas.invalid/api/documents/doc-1/action') } as never;
}

describe('document lifecycle routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    authMock.getContext.mockResolvedValue(context);
    rbacMock.hasPermission.mockReturnValue(true);
    prismaMock.document.findFirst.mockResolvedValue(document);
    prismaMock.documentVersion.findUnique.mockResolvedValue(version);
    lifecycleMock.verifyLifecycleIntegrity.mockResolvedValue({ size: 3 });
    auditMock.writeMandatoryAudit.mockResolvedValue(undefined);
  });

  it('submits an integrity-verified draft with distinct assigned reviewer and approver in one transaction', async () => {
    prismaMock.user.findMany.mockResolvedValue([{ id: 'reviewer-1' }, { id: 'approver-1' }]);
    const tx = {
      documentVersion: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      document: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      approvalRoute: { create: vi.fn().mockResolvedValue({ id: 'route-1', steps: [] }) },
    };
    prismaMock.$transaction.mockImplementation(async (callback: (value: typeof tx) => unknown) => callback(tx));
    const { POST } = await import('../app/api/documents/[id]/submit-review/route');
    const response = await POST(request({ reviewerId: 'reviewer-1', approverId: 'approver-1' }), { params: Promise.resolve({ id: 'doc-1' }) });

    expect(response.status).toBe(200);
    expect(lifecycleMock.assertTransition).toHaveBeenCalledWith('DRAFT', 'IN_REVIEW');
    expect(lifecycleMock.verifyLifecycleIntegrity).toHaveBeenCalledWith(version);
    expect(tx.approvalRoute.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      steps: { create: [
        expect.objectContaining({ approverId: 'reviewer-1', stepType: 'REVIEW' }),
        expect.objectContaining({ approverId: 'approver-1', stepType: 'APPROVAL' }),
      ] },
    }) }));
    expect(auditMock.writeMandatoryAudit).toHaveBeenCalledWith(tx, expect.objectContaining({ action: 'DOCUMENT_SUBMITTED_FOR_REVIEW' }));
  });

  it('rejects author self-approval before any transaction or audit write', async () => {
    authMock.getContext.mockResolvedValue({ ...context, id: 'author-1' });
    prismaMock.document.findFirst.mockResolvedValue({ ...document, status: 'IN_REVIEW' });
    prismaMock.documentVersion.findUnique.mockResolvedValue({ ...version, status: 'IN_REVIEW' });
    const { POST } = await import('../app/api/documents/[id]/approve/route');
    const response = await POST(request({ comment: 'approve' }), { params: Promise.resolve({ id: 'doc-1' }) });

    expect(response.status).toBe(409);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(auditMock.writeMandatoryAudit).not.toHaveBeenCalled();
  });

  it('rejects approval until the assigned review is completed', async () => {
    prismaMock.document.findFirst.mockResolvedValue({ ...document, status: 'IN_REVIEW' });
    prismaMock.documentVersion.findUnique.mockResolvedValue({ ...version, status: 'IN_REVIEW' });
    prismaMock.approvalRoute.findFirst.mockResolvedValue(null);
    const { POST } = await import('../app/api/documents/[id]/approve/route');
    const response = await POST(request({}), { params: Promise.resolve({ id: 'doc-1' }) });

    expect(response.status).toBe(409);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('fails the entire approval when mandatory audit persistence fails', async () => {
    prismaMock.document.findFirst.mockResolvedValue({ ...document, status: 'IN_REVIEW' });
    prismaMock.documentVersion.findUnique.mockResolvedValue({ ...version, status: 'IN_REVIEW' });
    prismaMock.approvalRoute.findFirst.mockResolvedValue({ id: 'route-1', status: 'REVIEWED', steps: [
      { id: 'review-step', stepType: 'REVIEW', status: 'COMPLETED', approverId: 'reviewer-1' },
      { id: 'approval-step', stepType: 'APPROVAL', status: 'PENDING', approverId: 'approver-1' },
    ] });
    const tx = {
      approvalRouteStep: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      documentVersion: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      document: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      approvalRoute: { update: vi.fn() },
    };
    auditMock.writeMandatoryAudit.mockRejectedValue(new Error('audit unavailable'));
    prismaMock.$transaction.mockImplementation(async (callback: (value: typeof tx) => unknown) => callback(tx));
    const { POST } = await import('../app/api/documents/[id]/approve/route');
    const response = await POST(request({}), { params: Promise.resolve({ id: 'doc-1' }) });

    expect(response.status).toBe(500);
    expect(auditMock.writeMandatoryAudit).toHaveBeenCalled();
  });
});
