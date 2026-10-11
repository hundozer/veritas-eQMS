// The People tab: which account action each member row offers. The interface
// offers only what persisted permissions allow; the routes check again.
// - Resend an invitation that is still pending: users.create (DEC-063).
// - Reset someone else's two-step verification: users.update (DEC-080).
// - Deactivate someone else who has left: users.deactivate (VER-00.4).
// A deactivated member is offered nothing.

export type MemberAction = 'RESEND_INVITATION' | 'RESET_TWO_STEP' | 'DEACTIVATE';

export interface RegisterMember {
  id: string;
  fullName: string;
  invitationPending?: boolean;
  accountStatus?: string | null;
}

export function isDeactivated(member: RegisterMember): boolean {
  return member.accountStatus === 'INACTIVE';
}

export function memberActions(member: RegisterMember, currentUserId: string | undefined, permissions: readonly string[] | undefined): MemberAction[] {
  const granted = new Set(permissions ?? []);
  if (isDeactivated(member)) return [];
  const someoneElse = currentUserId !== undefined && member.id !== currentUserId;
  const actions: MemberAction[] = [];
  if (member.invitationPending) {
    if (granted.has('users.create')) actions.push('RESEND_INVITATION');
  } else if (granted.has('users.update') && someoneElse) {
    actions.push('RESET_TWO_STEP');
  }
  if (granted.has('users.deactivate') && someoneElse) actions.push('DEACTIVATE');
  return actions;
}

// Members in name order, with the signed-in member first.
export function peopleRegister<T extends RegisterMember>(members: readonly T[], currentUserId: string | undefined): T[] {
  return [...members].sort((a, b) => Number(b.id === currentUserId) - Number(a.id === currentUserId) || a.fullName.localeCompare(b.fullName));
}
