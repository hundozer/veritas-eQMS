import 'server-only';

import { createHash, randomUUID } from 'node:crypto';
import { del, get, head, put } from '@vercel/blob';
import { reportServerError } from './server-errors';

export const MAX_CONTROLLED_FILE_BYTES = 25 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
]);

export type StoredObject = {
  key: string;
  bytes: Uint8Array;
  contentType: string;
  size: number;
  etag?: string;
};

export interface ControlledStorageBackend {
  putObject(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  getObject(key: string): Promise<StoredObject | null>;
  headObject(key: string): Promise<Omit<StoredObject, 'bytes'> | null>;
  deleteObject(key: string): Promise<void>;
}

function requireStorageToken() {
  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    throw new Error('Controlled-record storage is unavailable');
  }
}

export const vercelBlobStorage: ControlledStorageBackend = {
  async putObject(key, bytes, contentType) {
    requireStorageToken();
    await put(key, Buffer.from(bytes), {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: false,
      contentType,
      cacheControlMaxAge: 0,
    });
  },

  async getObject(key) {
    requireStorageToken();
    const result = await get(key, { access: 'private' });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    const bytes = new Uint8Array(await new Response(result.stream).arrayBuffer());
    return {
      key,
      bytes,
      contentType: result.blob.contentType,
      size: bytes.byteLength,
      etag: result.blob.etag,
    };
  },

  async headObject(key) {
    requireStorageToken();
    try {
      const result = await head(key);
      return { key, contentType: result.contentType, size: result.size, etag: result.etag };
    } catch {
      return null;
    }
  },

  async deleteObject(key) {
    requireStorageToken();
    await del(key);
  },
};

export function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export function sanitizeDisplayFileName(value: unknown): string {
  const supplied = typeof value === 'string' ? value : 'document.pdf';
  const leaf = supplied.split(/[\\/]/).pop() ?? 'document.pdf';
  const cleaned = leaf.replace(/[\u0000-\u001f\u007f"<>:|?*]/g, '_').trim();
  return (cleaned || 'document.pdf').slice(0, 180);
}

export function decodeControlledUpload(input: {
  contentBase64: unknown;
  fileName?: unknown;
  mimeType?: unknown;
}): { bytes: Uint8Array; fileName: string; mimeType: string; hash: string } {
  if (typeof input.contentBase64 !== 'string' || input.contentBase64.length === 0) {
    throw new Error('Controlled document content is required');
  }
  const normalized = input.contentBase64.replace(/\s/g, '');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized) || normalized.length % 4 !== 0) {
    throw new Error('Controlled document content is not valid Base64');
  }
  if (normalized.length > Math.ceil(MAX_CONTROLLED_FILE_BYTES / 3) * 4 + 4) {
    throw new Error('Controlled document exceeds the maximum file size');
  }
  const bytes = new Uint8Array(Buffer.from(normalized, 'base64'));
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_CONTROLLED_FILE_BYTES) {
    throw new Error('Controlled document exceeds the maximum file size');
  }
  const mimeType = typeof input.mimeType === 'string' ? input.mimeType.toLowerCase().trim() : 'application/pdf';
  if (!ALLOWED_MIME_TYPES.has(mimeType)) throw new Error('Controlled document file type is not allowed');

  return {
    bytes,
    fileName: sanitizeDisplayFileName(input.fileName),
    mimeType,
    hash: sha256(bytes),
  };
}

export function createControlledObjectKey(input: {
  tenantId: string;
  documentId: string;
  versionNumber: number;
}): string {
  for (const value of [input.tenantId, input.documentId]) {
    if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid controlled object scope');
  }
  if (!Number.isSafeInteger(input.versionNumber) || input.versionNumber < 1) {
    throw new Error('Invalid document version number');
  }
  return `tenants/${input.tenantId}/documents/${input.documentId}/versions/${input.versionNumber}/${randomUUID()}`;
}

export async function verifyControlledObject(
  storage: ControlledStorageBackend,
  key: string,
  expectedHash: string,
): Promise<StoredObject> {
  const object = await storage.getObject(key);
  if (!object) throw new Error('Controlled document content is unavailable');
  if (sha256(object.bytes) !== expectedHash) throw new Error('Controlled document integrity verification failed');
  return object;
}

export async function cleanupUncontrolledObject(
  storage: ControlledStorageBackend,
  key: string,
): Promise<boolean> {
  try {
    await storage.deleteObject(key);
    return true;
  } catch (error) {
    reportServerError('storage.cleanupFailed');
    return false;
  }
}

export function createServerGeneratedTextUpload(content: string, fileName: string) {
  const bytes = new Uint8Array(Buffer.from(content, 'utf8'));
  return {
    bytes,
    fileName: sanitizeDisplayFileName(fileName),
    mimeType: 'text/plain',
    hash: sha256(bytes),
  };
}
