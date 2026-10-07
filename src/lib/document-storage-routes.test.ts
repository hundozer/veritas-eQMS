import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  document: { findUnique: vi.fn(), findFirst: vi.fn() },
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
const lifecycleMock = vi.hoisted(() => ({
  generateDocumentNumber: vi.fn(() => 'SOP-TEST0001'),
  normalizeDocumentType: vi.fn(() => 'SOP'),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/tenant-db', async () => (await import('../test-support/tenant-db-double')).tenantDbDouble());
vi.mock('@/lib/db', () => ({ default: prismaMock }));
vi.mock('@/lib/auth', () => authMock);
vi.mock('@/lib/rbac', () => rbacMock);
vi.mock('@/lib/audit', () => auditMock);
vi.mock('@/lib/controlled-storage', () => storageMock);
vi.mock('@/lib/document-lifecycle', () => lifecycleMock);

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
    prismaMock.document.findFirst.mockResolvedValue(null);
    const { GET } = await import('../app/api/documents/[id]/pdf/route');
    const response = await GET(request({}, 'https://veritas.invalid/api/documents/doc-b/pdf?raw=true'), { params: Promise.resolve({ id: 'doc-b' }) });
    expect(response.status).toBe(404);
    expect(prismaMock.document.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'doc-b', tenantId: 'tenant-a' },
    }));
    expect(storageMock.verifyControlledObject).not.toHaveBeenCalled();
  });

  it('enforces document-read RBAC before any database or storage lookup', async () => {
    rbacMock.hasPermission.mockReturnValue(false);
    const { GET } = await import('../app/api/documents/[id]/pdf/route');
    const response = await GET(request({}, 'https://veritas.invalid/api/documents/doc-1/pdf?raw=true'), { params: Promise.resolve({ id: 'doc-1' }) });
    expect(response.status).toBe(403);
    expect(prismaMock.document.findFirst).not.toHaveBeenCalled();
    expect(storageMock.verifyControlledObject).not.toHaveBeenCalled();
  });

  it('ignores a client-supplied foreign key and resolves the authorized DB key', async () => {
    prismaMock.document.findFirst.mockResolvedValue({
      id: 'doc-1', title: 'SOP', classification: 'CONTROLLED', status: 'DRAFT', currentVersionNumber: 1,
      owner: { fullName: 'Owner', department: 'QA' }, tenant: { name: 'Tenant A' },
      versions: [{ id: 'version-1', versionNumber: 1, status: 'EFFECTIVE', storageKey: 'authoritative-db-key', hash: 'stored-sha256', mimeType: 'application/pdf', originalFileName: 'record.pdf', fileData: null, signatures: [] }],
    });
    storageMock.verifyControlledObject.mockResolvedValue({ bytes: new Uint8Array([1, 2, 3]), contentType: 'application/pdf' });
    const { GET } = await import('../app/api/documents/[id]/pdf/route');
    const response = await GET(request({}, 'https://veritas.invalid/api/documents/doc-1/pdf?raw=true&storageKey=foreign-key'), { params: Promise.resolve({ id: 'doc-1' }) });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(storageMock.verifyControlledObject).toHaveBeenCalledWith(storageMock.vercelBlobStorage, 'authoritative-db-key', 'stored-sha256');
  });

  it('escapes stored fields and applies a restrictive CSP to the HTML viewer', async () => {
    prismaMock.document.findFirst.mockResolvedValue({
      id: 'doc-1', title: '<script>alert(1)</script>', classification: '<img src=x>', status: 'DRAFT', currentVersionNumber: 1,
      owner: { fullName: '<b>Owner</b>', department: 'QA' }, tenant: { name: '<svg onload=alert(1)>' },
      versions: [{
        versionNumber: 1, storageKey: null, hash: 'stored-sha256', mimeType: 'application/pdf',
        originalFileName: 'record.pdf', fileData: null,
        signatures: [
          { signedAt: new Date('2026-01-01T00:00:00Z'), meaning: '<script>x</script>', ipAddress: '<x>', hashSigned: '<hash>', iamUserId: null, signerName: null, signerRole: null, signer: { fullName: '<i>Signer</i>', role: '<role>' } },
          { signedAt: new Date('2026-01-02T00:00:00Z'), meaning: 'APPROVED', ipAddress: '192.0.2.1', hashSigned: 'stored-sha256', iamUserId: 'iam-1', signerName: '<u>Snapshot</u>', signerRole: 'QA', signer: { fullName: 'Current Name', role: 'QA' } },
        ],
      }],
    });
    const { GET } = await import('../app/api/documents/[id]/pdf/route');
    const response = await GET(request({}, 'https://veritas.invalid/api/documents/doc-1/pdf'), { params: Promise.resolve({ id: 'doc-1' }) });
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-security-policy')).toContain("default-src 'none'");
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<svg onload=alert(1)>');
    expect(html).toContain('&lt;svg onload=alert(1)&gt;');
    expect(html).not.toContain('<i>Signer</i>');
    expect(html).toContain('&lt;i&gt;Signer&lt;/i&gt;');
    expect(html).toContain('LEGACY SIGNATURE METADATA');
    expect(html).toContain('&lt;u&gt;Snapshot&lt;/u&gt;');
    expect(html).not.toContain('Current Name');
    expect(html).toContain('SIGNED CONTENT MATCHES THIS VERSION');
  });

  describe('controlled copies (DEC-067)', () => {
    const stored: { bytes: Uint8Array; contentType: string } = { bytes: new Uint8Array(), contentType: 'application/pdf' };
    function documentWith(versions: Array<{ versionNumber: number; status: string; mimeType?: string; fileName?: string }>) {
      return {
        id: 'doc-1', title: 'SOP', documentNumber: 'SOP-0001', classification: 'CONTROLLED', status: 'DRAFT', currentVersionNumber: versions[0].versionNumber,
        owner: { fullName: 'Owner', department: 'QA' }, tenant: { name: 'Tenant A' },
        versions: versions.map((version) => ({
          versionNumber: version.versionNumber, status: version.status, storageKey: `key-v${version.versionNumber}`, hash: `hash-v${version.versionNumber}`,
          mimeType: version.mimeType ?? 'application/pdf', originalFileName: version.fileName ?? 'record.pdf', fileData: null, signatures: [],
        })),
      };
    }
    async function get(query: string) {
      const { GET } = await import('../app/api/documents/[id]/pdf/route');
      return GET(request({}, `https://veritas.invalid/api/documents/doc-1/pdf${query}`), { params: Promise.resolve({ id: 'doc-1' }) });
    }

    beforeEach(async () => {
      const { PDFDocument } = await import('pdf-lib');
      const pdf = await PDFDocument.create();
      pdf.addPage();
      stored.bytes = await pdf.save();
      storageMock.verifyControlledObject.mockImplementation(async () => ({ bytes: stored.bytes, contentType: 'application/pdf' }));
    });

    it('COPY-T007 the file defaults to the effective version and is served exactly as stored', async () => {
      prismaMock.document.findFirst.mockResolvedValue(documentWith([{ versionNumber: 2, status: 'DRAFT' }, { versionNumber: 1, status: 'EFFECTIVE' }]));

      const response = await get('?raw=true');

      expect(response.status).toBe(200);
      expect(storageMock.verifyControlledObject).toHaveBeenCalledWith(storageMock.vercelBlobStorage, 'key-v1', 'hash-v1');
      expect(response.headers.get('x-veritas-copy')).toBe('effective');
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(stored.bytes);
    });

    it('COPY-T008 any other version is stamped as an uncontrolled copy of its status', async () => {
      prismaMock.document.findFirst.mockResolvedValue(documentWith([{ versionNumber: 2, status: 'DRAFT' }, { versionNumber: 1, status: 'EFFECTIVE' }]));

      const response = await get('?raw=true&version=2');

      expect(response.status).toBe(200);
      expect(storageMock.verifyControlledObject).toHaveBeenCalledWith(storageMock.vercelBlobStorage, 'key-v2', 'hash-v2');
      expect(response.headers.get('x-veritas-copy')).toBe('uncontrolled');
      expect(response.headers.get('content-disposition')).toContain('UNCONTROLLED-DRAFT-record.pdf');
      const { PDFDocument } = await import('pdf-lib');
      const marked = await PDFDocument.load(new Uint8Array(await response.arrayBuffer()));
      expect(marked.getSubject()).toBe('UNCONTROLLED COPY - DRAFT - NOT FOR USE');
    });

    it('COPY-T009 a non-effective PDF that cannot be stamped is refused', async () => {
      prismaMock.document.findFirst.mockResolvedValue(documentWith([{ versionNumber: 1, status: 'SUPERSEDED' }]));
      storageMock.verifyControlledObject.mockResolvedValue({ bytes: new Uint8Array([1, 2, 3]), contentType: 'application/pdf' });

      const response = await get('?raw=true');

      expect(response.status).toBe(409);
      expect(await response.text()).not.toContain('%PDF');
    });

    it('COPY-T010 a text version is marked at the top; other formats are named uncontrolled', async () => {
      prismaMock.document.findFirst.mockResolvedValue(documentWith([
        { versionNumber: 2, status: 'OBSOLETE', mimeType: 'text/plain', fileName: 'sop.txt' },
        { versionNumber: 1, status: 'SUPERSEDED', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', fileName: 'sop.docx' },
      ]));
      storageMock.verifyControlledObject.mockResolvedValue({ bytes: new TextEncoder().encode('Step 1'), contentType: 'text/plain' });

      const text = await get('?raw=true');
      expect((await text.text()).startsWith('UNCONTROLLED COPY - OBSOLETE - NOT FOR USE\nSOP-0001 v2')).toBe(true);

      const word = await get('?raw=true&version=1');
      expect(word.headers.get('content-disposition')).toBe('attachment; filename="UNCONTROLLED-SUPERSEDED-sop.docx"');
    });

    it('COPY-T011 the viewer shows the chosen version and embeds it only through the marking route', async () => {
      prismaMock.document.findFirst.mockResolvedValue(documentWith([{ versionNumber: 2, status: 'IN_REVIEW' }, { versionNumber: 1, status: 'EFFECTIVE' }]));

      const effective = await (await get('')).text();
      expect(effective).toContain('EFFECTIVE VERSION');
      expect(effective).toContain('pdf?raw=true&amp;version=1');

      const review = await (await get('?version=2')).text();
      expect(review).toContain('UNCONTROLLED COPY - IN REVIEW - NOT FOR USE');
      expect(review).toContain('/api/documents/doc-1/pdf?raw=true&amp;version=2');
      expect(review).not.toContain('data:application/pdf');
    });

    it('COPY-T012 a malformed or unknown version number is not found', async () => {
      prismaMock.document.findFirst.mockResolvedValue(documentWith([{ versionNumber: 1, status: 'EFFECTIVE' }]));
      expect((await get('?raw=true&version=1abc')).status).toBe(404);
      expect((await get('?version=7')).status).toBe(404);
      expect(storageMock.verifyControlledObject).not.toHaveBeenCalled();
    });
  });

  it('does not touch private storage for an unauthenticated request', async () => {
    authMock.getContext.mockResolvedValue(null);
    const { GET } = await import('../app/api/documents/[id]/pdf/route');
    const response = await GET(request({}, 'https://veritas.invalid/api/documents/doc-1/pdf?raw=true'), { params: Promise.resolve({ id: 'doc-1' }) });
    expect(response.status).toBe(401);
    expect(storageMock.verifyControlledObject).not.toHaveBeenCalled();
  });
});
