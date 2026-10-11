// The People tab: which account action each member row offers. The interface
// offers only what persisted permissions allow; the routes check again.
// - Resend an invitation that is still pending: users.create (DEC-063).
// - Reset someone else's two-step verification: users.update (DEC-080).

export type MemberAction = 'RESEND_INVITATION' | 'RESET_TWO_STEP';

export interface RegisterMember {
  id: string;
  fullName: string;
  invitationPending?: boolean;
}

export function memberActions(member: RegisterMember, currentUserId: string | undefined, permissions: readonly string[] | undefined): MemberAction[] {
  const granted = new Set(permissions ?? []);
  if (member.invitationPending) return granted.has('users.create') ? ['RESEND_INVITATION'] : [];
  return granted.has('users.update') && currentUserId !== undefined && member.id !== currentUserId ? ['RESET_TWO_STEP'] : [];
}

// Members in name order, with the signed-in member first.
export function peopleRegister<T extends RegisterMember>(members: readonly T[], currentUserId: string | undefined): T[] {
  return [...members].sort((a, b) => Number(b.id === currentUserId) - Number(a.id === currentUserId) || a.fullName.localeCompare(b.fullName));
}
