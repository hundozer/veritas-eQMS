import 'server-only';

import { createHash, randomUUID } from 'node:crypto';
import { del, get, head, issueSignedToken, put } from '@vercel/blob';
import { handleUploadPresigned, type HandleUploadPresignedBody } from '@vercel/blob/client';
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

// On Vercel the OIDC token arrives per request (x-vercel-oidc-token header) and
// @vercel/blob resolves it itself; VERCEL_OIDC_TOKEN exists only in builds and locally.
function requireStorageCredentials() {
  const hasReadWriteToken = Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
  const hasOidcToken = Boolean(process.env.VERCEL_OIDC_TOKEN?.trim()) || process.env.VERCEL === '1';
  const hasOidcCredentials = hasOidcToken && Boolean(process.env.BLOB_STORE_ID?.trim());

  if (!hasReadWriteToken && !hasOidcCredentials) {
    throw new Error('Controlled-record storage is unavailable');
  }
}

export const vercelBlobStorage: ControlledStorageBackend = {
  async putObject(key, bytes, contentType) {
    requireStorageCredentials();
    await put(key, Buffer.from(bytes), {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: false,
      contentType,
      cacheControlMaxAge: 0,
    });
  },

  async getObject(key) {
    requireStorageCredentials();
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
    requireStorageCredentials();
    try {
      const result = await head(key);
      return { key, contentType: result.contentType, size: result.size, etag: result.etag };
    } catch {
      return null;
    }
  },

  async deleteObject(key) {
    requireStorageCredentials();
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

// Direct uploads (DEC-068). The browser sends the file straight to private Blob
// storage under a key the server chose for the caller's tenant, so large files
// never pass through a function request body. The server then reads the object
// back, checks it against the SHA-256 the browser computed, and stores it under
// its controlled key exactly as a server-side upload would be stored.

export const ALLOWED_UPLOAD_TYPES: readonly string[] = [...ALLOWED_MIME_TYPES];
const UPLOAD_KEY_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function assertScopeSegment(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid controlled object scope');
}

export function createUploadKey(tenantId: string): string {
  assertScopeSegment(tenantId);
  return `tenants/${tenantId}/uploads/${randomUUID()}`;
}

/** True only for a key this server could have issued to the given tenant. */
export function isTenantUploadKey(tenantId: string, key: unknown): key is string {
  if (typeof key !== 'string') return false;
  const prefix = `tenants/${tenantId}/uploads/`;
  return /^[A-Za-z0-9_-]+$/.test(tenantId) && key.startsWith(prefix) && UPLOAD_KEY_ID.test(key.slice(prefix.length));
}

export class DirectUploadRefused extends Error {
  constructor() {
    super('This upload request is not allowed');
    this.name = 'DirectUploadRefused';
  }
}

const DIRECT_UPLOAD_WINDOW_MS = 15 * 60 * 1000;

/**
 * Answers the Blob client's request for a presigned upload URL, scoped to one
 * upload key of the caller's tenant, write-only, size- and type-limited, and
 * never overwriting. Upload-completed callbacks are not used: the server reads
 * the object back when the document is saved.
 */
export async function presignDirectUpload(tenantId: string, request: Request, body: unknown) {
  const event = body as Partial<HandleUploadPresignedBody> | null;
  if (event?.type !== 'blob.generate-presigned-url' || !isTenantUploadKey(tenantId, event.payload?.pathname)) {
    throw new DirectUploadRefused();
  }
  requireStorageCredentials();
  const limits = {
    validUntil: Date.now() + DIRECT_UPLOAD_WINDOW_MS,
    allowedContentTypes: [...ALLOWED_MIME_TYPES],
    maximumSizeInBytes: MAX_CONTROLLED_FILE_BYTES,
  };
  const result = await handleUploadPresigned({
    body: event as HandleUploadPresignedBody,
    request,
    // Required by the SDK, used only to verify completion callbacks, which are refused above.
    webhookPublicKey: 'not-used',
    async getSignedToken(pathname) {
      const token = await issueSignedToken({ pathname, operations: ['put'], ...limits });
      return { token, urlOptions: { ...limits, allowOverwrite: false, addRandomSuffix: false, cacheControlMaxAge: 60 } };
    },
  });
  if (result.type !== 'blob.generate-presigned-url') throw new DirectUploadRefused();
  return { type: result.type, presignedUrlPayload: result.presignedUrlPayload };
}

export type ControlledUpload = ReturnType<typeof decodeControlledUpload> & { stagingKey?: string };

/**
 * The file for a create, revision or draft replacement: either a direct upload
 * (`uploadKey` and `sha256`) or, for small files, Base64 in the request body.
 */
export async function resolveControlledUpload(
  storage: ControlledStorageBackend,
  tenantId: string,
  input: { uploadKey?: unknown; sha256?: unknown; contentBase64?: unknown; fileName?: unknown; mimeType?: unknown },
): Promise<ControlledUpload> {
  if (input.uploadKey === undefined || input.uploadKey === null) return decodeControlledUpload(input as Parameters<typeof decodeControlledUpload>[0]);
  if (!isTenantUploadKey(tenantId, input.uploadKey)) throw new Error('The uploaded file reference is not valid');
  if (typeof input.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(input.sha256)) {
    throw new Error('The SHA-256 of the uploaded file is required');
  }
  const mimeType = typeof input.mimeType === 'string' ? input.mimeType.toLowerCase().trim() : '';
  if (!ALLOWED_MIME_TYPES.has(mimeType)) throw new Error('Controlled document file type is not allowed');

  let object: StoredObject | null;
  try {
    object = await storage.getObject(input.uploadKey);
  } catch {
    throw new Error('The uploaded file could not be read; upload it again');
  }
  if (!object) throw new Error('The uploaded file was not found; upload it again');
  if (object.bytes.byteLength === 0 || object.bytes.byteLength > MAX_CONTROLLED_FILE_BYTES) {
    throw new Error('Controlled document exceeds the maximum file size');
  }
  const hash = sha256(object.bytes);
  if (hash !== input.sha256) throw new Error('The uploaded file does not match the file you selected; upload it again');
  return { bytes: object.bytes, fileName: sanitizeDisplayFileName(input.fileName), mimeType, hash, stagingKey: input.uploadKey };
}

export function createControlledObjectKey(input: {
  tenantId: string;
  documentId: string;
  versionNumber: number;
}): string {
  for (const value of [input.tenantId, input.documentId]) assertScopeSegment(value);
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
