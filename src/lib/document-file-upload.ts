import { uploadPresigned } from '@vercel/blob/client';

// Browser side of direct uploads (DEC-068): the file goes straight to private
// storage under a key the server reserved for the caller's tenant, and the
// request that saves the document carries only that key and the file's SHA-256.
// Small files may still travel inline if storage cannot be reached directly.

export const UPLOADS_ROUTE = '/api/documents/uploads';
/** Base64 grows a file by a third; the platform caps a request body at 4.5 MB. */
export const INLINE_UPLOAD_LIMIT_BYTES = 3 * 1024 * 1024;
const MULTIPART_THRESHOLD_BYTES = 8 * 1024 * 1024;

export type DocumentFileFields =
  | { fileName: string; mimeType: string; uploadKey: string; sha256: string }
  | { fileName: string; mimeType: string; contentBase64: string };

type Dependencies = {
  fetch: typeof fetch;
  upload: typeof uploadPresigned;
};

export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function toBase64(bytes: ArrayBuffer): string {
  let binary = '';
  const view = new Uint8Array(bytes);
  for (let index = 0; index < view.length; index += 0x8000) {
    binary += String.fromCharCode(...view.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

/** Uploads the file and returns the fields the create, revision or draft-replacement request needs. */
export async function prepareDocumentFile(
  file: File,
  dependencies: Dependencies = { fetch: (...args) => fetch(...args), upload: uploadPresigned },
): Promise<DocumentFileFields> {
  const fileName = file.name;
  const mimeType = file.type || 'application/octet-stream';
  const bytes = await file.arrayBuffer();
  try {
    const reserved = await dependencies.fetch(UPLOADS_ROUTE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'veritas.reserve-upload' }),
    });
    if (!reserved.ok) throw new Error('reserve');
    const { uploadKey } = await reserved.json() as { uploadKey: string };
    await dependencies.upload(uploadKey, file, {
      access: 'private',
      handleUploadUrl: UPLOADS_ROUTE,
      contentType: mimeType,
      multipart: file.size > MULTIPART_THRESHOLD_BYTES,
    });
    return { fileName, mimeType, uploadKey, sha256: await sha256Hex(bytes) };
  } catch {
    if (file.size > INLINE_UPLOAD_LIMIT_BYTES) {
      throw new Error('The file could not be uploaded to controlled storage; try again');
    }
    return { fileName, mimeType, contentBase64: toBase64(bytes) };
  }
}
