import { describe, expect, it } from 'vitest';
import {
  lifecycleCounts,
  queueSummary,
  routingSlip,
  recentlyChanged,
  signatureQueue,
  type DashboardDocument,
  type DashboardTraining,
} from './dashboard-summary';

const ME = 'u-me';
const OTHER = 'u-other';
const ALL = ['documents.review', 'documents.approve', 'documents.release', 'training.complete_own'];

const doc = (over: Partial<DashboardDocument> & { steps?: Array<[string, string, string]>; authoredById?: string | null }): DashboardDocument => {
  const { steps = [], authoredById = OTHER, ...rest } = over;
  return {
    id: 'd1',
    documentNumber: 'SOP-QC-014',
    title: 'HPLC system suitability',
    status: 'DRAFT',
    currentVersionNumber: 2,
    updatedAt: '2026-10-10T08:00:00.000Z',
    versions: [
      { versionNumber: 1, authoredById: OTHER, approvalRoutes: [] },
      {
        versionNumber: 2,
        authoredById,
        approvalRoutes: [{ steps: steps.map(([stepType, status, approverId]) => ({ stepType, status, approver: { id: approverId } })) }],
      },
    ],
    ...rest,
  };
};

const training = (over: Partial<DashboardTraining>): DashboardTraining => ({
  id: 't1',
  userId: ME,
  status: 'ASSIGNED',
  assignedAt: '2026-10-09T08:00:00.000Z',
  documentVersion: { versionNumber: 3 },
  requirement: { document: { id: 'd9', documentNumber: 'SOP-QA-001', title: 'Control of GMP documents' } },
  ...over,
});

describe('overview signature queue', () => {
  it('DASH-T001 offers the assigned pending review, and approval only after the review is signed', () => {
    const reviewing = doc({ id: 'r', status: 'IN_REVIEW', steps: [['REVIEW', 'PENDING', ME], ['APPROVAL', 'PENDING', ME]] });
    const approving = doc({ id: 'a', status: 'IN_REVIEW', steps: [['REVIEW', 'COMPLETED', OTHER], ['APPROVAL', 'PENDING', ME]] });

    expect(signatureQueue(ME, ALL, [reviewing, approving], []).map((item) => [item.meaning, item.documentId]))
      .toEqual([['REVIEW', 'r'], ['APPROVE', 'a']]);
  });

  it('DASH-T002 leaves out steps assigned to someone else or already signed', () => {
    const others = doc({ id: 'o', status: 'IN_REVIEW', steps: [['REVIEW', 'PENDING', OTHER], ['APPROVAL', 'PENDING', OTHER]] });
    const done = doc({ id: 'x', status: 'IN_REVIEW', steps: [['REVIEW', 'COMPLETED', ME], ['APPROVAL', 'COMPLETED', ME]] });

    expect(signatureQueue(ME, ALL, [others, done], [])).toEqual([]);
  });

  it('DASH-T003 follows persisted permissions, not assignment alone', () => {
    const reviewing = doc({ status: 'IN_REVIEW', steps: [['REVIEW', 'PENDING', ME]] });
    const approved = doc({ id: 'p', status: 'APPROVED' });

    expect(signatureQueue(ME, ['documents.approve'], [reviewing, approved], [training({})])).toEqual([]);
  });

  it('DASH-T004 offers release of an approved revision, never to its author', () => {
    const byOther = doc({ id: 'p1', status: 'APPROVED', authoredById: OTHER });
    const mine = doc({ id: 'p2', status: 'APPROVED', authoredById: ME });

    expect(signatureQueue(ME, ALL, [byOther, mine], []).map((item) => [item.meaning, item.documentId]))
      .toEqual([['RELEASE', 'p1']]);
  });

  it('DASH-T005 offers only own open training on a released version, oldest first', () => {
    const queue = signatureQueue(ME, ALL, [doc({ id: 'p', status: 'APPROVED', updatedAt: '2026-10-12T00:00:00.000Z' })], [
      training({ id: 'mine' }),
      training({ id: 'theirs', userId: OTHER }),
      training({ id: 'done', status: 'COMPLETED' }),
      training({ id: 'old', status: 'SUPERSEDED' }),
      training({ id: 'waiting', documentVersion: null }),
    ]);

    expect(queue.map((item) => [item.meaning, item.trainingId ?? item.documentId, item.versionNumber]))
      .toEqual([['READ', 'mine', 3], ['RELEASE', 'p', 2]]);
  });

  it('DASH-T006 is empty without a signed-in member', () => {
    expect(signatureQueue(undefined, ALL, [doc({ status: 'APPROVED' })], [training({})])).toEqual([]);
  });
});

