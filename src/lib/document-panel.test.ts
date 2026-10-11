import { describe, expect, it } from 'vitest';
import { documentPanelActions, lifecyclePosition } from './document-panel';

const ME = 'u-me';
const OTHER = 'u-other';

const doc = (status: string, steps: Array<[string, string, string]> = [], versions: string[] = []) => ({
  status,
  currentVersionNumber: 2,
  versions: [
    { versionNumber: 2, status, approvalRoutes: [{ steps: steps.map(([stepType, s, id]) => ({ stepType, status: s, approver: { id } })) }] },
    ...versions.map((v, i) => ({ versionNumber: 1 - i, status: v })),
  ],
});

describe('Documents tab actions', () => {
  it('DOCPANEL-T001 offers file replacement and submission on a draft only, each to its own permission', () => {
    const p = ['documents.update_draft', 'documents.submit_review'];
    expect(documentPanelActions(doc('DRAFT'), ME, p)).toEqual(['REPLACE_FILE', 'SUBMIT_REVIEW']);
    expect(documentPanelActions(doc('DRAFT'), ME, ['documents.update_draft'])).toEqual(['REPLACE_FILE']);
    expect(documentPanelActions(doc('DRAFT'), ME, ['documents.submit_review'])).toEqual(['SUBMIT_REVIEW']);
    expect(documentPanelActions(doc('IN_REVIEW'), ME, p)).toEqual([]);
    expect(documentPanelActions(doc('DRAFT'), ME, ['documents.read'])).toEqual([]);
  });

  it('DOCPANEL-T002 offers review signing and return only to the assigned pending reviewer', () => {
    const p = ['documents.review'];
    expect(documentPanelActions(doc('IN_REVIEW', [['REVIEW', 'PENDING', ME]]), ME, p)).toEqual(['SIGN_REVIEW', 'RETURN']);
    expect(documentPanelActions(doc('IN_REVIEW', [['REVIEW', 'PENDING', OTHER]]), ME, p)).toEqual([]);
    expect(documentPanelActions(doc('IN_REVIEW', [['REVIEW', 'COMPLETED', ME]]), ME, p)).toEqual([]);
    expect(documentPanelActions(doc('IN_REVIEW', [['REVIEW', 'PENDING', ME]]), ME, ['documents.approve'])).toEqual([]);
  });

  it('DOCPANEL-T003 offers approval only to the assigned approver after the review is signed', () => {
    const p = ['documents.approve'];
    expect(documentPanelActions(doc('IN_REVIEW', [['REVIEW', 'COMPLETED', OTHER], ['APPROVAL', 'PENDING', ME]]), ME, p)).toEqual(['SIGN_APPROVE']);
    expect(documentPanelActions(doc('IN_REVIEW', [['REVIEW', 'PENDING', OTHER], ['APPROVAL', 'PENDING', ME]]), ME, p)).toEqual([]);
    expect(documentPanelActions(doc('IN_REVIEW', [['REVIEW', 'COMPLETED', OTHER], ['APPROVAL', 'PENDING', OTHER]]), ME, p)).toEqual([]);
  });

  it('DOCPANEL-T004 offers release of an approved revision to holders of documents.release', () => {
    expect(documentPanelActions(doc('APPROVED'), ME, ['documents.release'])).toEqual(['SIGN_RELEASE']);
    expect(documentPanelActions(doc('APPROVED'), ME, ['documents.approve'])).toEqual([]);
  });

  it('DOCPANEL-T005 offers a new revision of an effective document to holders of documents.update_draft', () => {
    expect(documentPanelActions(doc('EFFECTIVE'), ME, ['documents.update_draft'])).toEqual(['START_REVISION']);
  });

  it('DOCPANEL-T010 offers documents.create holders nothing the server would refuse them', () => {
    for (const s of ['DRAFT', 'IN_REVIEW', 'APPROVED', 'EFFECTIVE']) {
      expect(documentPanelActions(doc(s, [], ['EFFECTIVE']), ME, ['documents.read', 'documents.create'])).toEqual([]);
    }
  });

  it('DOCPANEL-T006 offers withdrawal only for an open revision while an effective version exists', () => {
    const p = ['documents.update_draft'];
    expect(documentPanelActions(doc('IN_REVIEW', [], ['EFFECTIVE']), ME, p)).toEqual(['WITHDRAW_REVISION']);
    expect(documentPanelActions(doc('IN_REVIEW'), ME, p)).toEqual([]);
    expect(documentPanelActions(doc('EFFECTIVE'), ME, p)).not.toContain('WITHDRAW_REVISION');
  });

  it('DOCPANEL-T007 offers retirement of draft, approved and effective documents to holders of documents.obsolete', () => {
    const p = ['documents.obsolete'];
    for (const s of ['DRAFT', 'APPROVED', 'EFFECTIVE']) expect(documentPanelActions(doc(s), ME, p)).toEqual(['SIGN_RETIRE']);
    for (const s of ['IN_REVIEW', 'OBSOLETE']) expect(documentPanelActions(doc(s), ME, p)).toEqual([]);
  });

  it('DOCPANEL-T008 offers nothing without a signed-in member to the assignment-bound actions', () => {
    expect(documentPanelActions(doc('IN_REVIEW', [['REVIEW', 'PENDING', ME]]), undefined, ['documents.review'])).toEqual([]);
  });

  it('DOCPANEL-T009 places the current revision on the lifecycle path', () => {
    expect(['DRAFT', 'IN_REVIEW', 'APPROVED', 'EFFECTIVE', 'OBSOLETE'].map(lifecyclePosition)).toEqual([0, 1, 2, 3, -1]);
  });
});
