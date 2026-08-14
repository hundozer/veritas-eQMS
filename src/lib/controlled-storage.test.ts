import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const blobMock = vi.hoisted(() => ({
  put: vi.fn(), get: vi.fn(), head: vi.fn(), del: vi.fn(),
}));
vi.mock('@vercel/blob', () => blobMock);

import {
  cleanupUncontrolledObject,
  createControlledObjectKey,
  decodeControlledUpload,
  sha256,
  type ControlledStorageBackend,
  vercelBlobStorage,
  verifyControlledObject,
} from './controlled-storage';

function memoryStorage(initial = new Map<string, Uint8Array>()): ControlledStorageBackend {
  return {
    async putObject(key, bytes) {
      if (initial.has(key)) throw new Error('overwrite denied');
      initial.set(key, bytes);
    },
    async getObject(key) {
      const bytes = initial.get(key);
      return bytes ? { key, bytes, contentType: 'application/pdf', size: bytes.byteLength } : null;
    },
    async headObject(key) {
      const bytes = initial.get(key);
      return bytes ? { key, contentType: 'application/pdf', size: bytes.byteLength } : null;
    },
    async deleteObject(key) { initial.delete(key); },
  };
}

describe('controlled-record storage', () => {
  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.BLOB_READ_WRITE_TOKEN;
  });

  it('computes SHA-256 from uploaded bytes and sanitizes display filenames', () => {
    const result = decodeControlledUpload({
      contentBase64: Buffer.from('synthetic controlled record').toString('base64'),
      fileName: '../../unsafe\u0000record.pdf', mimeType: 'application/pdf',
    });
    expect(result.hash).toBe(sha256(result.bytes));
    expect(result.fileName).toBe('unsafe_record.pdf');
  });

  it('rejects unsupported types and malformed content', () => {
    expect(() => decodeControlledUpload({ contentBase64: 'not-base64', mimeType: 'application/pdf' })).toThrow(/Base64/);
    expect(() => decodeControlledUpload({ contentBase64: 'YWJjZA==', mimeType: 'application/x-executable' })).toThrow(/not allowed/);
  });

  it('creates immutable tenant/document/version-scoped object identities', () => {
    const first = createControlledObjectKey({ tenantId: 'tenant-1', documentId: 'doc-1', versionNumber: 1 });
    const second = createControlledObjectKey({ tenantId: 'tenant-1', documentId: 'doc-1', versionNumber: 1 });
    expect(first).toMatch(/^tenants\/tenant-1\/documents\/doc-1\/versions\/1\//);
    expect(second).not.toBe(first);
  });

  it('cannot overwrite the object belonging to an historical version', async () => {
    const storage = memoryStorage();
    await storage.putObject('historical-key', new Uint8Array([1]), 'application/pdf');
    await expect(storage.putObject('historical-key', new Uint8Array([2]), 'application/pdf')).rejects.toThrow(/overwrite denied/);
  });

  it('uploads to private storage without overwrite capability', async () => {
    process.env.BLOB_READ_WRITE_TOKEN = 'synthetic-test-token';
    blobMock.put.mockResolvedValue({});
    await vercelBlobStorage.putObject('tenants/t/documents/d/versions/1/id', new Uint8Array([1]), 'application/pdf');
    expect(blobMock.put).toHaveBeenCalledWith(expect.any(String), expect.any(Uint8Array), expect.objectContaining({
      access: 'private', addRandomSuffix: false, allowOverwrite: false,
    }));
  });

  it('returns identical bytes only when persisted SHA-256 matches', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const storage = memoryStorage(new Map([['key', bytes]]));
    await expect(verifyControlledObject(storage, 'key', sha256(bytes))).resolves.toMatchObject({ bytes });
  });

  it('detects object tampering and refuses the content', async () => {
    const expected = new Uint8Array([1, 2, 3]);
    const tampered = new Uint8Array([1, 2, 4]);
    const storage = memoryStorage(new Map([['key', tampered]]));
    await expect(verifyControlledObject(storage, 'key', sha256(expected))).rejects.toThrow(/integrity/);
  });

  it('attempts cleanup for an upload that never became a controlled record', async () => {
    const deleteObject = vi.fn().mockResolvedValue(undefined);
    const storage = { ...memoryStorage(), deleteObject };
    await expect(cleanupUncontrolledObject(storage, 'orphan-key')).resolves.toBe(true);
    expect(deleteObject).toHaveBeenCalledWith('orphan-key');
  });
});
