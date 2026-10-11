// EXAMPLE (type-checked, not shipped): which actions the interface offers,
// derived only from persisted permissions and the record's state, as
// src/lib/document-actions.ts and src/lib/document-panel.ts do. The route
// checks the same rules again; the interface never decides on a role name.

export type ChangeAction = 'SUBMIT' | 'SIGN_APPROVAL' | 'CLOSE';

export function changeActionsFor(
  change: { status: string; ownerId: string },
  userId: string | undefined,
  permissions: readonly string[] | undefined,
): ChangeAction[] {
  const granted = new Set(permissions ?? []);
  const actions: ChangeAction[] = [];
  if (change.status === 'DRAFT' && granted.has('change.create')) actions.push('SUBMIT');
  // Segregation of duties: the owner never approves their own change.
  if (change.status === 'UNDER_REVIEW' && granted.has('change.approve') && userId !== change.ownerId) actions.push('SIGN_APPROVAL');
  if (change.status === 'APPROVED' && granted.has('change.approve')) actions.push('CLOSE');
  return actions;
}
