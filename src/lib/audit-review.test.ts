import { describe, expect, it } from 'vitest';
import { describeAuditPayload } from './audit-review';

describe('audit review: field changes from a stored payload', () => {
  it('AUDREV-T001 a status transition becomes one change; the rest are details', () => {
    const payload = JSON.stringify({ documentId: 'doc-1', version: 2, before: 'IN_REVIEW', after: 'APPROVED', comment: 'fine' });
    expect(describeAuditPayload(payload)).toEqual({
      changes: [{ field: 'status', before: 'IN_REVIEW', after: 'APPROVED' }],
      details: [{ field: 'documentId', value: 'doc-1' }, { field: 'version', value: '2' }, { field: 'comment', value: 'fine' }],
    });
  });

  it('AUDREV-T002 named before/after pairs and before/after records are compared field by field', () => {
    expect(describeAuditPayload(JSON.stringify({ purpose: 'PASSWORD_SETUP', accountStatus: { before: 'INVITED', after: 'ACTIVE' } }))).toEqual({
      changes: [{ field: 'accountStatus', before: 'INVITED', after: 'ACTIVE' }],
      details: [{ field: 'purpose', value: 'PASSWORD_SETUP' }],
    });
    expect(describeAuditPayload(JSON.stringify({ before: { title: 'Old', owner: 'a' }, after: { title: 'New', owner: 'a', site: 'Berlin' } }))).toEqual({
      changes: [{ field: 'title', before: 'Old', after: 'New' }, { field: 'site', before: '', after: 'Berlin' }],
      details: [],
    });
  });

  it('AUDREV-T003 lists and nested values are shown as text; an unreadable payload yields nothing rather than failing', () => {
    expect(describeAuditPayload(JSON.stringify({ departments: ['QA', 'Production'], supersedes: [], meta: { a: 1 } })).details).toEqual([
      { field: 'departments', value: 'QA, Production' },
      { field: 'supersedes', value: '' },
      { field: 'meta', value: '{"a":1}' },
    ]);
    expect(describeAuditPayload('not json')).toEqual({ changes: [], details: [] });
    expect(describeAuditPayload('"just text"')).toEqual({ changes: [], details: [] });
  });
});
