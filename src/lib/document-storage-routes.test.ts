import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  document: { findUnique: vi.fn() },
  $transaction: vi.fn(),
}));
const authMock = vi.hoisted(() => ({ getContext: vi.fn(), logAuditEvent: vi.fn() }));
const rbacMock = vi.hoisted(() => ({ hasPermission: vi.fn() }));
const auditMock = vi.hoisted(() => ({ writeMandatoryAudit: vi.fn() }));
const storageMock = vi.hoisted(() => ({
  vercelBlobStorage: { putObject: vi.fn(), getObject: vi.fn(), headObject: vi.fn(), deleteObject: vi.fn() },
  cleanupUncontrolledObject: vi.fn(),
  createControlledObjectKey: vi.fn(() => 'tenants/tenant-a/documents/doc-1/versions/1/immutable-id'),
  decodeControlledUpload: vi.fn(() => ({
    bytes: new Uint8Array([1, 2, 3]), fileName: 'record.pdf', mimeType: 'application/pdf', hash: 'stored-sha256',
  })),
  sanitizeDisplayFileName: vi.fn((value: string) => value),
  sha256: vi.fn(() => 'stored-sha256'),
  verifyControlledObject: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ default: prismaMock }));
vi.mock('@/lib/auth', () => authMock);
vi.mock('@/lib/rbac', () => rbacMock);
vi.mock('@/lib/audit', () => auditMock);
vi.mock('@/lib/controlled-storage', () => storageMock);

const context = {
  iamUserId: 'iam-1', membershipId: 'membership-1', roleId: 'role-1', membershipRole: 'QUALITY_MANAGER',
  id: 'user-1', email: 'actor@example.invalid', fullName: 'Actor', role: 'EMPLOYEE', department: 'QA',
  clearance: 'INTERNAL', tenantId: 'tenant-a', tenantName: 'Tenant A',
};

function request(body: Record<string, unknown> = {}, url = 'https://veritas.invalid/api/documents') {
  return {
    json: vi.fn().mockResolvedValue(body),
    nextUrl: new URL(url),
  } as never;
}

describe('controlled document upload route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    authMock.getContext.mockResolvedValue(context);
    rbacMock.hasPermission.mockReturnValue(true);
    storageMock.vercelBlobStorage.putObject.mockResolvedValue(undefined);
    storageMock.cleanupUncontrolledObject.mockResolvedValue(true);
    auditMock.writeMandatoryAudit.mockResolvedValue(undefined);
  });

  it('stores authoritative object metadata and mandatory audit in one DB transaction', async () => {
    const tx = {
      document: { create: vi.fn().mockResolvedValue({ id: 'doc-1', title: 'SOP', classification: 'CONTROLLED', status: 'DRAFT' }) },
      documentVersion: { create: vi.fn().mockResolvedValue({}) },
      trainingRequirement: { create: vi.fn() }, auditLog: { create: vi.fn() },
    };
    prismaMock.$transaction.mockImplementation(async (callback: (value: typeof tx) => unknown) => callback(tx));
    const { POST } = await import('../app/api/documents/route');
    const response = await POST(request({ title: 'SOP', classification: 'CONTROLLED', contentBase64: 'synthetic' }));

    expect(response.status).toBe(201);
    expect(storageMock.vercelBlobStorage.putObject).toHaveBeenCalledBefore(prismaMock.$transaction);
    expect(tx.documentVersion.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      storageKey: expect.stringContaining('tenants/tenant-a/'), fileData: null, hash: 'stored-sha256', sizeBytes: 3,
    }) });
    expect(auditMock.writeMandatoryAudit).toHaveBeenCalled();
  });

  it('creates no controlled record or success audit when storage fails', async () => {
    storageMock.vercelBlobStorage.putObject.mockRejectedValue(new Error('storage unavailable'));
    const { POST } = await import('../app/api/documents/route');
    const response = await POST(request({ title: 'SOP', classification: 'CONTROLLED', contentBase64: 'synthetic' }));
    expect(response.status).toBe(500);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(auditMock.writeMandatoryAudit).not.toHaveBeenCalled();
  });

  it('leaves no active DB record and attempts orphan cleanup when DB/audit fails', async () => {
    prismaMock.$transaction.mockRejectedValue(new Error('audit transaction failed'));
    const { POST } = await import('../app/api/documents/route');
    const response = await POST(request({ title: 'SOP', classification: 'CONTROLLED', contentBase64: 'synthetic' }));
    expect(response.status).toBe(500);
    expect(storageMock.cleanupUncontrolledObject).toHaveBeenCalledWith(
      storageMock.vercelBlobStorage, expect.stringContaining('tenants/tenant-a/'),
    );
  });
});

describe('controlled document retrieval route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    authMock.getContext.mockResolvedValue(context);
    rbacMock.hasPermission.mockReturnValue(true);
  });

  it('rejects another tenant before any object retrieval', async () => {
    prismaMock.document.findUnique.mockResolvedValue({ id: 'doc-b', tenantId: 'tenant-b', versions: [] });
    const { GET } = await import('../app/api/documents/[id]/pdf/route');
    const response = await GET(request({}, 'https://veritas.invalid/api/documents/doc-b/pdf?raw=true'), { params: Promise.resolve({ id: 'doc-b' }) });
    expect(response.status).toBe(404);
    expect(storageMock.verifyControlledObject).not.toHaveBeenCalled();
  });

  it('enforces document-read RBAC before any database or storage lookup', async () => {
    rbacMock.hasPermission.mockReturnValue(false);
    const { GET } = await import('../app/api/documents/[id]/pdf/route');
    const response = await GET(request({}, 'https://veritas.invalid/api/documents/doc-1/pdf?raw=true'), { params: Promise.resolve({ id: 'doc-1' }) });
    expect(response.status).toBe(403);
    expect(prismaMock.document.findUnique).not.toHaveBeenCalled();
    expect(storageMock.verifyControlledObject).not.toHaveBeenCalled();
  });

  it('ignores a client-supplied foreign key and resolves the authorized DB key', async () => {
    prismaMock.document.findUnique.mockResolvedValue({
      id: 'doc-1', tenantId: 'tenant-a', title: 'SOP', owner: {}, tenant: {}, trainingRequirement: null,
      versions: [{ id: 'version-1', versionNumber: 1, storageKey: 'authoritative-db-key', hash: 'stored-sha256', mimeType: 'application/pdf', originalFileName: 'record.pdf', fileData: null, signatureManifest: null }],
    });
    storageMock.verifyControlledObject.mockResolvedValue({ bytes: new Uint8Array([1, 2, 3]), contentType: 'application/pdf' });
    const { GET } = await import('../app/api/documents/[id]/pdf/route');
    const response = await GET(request({}, 'https://veritas.invalid/api/documents/doc-1/pdf?raw=true&storageKey=foreign-key'), { params: Promise.resolve({ id: 'doc-1' }) });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(storageMock.verifyControlledObject).toHaveBeenCalledWith(storageMock.vercelBlobStorage, 'authoritative-db-key', 'stored-sha256');
  });

  it('does not touch private storage for an unauthenticated request', async () => {
    authMock.getContext.mockResolvedValue(null);
    const { GET } = await import('../app/api/documents/[id]/pdf/route');
    const response = await GET(request({}, 'https://veritas.invalid/api/documents/doc-1/pdf?raw=true'), { params: Promise.resolve({ id: 'doc-1' }) });
    expect(response.status).toBe(401);
    expect(storageMock.verifyControlledObject).not.toHaveBeenCalled();
  });
});
