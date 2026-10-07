import { describe, expect, it } from 'vitest';
import { signingRequest } from './signing-request';

describe('signing request from the document screen', () => {
  it('SIGNREQ-T001 a review signature completes the review with the password', () => {
    expect(signingRequest('REVIEW', 'doc-1', '  looks right ', 'pw')).toEqual({
      path: '/api/documents/doc-1/review', body: { action: 'COMPLETE', comment: 'looks right', password: 'pw' },
    });
  });

  it('SIGNREQ-T002 an approval signature goes to the approval route with the password', () => {
    expect(signingRequest('APPROVE', 'doc-1', '', 'pw')).toEqual({
      path: '/api/documents/doc-1/approve', body: { comment: '', password: 'pw' },
    });
  });
});
