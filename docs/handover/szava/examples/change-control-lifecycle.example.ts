// EXAMPLE (type-checked by `npx tsc --noEmit`, not shipped): the lifecycle
// guard every record type gets, copied from src/lib/document-lifecycle.ts.
// The real change-control states are fixed by the VER-02 pull request
// (docs/architecture/quality-workflows.md); these are placeholders.

export const CHANGE_STATUSES = ['DRAFT', 'UNDER_REVIEW', 'APPROVED', 'CLOSED'] as const;
export type ChangeStatus = typeof CHANGE_STATUSES[number];

const TRANSITIONS: Readonly<Record<ChangeStatus, ReadonlySet<ChangeStatus>>> = {
  DRAFT: new Set(['UNDER_REVIEW']),
  UNDER_REVIEW: new Set(['DRAFT', 'APPROVED']),
  APPROVED: new Set(['CLOSED']),
  CLOSED: new Set(),
};

export class ChangeLifecycleError extends Error {
  constructor(message: string, public readonly code = 'InvalidTransition') {
    super(message);
  }
}

export function assertChangeTransition(from: unknown, to: ChangeStatus) {
  if (typeof from !== 'string' || !CHANGE_STATUSES.includes(from as ChangeStatus)) {
    throw new ChangeLifecycleError('Unknown change-control status');
  }
  if (!TRANSITIONS[from as ChangeStatus].has(to)) {
    throw new ChangeLifecycleError(`Change control cannot move from ${from} to ${to}`);
  }
}
