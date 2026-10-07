import { describe, expect, it } from 'vitest';
import { documentActionsFor } from './document-actions';

describe('document actions offered by the interface', () => {
  it('DOCUI-T001 follows the persisted permissions', () => {
    expect(documentActionsFor(['documents.read', 'documents.create'])).toEqual({
      canAuthor: true, canReview: false, canApprove: false, canObsolete: false, canRelease: false,
    });
    expect(documentActionsFor(['documents.review', 'documents.approve', 'documents.obsolete', 'documents.release'])).toEqual({
      canAuthor: false, canReview: true, canApprove: true, canObsolete: true, canRelease: true,
    });
  });

  it('DOCUI-T002 offers nothing for legacy or missing permissions', () => {
    expect(documentActionsFor(['DOCUMENT_CREATE', 'DOCUMENT_APPROVE', 'DOCUMENT_RELEASE', 'documents.read'])).toEqual({
      canAuthor: false, canReview: false, canApprove: false, canObsolete: false, canRelease: false,
    });
    expect(documentActionsFor(undefined)).toEqual({
      canAuthor: false, canReview: false, canApprove: false, canObsolete: false, canRelease: false,
    });
  });
});
