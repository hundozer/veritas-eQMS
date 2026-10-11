import { describe, expect, it } from 'vitest';
import { ownTrainingRecord, trainingRowState, type RecordAssignment } from './training-record';

const SIGN = ['training.complete_own'];
const row = (over: Partial<RecordAssignment>): RecordAssignment => ({
  id: 'a', userId: 'me', status: 'ASSIGNED', assignedAt: '2026-10-01T00:00:00.000Z', completedAt: null, documentVersion: { versionNumber: 2 }, ...over,
});

describe('own training record', () => {
  it('TRAINREC-T001 offers signing an open assignment on a released version only with training.complete_own', () => {
    expect(trainingRowState(row({}), SIGN)).toBe('sign');
    expect(trainingRowState(row({}), ['training.read_own'])).toBe('open');
    expect(trainingRowState(row({}), undefined)).toBe('open');
  });

  it('TRAINREC-T002 never offers signing for an assignment without a version, a signed one or a superseded one', () => {
    expect(trainingRowState(row({ documentVersion: null }), SIGN)).toBe('waiting');
    expect(trainingRowState(row({ status: 'COMPLETED', completedAt: '2026-10-02T00:00:00.000Z' }), SIGN)).toBe('signed');
    expect(trainingRowState(row({ status: 'SUPERSEDED' }), SIGN)).toBe('superseded');
  });

  it('TRAINREC-T003 lists only the member\'s own assignments: open oldest first, then signed newest first, then superseded', () => {
    const record = ownTrainingRecord([
      row({ id: 'old-signed', status: 'COMPLETED', completedAt: '2026-09-01T00:00:00.000Z' }),
      row({ id: 'superseded', status: 'SUPERSEDED' }),
      row({ id: 'new-open', assignedAt: '2026-10-05T00:00:00.000Z' }),
      row({ id: 'theirs', userId: 'other' }),
      row({ id: 'new-signed', status: 'COMPLETED', completedAt: '2026-10-03T00:00:00.000Z' }),
      row({ id: 'old-open', assignedAt: '2026-10-01T00:00:00.000Z' }),
      row({ id: 'waiting', documentVersion: null }),
    ], 'me', SIGN);
    expect(record.map((r) => r.id)).toEqual(['old-open', 'new-open', 'waiting', 'new-signed', 'old-signed', 'superseded']);
  });

  it('TRAINREC-T004 is empty without a signed-in member', () => {
    expect(ownTrainingRecord([row({})], undefined, SIGN)).toEqual([]);
  });
});