describe('overview register', () => {
  it('DASH-T007 counts documents per lifecycle state, including empty states', () => {
    const counts = lifecycleCounts([{ status: 'EFFECTIVE' }, { status: 'EFFECTIVE' }, { status: 'DRAFT' }]);
    expect(counts).toEqual([
      { state: 'DRAFT', count: 1 },
      { state: 'IN_REVIEW', count: 0 },
      { state: 'APPROVED', count: 0 },
      { state: 'EFFECTIVE', count: 2 },
      { state: 'OBSOLETE', count: 0 },
    ]);
  });

  it('DASH-T008 lists the most recently changed documents first', () => {
    const rows = [
      { id: 'a', updatedAt: '2026-10-01T00:00:00.000Z' },
      { id: 'b', updatedAt: '2026-10-03T00:00:00.000Z' },
      { id: 'c', updatedAt: '2026-10-02T00:00:00.000Z' },
    ];
    expect(recentlyChanged(rows, 2).map((row) => row.id)).toEqual(['b', 'c']);
  });
});

describe('overview summary line', () => {
  it('DASH-T009 counts each meaning in lifecycle order with plural nouns', () => {
    const q = (meaning: 'REVIEW' | 'APPROVE' | 'RELEASE' | 'READ') => ({ meaning });
    expect(queueSummary([q('RELEASE'), q('REVIEW'), q('REVIEW'), q('APPROVE')])).toBe('2 reviews, 1 approval and 1 release.');
    expect(queueSummary([q('READ')])).toBe('1 training to sign.');
    expect(queueSummary([q('READ'), q('READ'), q('APPROVE')])).toBe('1 approval and 2 trainings to sign.');
    expect(queueSummary([])).toBe('');
  });
});

describe('routing slip', () => {
  const named = (over: Parameters<typeof doc>[0]) => {
    const d = doc(over);
    const v = d.versions[1];
    v.createdBy = 'Lena Brandt';
    v.createdAt = '2026-10-01T08:00:00.000Z';
    v.approvalRoutes?.[0].steps.forEach((s) => { s.approver.fullName = s.approver.id === ME ? 'Katrin Vogel' : 'Marek Novak'; });
    return d;
  };

  it('DASH-T010 marks the member\'s own step and shows who signed or must sign the others', () => {
    const d = named({ id: 'a', status: 'IN_REVIEW', steps: [['REVIEW', 'COMPLETED', OTHER], ['APPROVAL', 'PENDING', ME]] });
    const [item] = signatureQueue(ME, ALL, [d], []);
    expect(routingSlip(item, [d], [])).toEqual([
      { role: 'Author', name: 'Lena Brandt', state: 'signed', date: '2026-10-01T08:00:00.000Z' },
      { role: 'Review', name: 'Marek Novak', state: 'signed' },
      { role: 'Approve', name: null, state: 'yours' },
      { role: 'Release', name: null, state: 'open' },
    ]);
  });

  it('DASH-T011 shows a later step assigned to someone else as waiting, not signed', () => {
    const d = named({ id: 'r', status: 'IN_REVIEW', steps: [['REVIEW', 'PENDING', ME], ['APPROVAL', 'PENDING', OTHER]] });
    const [item] = signatureQueue(ME, ALL, [d], []);
    expect(routingSlip(item, [d], []).map((b) => [b.role, b.state, b.name])).toEqual([
      ['Author', 'signed', 'Lena Brandt'], ['Review', 'yours', null], ['Approve', 'waiting', 'Marek Novak'], ['Release', 'open', null],
    ]);
  });

  it('DASH-T012 gives training a two-box slip: assigned, then the member\'s read-and-understood signature', () => {
    const t = training({ id: 'mine' });
    const [item] = signatureQueue(ME, ALL, [], [t]);
    expect(routingSlip(item, [], [t])).toEqual([
      { role: 'Assigned', name: null, state: 'signed', date: t.assignedAt },
      { role: 'Read and understood', name: null, state: 'yours' },
    ]);
  });
});
