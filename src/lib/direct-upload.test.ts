import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const blobMock = vi.hoisted(() => ({
  put: vi.fn(), get: vi.fn(), head: vi.fn(), del: vi.fn(),
  issueSignedToken: vi.fn(),
}));
const blobClientMock = vi.hoisted(() => ({ handleUploadPresigned: vi.fn() }));
const authMock = vi.hoisted(() => ({ getContext: vi.fn() }));
const rbacMock = vi.hoisted(() => ({ hasPermission: vi.fn() }));
vi.mock('@vercel/blob', () => blobMock);
vi.mock('@vercel/blob/client', () => blobClientMock);
vi.mock('@/lib/auth', () => authMock);
vi.mock('@/lib/rbac', () => rbacMock);
vi.mock('@/lib/controlled-storage', async () => import('./controlled-storage'));

import {
  createUploadKey,
  MAX_CONTROLLED_FILE_BYTES,
  presignDirectUpload,
  resolveControlledUpload,
  sha256,
  type ControlledStorageBackend,
} from './controlled-storage';
import { prepareDocumentFile } from './document-file-upload';

const TENANT = 'tenant-a';
const PDF = 'application/pdf';

function storageHolding(objects: Record<string, Uint8Array>, failing = false): ControlledStorageBackend {
  return {
    putObject: vi.fn(),
    async getObject(key) {
      if (failing) throw new Error('blob service said: secret internal detail');
      const bytes = objects[key];
      return bytes ? { key, bytes, contentType: PDF, size: bytes.byteLength } : null;
    },
    headObject: vi.fn(),
    deleteObject: vi.fn(),
  };
}

describe('direct uploads: reading the uploaded file back', () => {
  const bytes = new TextEncoder().encode('%PDF-synthetic');
  const key = createUploadKey(TENANT);

  it('UPL-T001 an upload under the tenant key with the matching SHA-256 is accepted', async () => {
    const upload = await resolveControlledUpload(storageHolding({ [key]: bytes }), TENANT, {
      uploadKey: key, sha256: sha256(bytes), fileName: '../SOP.pdf', mimeType: PDF,
    });

    expect(key).toMatch(/^tenants\/tenant-a\/uploads\/[0-9a-f-]{36}$/);
    expect(upload).toMatchObject({ hash: sha256(bytes), mimeType: PDF, fileName: 'SOP.pdf', stagingKey: key });
    expect(upload.bytes).toEqual(bytes);
  });

  it('UPL-T002 another tenant\'s key, a document key or a malformed key is refused before storage is read', async () => {
    const storage = storageHolding({});
    const getObject = vi.spyOn(storage, 'getObject');
    for (const uploadKey of [
      createUploadKey('tenant-b'),
      'tenants/tenant-a/documents/doc-1/versions/1/00000000-0000-0000-0000-000000000000',
      'tenants/tenant-a/uploads/../documents/x',
      'tenants/tenant-a/uploads/not-a-uuid',
      42,
    ]) {
      await expect(resolveControlledUpload(storage, TENANT, { uploadKey, sha256: 'a'.repeat(64), mimeType: PDF }))
        .rejects.toThrow('The uploaded file reference is not valid');
    }
    expect(getObject).not.toHaveBeenCalled();
  });

  it('UPL-T003 a file that differs from the one the browser hashed is refused', async () => {
    const storage = storageHolding({ [key]: bytes });
    await expect(resolveControlledUpload(storage, TENANT, { uploadKey: key, sha256: 'b'.repeat(64), mimeType: PDF }))
      .rejects.toThrow('does not match the file you selected');
    await expect(resolveControlledUpload(storage, TENANT, { uploadKey: key, mimeType: PDF }))
      .rejects.toThrow('SHA-256 of the uploaded file is required');
  });

  it('UPL-T004 a missing, oversized, disallowed or unreadable upload is refused with a fixed message', async () => {
    const hash = sha256(bytes);
    await expect(resolveControlledUpload(storageHolding({}), TENANT, { uploadKey: key, sha256: hash, mimeType: PDF }))
      .rejects.toThrow('The uploaded file was not found');
    const huge = new Uint8Array(MAX_CONTROLLED_FILE_BYTES + 1);
    await expect(resolveControlledUpload(storageHolding({ [key]: huge }), TENANT, { uploadKey: key, sha256: sha256(huge), mimeType: PDF }))
      .rejects.toThrow('maximum file size');
    await expect(resolveControlledUpload(storageHolding({ [key]: bytes }), TENANT, { uploadKey: key, sha256: hash, mimeType: 'text/html' }))
      .rejects.toThrow('file type is not allowed');
    const unreadable = resolveControlledUpload(storageHolding({}, true), TENANT, { uploadKey: key, sha256: hash, mimeType: PDF });
    await expect(unreadable).rejects.toThrow('The uploaded file could not be read');
    await expect(unreadable).rejects.not.toThrow('secret');
  });

  it('UPL-T005 small files may still arrive inline as Base64', async () => {
    const upload = await resolveControlledUpload(storageHolding({}), TENANT, {
      contentBase64: Buffer.from(bytes).toString('base64'), fileName: 'SOP.pdf', mimeType: PDF,
    });
    expect(upload.hash).toBe(sha256(bytes));
    expect(upload.stagingKey).toBeUndefined();
  });
});

