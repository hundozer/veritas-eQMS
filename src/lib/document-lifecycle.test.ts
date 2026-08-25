import { beforeEach, describe, expect, it, vi } from 'vitest';

const storageMock = vi.hoisted(() => ({
  vercelBlobStorage: {},
  verifyControlledObject: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('./controlled-storage', () => storageMock);

import {
  assertTransition,
  DocumentLifecycleError,
  generateDocumentNumber,
  normalizeDocumentType,
  verifyLifecycleIntegrity,
} from './document-lifecycle';

describe('controlled document lifecycle', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    ['DRAFT', 'IN_REVIEW'],
    ['IN_REVIEW', 'DRAFT'],
    ['IN_REVIEW', 'APPROVED'],
    ['APPROVED', 'EFFECTIVE'],
    ['EFFECTIVE', 'SUPERSEDED'],
    ['EFFECTIVE', 'OBSOLETE'],
  ] as const)('permits %s -> %s', (from, to) => {
    expect(() => assertTransition(from, to)).not.toThrow();
  });

  it.each([
    ['DRAFT', 'EFFECTIVE'],
    ['IN_REVIEW', 'EFFECTIVE'],
    ['APPROVED', 'DRAFT'],
    ['SUPERSEDED', 'DRAFT'],
    ['OBSOLETE', 'IN_REVIEW'],
  ] as const)('rejects forbidden %s -> %s', (from, to) => {
    expect(() => assertTransition(from, to)).toThrow(DocumentLifecycleError);
  });

  it('normalizes supported document types and rejects invented types', () => {
    expect(normalizeDocumentType('work instruction')).toBe('WORK_INSTRUCTION');
    expect(() => normalizeDocumentType('protocol')).toThrowError('Unsupported document type');
  });

  it('generates type-specific controlled numbers with unpredictable suffixes', () => {
    const first = generateDocumentNumber('SOP');
    const second = generateDocumentNumber('SOP');
    expect(first).toMatch(/^SOP-[0-9A-F]{8}$/);
    expect(second).not.toBe(first);
  });

  it('fails closed for a legacy version missing controlled-storage metadata', async () => {
    await expect(verifyLifecycleIntegrity({ storageKey: null, hash: 'abc', sizeBytes: null }))
      .rejects.toMatchObject({ code: 'MigrationRequired' });
    expect(storageMock.verifyControlledObject).not.toHaveBeenCalled();
  });

  it('verifies persisted bytes and rejects a size mismatch', async () => {
    storageMock.verifyControlledObject.mockResolvedValue({ size: 9 });
    await expect(verifyLifecycleIntegrity({ storageKey: 'immutable/key', hash: 'abc', sizeBytes: 8 }))
      .rejects.toMatchObject({ code: 'IntegrityFailure' });
    expect(storageMock.verifyControlledObject).toHaveBeenCalledWith(storageMock.vercelBlobStorage, 'immutable/key', 'abc');
  });
});
