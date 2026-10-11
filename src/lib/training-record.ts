// The member's own training record on the Training tab: what each of their
// assignments allows, and the order to show them in. The interface offers
// signing only with training.complete_own; the signing route checks the same
// permission and the assignment again (DEC-075).

export type TrainingRowState = 'sign' | 'open' | 'waiting' | 'signed' | 'superseded';

export interface RecordAssignment {
  id: string;
  userId: string;
  status: string;
  assignedAt: string;
  completedAt: string | null;
  documentVersion?: { versionNumber: number } | null;
}

export function trainingRowState(assignment: RecordAssignment, permissions: readonly string[] | undefined): TrainingRowState {
  if (assignment.status === 'SUPERSEDED') return 'superseded';
  if (assignment.status !== 'ASSIGNED') return 'signed';
  if (!assignment.documentVersion) return 'waiting';
  return (permissions ?? []).includes('training.complete_own') ? 'sign' : 'open';
}

const ORDER: Record<TrainingRowState, number> = { sign: 0, open: 0, waiting: 1, signed: 2, superseded: 3 };

// Own assignments only: open ones first (oldest first, they have waited
// longest), then signed ones (newest first), then superseded history.
export function ownTrainingRecord<T extends RecordAssignment>(
  assignments: readonly T[],
  userId: string | undefined,
  permissions: readonly string[] | undefined,
): Array<T & { state: TrainingRowState }> {
  if (!userId) return [];
  return assignments
    .filter((a) => a.userId === userId)
    .map((a) => ({ ...a, state: trainingRowState(a, permissions) }))
    .sort((a, b) => ORDER[a.state] - ORDER[b.state]
      || (a.state === 'signed'
        ? (b.completedAt ?? '').localeCompare(a.completedAt ?? '')
        : a.assignedAt.localeCompare(b.assignedAt)));
}