describe('direct uploads: presigning', () => {
  const request = new Request('https://veritas.invalid/api/documents/uploads', { method: 'POST' });

  beforeEach(() => {
    process.env.BLOB_READ_WRITE_TOKEN = 'synthetic-token';
    blobMock.issueSignedToken.mockResolvedValue({ delegationToken: 'delegation', clientSigningToken: 'signing', validUntil: 1 });
    blobClientMock.handleUploadPresigned.mockImplementation(async ({ body, getSignedToken }) => {
      const { urlOptions } = await getSignedToken(body.payload.pathname, null, false);
      return { type: 'blob.generate-presigned-url', presignedUrlPayload: { delegationToken: 'delegation', signature: 'sig', params: urlOptions } };
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.BLOB_READ_WRITE_TOKEN;
  });

  it('UPL-T006 a PUT is presigned for exactly the tenant key, write-only, limited and never overwriting', async () => {
    const pathname = createUploadKey(TENANT);
    const result = await presignDirectUpload(TENANT, request, { type: 'blob.generate-presigned-url', payload: { pathname, clientPayload: null, multipart: false } });

    expect(blobMock.issueSignedToken).toHaveBeenCalledWith(expect.objectContaining({
      pathname, operations: ['put'], maximumSizeInBytes: MAX_CONTROLLED_FILE_BYTES,
      allowedContentTypes: expect.arrayContaining([PDF, 'text/plain']),
    }));
    const [{ validUntil }] = blobMock.issueSignedToken.mock.calls[0];
    expect(validUntil - Date.now()).toBeLessThanOrEqual(15 * 60 * 1000);
    expect(result.presignedUrlPayload.params).toMatchObject({ allowOverwrite: false, addRandomSuffix: false });
  });

  it('UPL-T007 another tenant\'s key and upload-completed callbacks are refused without issuing a token', async () => {
    for (const body of [
      { type: 'blob.generate-presigned-url', payload: { pathname: createUploadKey('tenant-b'), clientPayload: null, multipart: false } },
      { type: 'blob.generate-presigned-url', payload: { pathname: '*', clientPayload: null, multipart: false } },
      { type: 'blob.upload-completed', payload: { blob: { pathname: createUploadKey(TENANT) } } },
      null,
    ]) {
      await expect(presignDirectUpload(TENANT, request, body)).rejects.toThrow('This upload request is not allowed');
    }
    expect(blobMock.issueSignedToken).not.toHaveBeenCalled();
  });
});

describe('direct uploads: the route', () => {
  const context = { id: 'user-1', tenantId: TENANT, permissions: ['documents.create'] };
  const post = async (body: unknown) => {
    const { POST } = await import('../app/api/documents/uploads/route');
    return POST(new Request('https://veritas.invalid/api/documents/uploads', { method: 'POST', body: JSON.stringify(body) }) as never);
  };

  beforeEach(() => {
    authMock.getContext.mockResolvedValue(context);
    rbacMock.hasPermission.mockImplementation((user: typeof context, permission: string) => user.permissions.includes(permission));
  });

  it('UPL-T008 an author reserves a fresh key in their own tenant; others are refused', async () => {
    const first = await (await post({ type: 'veritas.reserve-upload' })).json();
    const second = await (await post({ type: 'veritas.reserve-upload' })).json();
    expect(first.uploadKey).toMatch(/^tenants\/tenant-a\/uploads\//);
    expect(first.uploadKey).not.toBe(second.uploadKey);

    rbacMock.hasPermission.mockReturnValue(false);
    expect((await post({ type: 'veritas.reserve-upload' })).status).toBe(403);
    authMock.getContext.mockResolvedValue(null);
    expect((await post({ type: 'veritas.reserve-upload' })).status).toBe(401);
  });

  it('UPL-T009 a presign request for another tenant\'s key gets 400', async () => {
    const response = await post({ type: 'blob.generate-presigned-url', payload: { pathname: createUploadKey('tenant-b'), clientPayload: null, multipart: false } });
    expect(response.status).toBe(400);
    expect(blobMock.issueSignedToken).not.toHaveBeenCalled();
  });
});

describe('direct uploads: the browser helper', () => {
  const file = (size: number) => new File([new Uint8Array(size).fill(65)], 'SOP.pdf', { type: PDF });
  const reserving = () => vi.fn(async () => new Response(JSON.stringify({ uploadKey: 'tenants/tenant-a/uploads/key' })));

  it('UPL-T010 the file goes to storage and only its key and SHA-256 travel with the request', async () => {
    const upload = vi.fn().mockResolvedValue({});
    const fetchFake = reserving();
    const fields = await prepareDocumentFile(file(10), { fetch: fetchFake as never, upload });

    expect(upload).toHaveBeenCalledWith('tenants/tenant-a/uploads/key', expect.any(File), expect.objectContaining({ access: 'private', handleUploadUrl: '/api/documents/uploads', contentType: PDF }));
    expect(fields).toEqual({ fileName: 'SOP.pdf', mimeType: PDF, uploadKey: 'tenants/tenant-a/uploads/key', sha256: sha256(new Uint8Array(10).fill(65)) });
  });

  it('UPL-T011 a small file falls back to an inline upload when storage cannot be reached; a large one fails', async () => {
    const failing = vi.fn().mockRejectedValue(new Error('network'));
    const small = await prepareDocumentFile(file(10), { fetch: reserving() as never, upload: failing });
    expect(small).toEqual({ fileName: 'SOP.pdf', mimeType: PDF, contentBase64: Buffer.from(new Uint8Array(10).fill(65)).toString('base64') });

    await expect(prepareDocumentFile(file(4 * 1024 * 1024), { fetch: reserving() as never, upload: failing }))
      .rejects.toThrow('could not be uploaded');
    const refused = vi.fn(async () => new Response('{}', { status: 403 }));
    expect(await prepareDocumentFile(file(10), { fetch: refused as never, upload: failing })).toHaveProperty('contentBase64');
  });
});
