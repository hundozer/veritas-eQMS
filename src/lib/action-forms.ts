// In-page forms for the document and member actions that need more than a
// click: a reason, a new source file, or the people a draft is routed to.
// The routes check every value again; these only stop an obviously
// incomplete form from being sent.

export type ReasonFormKind = 'RETURN' | 'WITHDRAW_REVISION' | 'START_REVISION' | 'RESET_TWO_STEP' | 'DEACTIVATE';

export interface ReasonFormSpec {
  title: string;
  label: string;
  note: string;
  submit: string;
  needsFile: boolean;
}

export const REASON_FORMS: Record<ReasonFormKind, ReasonFormSpec> = {
  RETURN: {
    title: 'Return for changes',
    label: 'Reason for returning',
    note: 'The revision goes back to draft. The reason is kept in the audit trail.',
    submit: 'Return to draft',
    needsFile: false,
  },
  WITHDRAW_REVISION: {
    title: 'Withdraw this revision',
    label: 'Reason for withdrawing',
    note: 'The draft revision is withdrawn; the effective revision stays in force. The reason is kept in the audit trail.',
    submit: 'Withdraw revision',
    needsFile: false,
  },
  START_REVISION: {
    title: 'Start a new revision',
    label: 'Reason for the revision',
    note: 'The new revision starts as a draft with this source file. The effective revision stays in force until the new one is released.',
    submit: 'Create draft revision',
    needsFile: true,
  },
  RESET_TWO_STEP: {
    title: 'Reset two-step verification',
    label: 'Reason for the reset',
    note: 'They set up two-step verification again at their next sign-in. The reason is kept in the audit trail.',
    submit: 'Reset two-step verification',
    needsFile: false,
  },
  DEACTIVATE: {
    title: 'Deactivate member',
    label: 'Reason for deactivating',
    note: 'They are signed out everywhere and can no longer sign in to this organisation. Their records, signatures and training history stay unchanged. The reason is kept in the audit trail.',
    submit: 'Deactivate member',
    needsFile: false,
  },
};

export type FormCheck<T> = { ok: true; value: T } | { ok: false; message: string };

export function checkReason(kind: ReasonFormKind, reason: string, file: File | null = null): FormCheck<{ reason: string; file: File | null }> {
  const trimmed = reason.trim();
  if (!trimmed) return { ok: false, message: `Enter the ${REASON_FORMS[kind].label.toLowerCase()}.` };
  if (REASON_FORMS[kind].needsFile && !file) return { ok: false, message: 'Choose the source file for the new revision.' };
  return { ok: true, value: { reason: trimmed, file } };
}

export interface RoutingMember {
  id: string;
  fullName: string;
  email: string;
  accountStatus?: string | null;
  invitationPending?: boolean;
}

// Who a draft can be routed to: members who have finished signing up and are
// active, in name order.
export function routingCandidates<T extends RoutingMember>(members: readonly T[]): T[] {
  return members
    .filter((member) => !member.invitationPending && (member.accountStatus ?? 'ACTIVE') === 'ACTIVE')
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}

export function checkRouting(
  reviewerId: string,
  approverId: string,
  candidates: readonly RoutingMember[],
): FormCheck<{ reviewerId: string; approverId: string }> {
  if (!reviewerId || !approverId) return { ok: false, message: 'Choose a reviewer and an approver.' };
  if (reviewerId === approverId) return { ok: false, message: 'The reviewer and the approver must be different people.' };
  const known = new Set(candidates.map((member) => member.id));
  if (!known.has(reviewerId) || !known.has(approverId)) return { ok: false, message: 'Choose the reviewer and approver from the list.' };
  return { ok: true, value: { reviewerId, approverId } };
}
