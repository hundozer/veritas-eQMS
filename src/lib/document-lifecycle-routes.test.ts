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
const signatureMock = vi.hoisted(() => {
  class SignatureError extends Error {
    constructor(readonly reason: string) { super(reason); }
  }
  return {
    SignatureError,
    verifySignerOrRecordFailure: vi.fn(),
    recordSignature: vi.fn(),
    clientIp: vi.fn(() => null),
    signatureFailedResponse: vi.fn(() => Response.json({ error: { code: 'SignatureFailed' } }, { status: 403 })),
  };
});
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
vi.mock('@/lib/signatures', () => signatureMock);

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
    signatureMock.verifySignerOrRecordFailure.mockResolvedValue(undefined);
    signatureMock.recordSignature.mockResolvedValue({ id: 'signature-1' });
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

  function readyForApproval() {
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
    prismaMock.$transaction.mockImplementation(async (callback: (value: typeof tx) => unknown) => callback(tx));
    return tx;
  }

  it('SIG-T001 refuses an approval whose password does not verify, before any change', async () => {
    readyForApproval();
    signatureMock.verifySignerOrRecordFailure.mockRejectedValue(new signatureMock.SignatureError('PASSWORD_MISMATCH'));
    const { POST } = await import('../app/api/documents/[id]/approve/route');
    const response = await POST(request({ password: 'wrong' }), { params: Promise.resolve({ id: 'doc-1' }) });

    expect(response.status).toBe(403);
    expect(signatureMock.verifySignerOrRecordFailure).toHaveBeenCalledWith(context, 'wrong', 'version-1', expect.anything());
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(signatureMock.recordSignature).not.toHaveBeenCalled();
  });

  it('SIG-T002 records the approval signature in the same transaction as the status change', async () => {
    const tx = readyForApproval();
    const { POST } = await import('../app/api/documents/[id]/approve/route');
    const response = await POST(request({ password: 'secret', comment: 'ok' }), { params: Promise.resolve({ id: 'doc-1' }) });

    expect(response.status).toBe(200);
    expect(signatureMock.recordSignature).toHaveBeenCalledWith(tx, expect.objectContaining({
      context, meaning: 'APPROVED', comment: 'ok', version: expect.objectContaining({ id: 'version-1', hash: 'sha256' }),
    }));
    expect(lifecycleMock.verifyLifecycleIntegrity).toHaveBeenCalled();
  });

  it('SIG-T003 a completed review is signed; a return for changes is not', async () => {
    authMock.getContext.mockResolvedValue({ ...context, id: 'reviewer-1' });
    prismaMock.document.findFirst.mockResolvedValue({ ...document, status: 'IN_REVIEW' });
    prismaMock.documentVersion.findUnique.mockResolvedValue({ ...version, status: 'IN_REVIEW' });
    prismaMock.approvalRoute.findFirst.mockResolvedValue({ id: 'route-1', status: 'PENDING', steps: [
      { id: 'review-step', stepType: 'REVIEW', status: 'PENDING', approverId: 'reviewer-1' },
    ] });
    const tx = {
      approvalRouteStep: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      approvalRoute: { update: vi.fn() },
      documentVersion: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      document: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
    prismaMock.$transaction.mockImplementation(async (callback: (value: typeof tx) => unknown) => callback(tx));
    const { POST } = await import('../app/api/documents/[id]/review/route');

    const completed = await POST(request({ action: 'COMPLETE', password: 'secret' }), { params: Promise.resolve({ id: 'doc-1' }) });
    expect(completed.status).toBe(200);
    expect(signatureMock.recordSignature).toHaveBeenCalledWith(tx, expect.objectContaining({ meaning: 'REVIEWED' }));

    vi.clearAllMocks();
    authMock.getContext.mockResolvedValue({ ...context, id: 'reviewer-1' });
    rbacMock.hasPermission.mockReturnValue(true);
    prismaMock.document.findFirst.mockResolvedValue({ ...document, status: 'IN_REVIEW' });
    prismaMock.documentVersion.findUnique.mockResolvedValue({ ...version, status: 'IN_REVIEW' });
    prismaMock.approvalRoute.findFirst.mockResolvedValue({ id: 'route-1', status: 'PENDING', steps: [
      { id: 'review-step', stepType: 'REVIEW', status: 'PENDING', approverId: 'reviewer-1' },
    ] });
    prismaMock.$transaction.mockImplementation(async (callback: (value: typeof tx) => unknown) => callback(tx));
    const returned = await POST(request({ action: 'RETURN', comment: 'fix section 2' }), { params: Promise.resolve({ id: 'doc-1' }) });
    expect(returned.status).toBe(200);
    expect(signatureMock.verifySignerOrRecordFailure).not.toHaveBeenCalled();
    expect(signatureMock.recordSignature).not.toHaveBeenCalled();
  });

  function readyForRelease(previousEffective: Array<{ id: string; versionNumber: number }> = []) {
    prismaMock.document.findFirst.mockResolvedValue({ ...document, status: 'APPROVED', currentVersionNumber: 2 });
    prismaMock.documentVersion.findUnique.mockResolvedValue({ ...version, id: 'version-2', versionNumber: 2, status: 'APPROVED' });
    (prismaMock.documentVersion as Record<string, unknown>).findMany = vi.fn().mockResolvedValue(previousEffective);
    const tx = {
      documentVersion: { updateMany: vi.fn().mockResolvedValueOnce({ count: previousEffective.length }).mockResolvedValueOnce({ count: 1 }) },
      document: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
    prismaMock.$transaction.mockImplementation(async (callback: (value: typeof tx) => unknown) => callback(tx));
    return tx;
  }

  it('REL-T001 release needs documents.release and is refused to the author before anything changes', async () => {
    readyForRelease();
    const { POST } = await import('../app/api/documents/[id]/release/route');

    rbacMock.hasPermission.mockReturnValue(false);
    expect((await POST(request({ password: 'pw' }), { params: Promise.resolve({ id: 'doc-1' }) })).status).toBe(403);

    rbacMock.hasPermission.mockReturnValue(true);
    authMock.getContext.mockResolvedValue({ ...context, id: 'author-1' });
    const byAuthor = await POST(request({ password: 'pw' }), { params: Promise.resolve({ id: 'doc-1' }) });
    expect(byAuthor.status).toBe(409);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(signatureMock.verifySignerOrRecordFailure).not.toHaveBeenCalled();
  });

  it('REL-T002 a release whose password does not verify changes nothing', async () => {
    readyForRelease();
    signatureMock.verifySignerOrRecordFailure.mockRejectedValue(new signatureMock.SignatureError('PASSWORD_MISMATCH'));
    const { POST } = await import('../app/api/documents/[id]/release/route');

    const response = await POST(request({ password: 'wrong' }), { params: Promise.resolve({ id: 'doc-1' }) });

    expect(response.status).toBe(403);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('REL-T003 release makes the version effective, supersedes the previous one and signs, in one transaction', async () => {
    const tx = readyForRelease([{ id: 'version-1', versionNumber: 1 }]);
    const { POST } = await import('../app/api/documents/[id]/release/route');

    const response = await POST(request({ password: 'pw' }), { params: Promise.resolve({ id: 'doc-1' }) });

    expect(response.status).toBe(200);
    expect(tx.documentVersion.updateMany).toHaveBeenNthCalledWith(1, { where: { id: { in: ['version-1'] }, status: 'EFFECTIVE' }, data: { status: 'SUPERSEDED' } });
    expect(tx.documentVersion.updateMany).toHaveBeenNthCalledWith(2, expect.objectContaining({ where: { id: 'version-2', status: 'APPROVED' } }));
    expect(signatureMock.recordSignature).toHaveBeenCalledWith(tx, expect.objectContaining({ meaning: 'RELEASED' }));
    expect(auditMock.writeMandatoryAudit).toHaveBeenCalledWith(tx, expect.objectContaining({ action: 'DOCUMENT_RELEASED' }));
    expect(auditMock.writeMandatoryAudit).toHaveBeenCalledWith(tx, expect.objectContaining({ action: 'DOCUMENT_SUPERSEDED', objectId: 'version-1' }));
  });

  it('REL-T004 only an approved current version can be released', async () => {
    readyForRelease();
    prismaMock.document.findFirst.mockResolvedValue({ ...document, status: 'IN_REVIEW', currentVersionNumber: 2 });
    const { POST } = await import('../app/api/documents/[id]/release/route');

    expect((await POST(request({ password: 'pw' }), { params: Promise.resolve({ id: 'doc-1' }) })).status).toBe(409);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  function openRevision() {
    prismaMock.document.findFirst.mockResolvedValue({ ...document, status: 'IN_REVIEW', currentVersionNumber: 2 });
    prismaMock.documentVersion.findUnique.mockResolvedValue({ ...version, id: 'version-2', versionNumber: 2, status: 'IN_REVIEW' });
    (prismaMock.documentVersion as Record<string, unknown>).findFirst = vi.fn().mockResolvedValue({ ...version, id: 'version-1', versionNumber: 1, status: 'EFFECTIVE' });
    const tx = {
      documentVersion: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      document: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      approvalRoute: { findMany: vi.fn().mockResolvedValue([{ id: 'route-2' }]), updateMany: vi.fn() },
      approvalRouteStep: { updateMany: vi.fn() },
    };
    prismaMock.$transaction.mockImplementation(async (callback: (value: typeof tx) => unknown) => callback(tx));
    return tx;
  }

  it('WDR-T001 withdrawing needs a reason and revision permission', async () => {
    openRevision();
    const { POST } = await import('../app/api/documents/[id]/withdraw-revision/route');

    expect((await POST(request({}), { params: Promise.resolve({ id: 'doc-1' }) })).status).toBe(400);
    rbacMock.hasPermission.mockReturnValue(false);
    expect((await POST(request({ reason: 'not needed' }), { params: Promise.resolve({ id: 'doc-1' }) })).status).toBe(403);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('WDR-T002 a first draft with no effective version is not a revision and cannot be withdrawn', async () => {
    openRevision();
    (prismaMock.documentVersion as Record<string, ReturnType<typeof vi.fn>>).findFirst.mockResolvedValue(null);
    const { POST } = await import('../app/api/documents/[id]/withdraw-revision/route');

    expect((await POST(request({ reason: 'abandon' }), { params: Promise.resolve({ id: 'doc-1' }) })).status).toBe(409);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('WDR-T003 withdraws the revision, cancels its open review and returns to the effective version, audited', async () => {
    const tx = openRevision();
    const { POST } = await import('../app/api/documents/[id]/withdraw-revision/route');

    const response = await POST(request({ reason: 'superseded by regulation change' }), { params: Promise.resolve({ id: 'doc-1' }) });

    expect(response.status).toBe(200);
    expect(tx.documentVersion.updateMany).toHaveBeenCalledWith({ where: { id: 'version-2', status: 'IN_REVIEW' }, data: { status: 'WITHDRAWN' } });
    expect(tx.document.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'doc-1', tenantId: 'tenant-a', currentVersionNumber: 2 }),
      data: { status: 'EFFECTIVE', currentVersionNumber: 1 },
    }));
    expect(tx.approvalRoute.updateMany).toHaveBeenCalledWith({ where: { id: { in: ['route-2'] } }, data: { status: 'CANCELLED' } });
    expect(auditMock.writeMandatoryAudit).toHaveBeenCalledWith(tx, expect.objectContaining({
      action: 'DOCUMENT_REVISION_WITHDRAWN', payload: expect.objectContaining({ reason: 'superseded by regulation change', effectiveVersion: 1 }),
    }));
  });
});
