import { describe, expect, it } from 'vitest';
import { buildTrainingMatrix, type MatrixAssignment } from './training-matrix';

const sop = (id: string, title: string) => ({ id, documentNumber: `SOP-${id}`, title });
const row = (over: Partial<MatrixAssignment> & Pick<MatrixAssignment, 'id' | 'status'>): MatrixAssignment => ({
  assignedAt: '2026-10-01T00:00:00.000Z',
  completedAt: null,
  documentVersion: { versionNumber: 1 },
  user: { id: 'u1', fullName: 'Ana QA', department: 'QA' },
  requirement: { document: sop('1', 'Cleaning') },
  ...over,
});

describe('training matrix', () => {
  it('MATRIX-T001 one row per person, one column per document, sorted by name and number', () => {
    const matrix = buildTrainingMatrix([
      row({ id: 'a', status: 'ASSIGNED', user: { id: 'u2', fullName: 'Ben Line', department: 'Production' }, requirement: { document: sop('2', 'Gowning') } }),
      row({ id: 'b', status: 'COMPLETED', completedAt: '2026-10-05T00:00:00.000Z' }),
    ]);

    expect(matrix.documents.map((document) => document.documentNumber)).toEqual(['SOP-1', 'SOP-2']);
    expect(matrix.people.map((person) => [person.fullName, person.department])).toEqual([['Ana QA', 'QA'], ['Ben Line', 'Production']]);
    expect(matrix.people[0].cells['1']).toEqual({ status: 'COMPLETED', versionNumber: 1, completedAt: '2026-10-05T00:00:00.000Z' });
    expect(matrix.people[0].cells['2']).toBeUndefined();
    expect(matrix.people[1].cells['2']).toMatchObject({ status: 'ASSIGNED', versionNumber: 1 });
    expect(matrix.totals).toEqual({ open: 1, completed: 1 });
  });

  it('MATRIX-T002 the newest version wins: a completed old version does not hide open training on the new one', () => {
    const matrix = buildTrainingMatrix([
      row({ id: 'old', status: 'COMPLETED', completedAt: '2026-10-02T00:00:00.000Z' }),
      row({ id: 'new', status: 'ASSIGNED', documentVersion: { versionNumber: 2 } }),
      row({ id: 'legacy', status: 'ASSIGNED', documentVersion: null }),
    ]);

    expect(matrix.people[0].cells['1']).toEqual({ status: 'ASSIGNED', versionNumber: 2, completedAt: null });
    expect(matrix.totals).toEqual({ open: 1, completed: 0 });
  });

  it('MATRIX-T003 superseded assignments are history, not cells', () => {
    const matrix = buildTrainingMatrix([row({ id: 'gone', status: 'SUPERSEDED' })]);
    expect(matrix).toEqual({ documents: [], people: [], totals: { open: 0, completed: 0 } });
  });
});
