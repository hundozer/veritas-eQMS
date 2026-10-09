import { describe, expect, it } from 'vitest';
import { signingRequest } from './signing-request';

describe('signing request from the document screen', () => {
  it('SIGNREQ-T001 a review signature completes the review with the password', () => {
    expect(signingRequest('REVIEW', 'doc-1', '  looks right ', 'pw')).toEqual({
      path: '/api/documents/doc-1/review', method: 'POST', body: { action: 'COMPLETE', comment: 'looks right', password: 'pw' },
    });
  });

  it('SIGNREQ-T002 an approval signature goes to the approval route with the password', () => {
    expect(signingRequest('APPROVE', 'doc-1', '', 'pw')).toEqual({
      path: '/api/documents/doc-1/approve', method: 'POST', body: { comment: '', password: 'pw' },
    });
  });

  it('SIGNREQ-T003 a release signature goes to the release route with the password', () => {
    expect(signingRequest('RELEASE', 'doc-1', ' ok ', 'pw')).toEqual({
      path: '/api/documents/doc-1/release', method: 'POST', body: { comment: 'ok', password: 'pw' },
    });
  });

  it('SIGNREQ-T004 a retirement signature sends the required reason to the retirement route', () => {
    expect(signingRequest('RETIRE', 'doc-1', ' replaced by SOP-200 ', 'pw')).toEqual({
      path: '/api/documents/doc-1', method: 'DELETE', body: { reason: 'replaced by SOP-200', password: 'pw' },
    });
  });

  it('SIGNREQ-T005 a training signature goes to the assignment\'s signing route with the password', () => {
    expect(signingRequest('READ', 'assignment-1', ' ', 'pw')).toEqual({
      path: '/api/trainings/assignment-1/sign', method: 'POST', body: { comment: '', password: 'pw' },
    });
  });
});
