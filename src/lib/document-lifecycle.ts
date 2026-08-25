import 'server-only';

import { randomBytes } from 'node:crypto';
import { vercelBlobStorage, verifyControlledObject } from './controlled-storage';

export const DOCUMENT_STATUSES = ['DRAFT', 'IN_REVIEW', 'APPROVED', 'EFFECTIVE', 'SUPERSEDED', 'OBSOLETE'] as const;
export type DocumentStatus = typeof DOCUMENT_STATUSES[number];

export const DOCUMENT_TYPES = ['SOP', 'POLICY', 'WORK_INSTRUCTION', 'FORM', 'OTHER'] as const;
export type DocumentType = typeof DOCUMENT_TYPES[number];

const TRANSITIONS: Readonly<Record<DocumentStatus, ReadonlySet<DocumentStatus>>> = {
  DRAFT: new Set(['IN_REVIEW', 'OBSOLETE']),
  IN_REVIEW: new Set(['DRAFT', 'APPROVED']),
  APPROVED: new Set(['EFFECTIVE', 'OBSOLETE']),
  EFFECTIVE: new Set(['SUPERSEDED', 'OBSOLETE']),
  SUPERSEDED: new Set(),
  OBSOLETE: new Set(),
};

export class DocumentLifecycleError extends Error {
  constructor(message: string, public readonly code = 'InvalidTransition') {
    super(message);
  }
}

export function parseDocumentStatus(value: unknown): DocumentStatus {
  if (typeof value !== 'string' || !DOCUMENT_STATUSES.includes(value as DocumentStatus)) {
    throw new DocumentLifecycleError('Unknown document lifecycle status');
  }
  return value as DocumentStatus;
}

export function assertTransition(from: unknown, to: DocumentStatus) {
  const current = parseDocumentStatus(from);
  if (!TRANSITIONS[current].has(to)) {
    throw new DocumentLifecycleError(`Document cannot transition from ${current} to ${to}`);
  }
}

export function normalizeDocumentType(value: unknown): DocumentType {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase().replace(/[\s-]+/g, '_') : 'OTHER';
  if (!DOCUMENT_TYPES.includes(normalized as DocumentType)) {
    throw new DocumentLifecycleError('Unsupported document type', 'ValidationFailed');
  }
  return normalized as DocumentType;
}

export function generateDocumentNumber(type: DocumentType): string {
  const prefix: Record<DocumentType, string> = {
    SOP: 'SOP', POLICY: 'POL', WORK_INSTRUCTION: 'WI', FORM: 'FRM', OTHER: 'DOC',
  };
  return `${prefix[type]}-${randomBytes(4).toString('hex').toUpperCase()}`;
}

export type IntegrityVersion = {
  storageKey: string | null;
  hash: string;
  sizeBytes: number | null;
};

export async function verifyLifecycleIntegrity(version: IntegrityVersion) {
  if (!version.storageKey || !version.hash || !version.sizeBytes) {
    throw new DocumentLifecycleError(
      'This legacy document version requires controlled-file migration before lifecycle actions are allowed',
      'MigrationRequired',
    );
  }
  const object = await verifyControlledObject(vercelBlobStorage, version.storageKey, version.hash);
  if (object.size !== version.sizeBytes) {
    throw new DocumentLifecycleError('Controlled document size verification failed', 'IntegrityFailure');
  }
  return object;
}

export function lifecycleErrorResponse(error: unknown): { code: string; message: string; status: number } | null {
  if (!(error instanceof DocumentLifecycleError)) return null;
  return {
    code: error.code,
    message: error.message,
    status: error.code === 'ValidationFailed' ? 400 : 409,
  };
}
