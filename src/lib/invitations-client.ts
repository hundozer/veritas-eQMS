// Requests the Users screen sends to invite people and resend invitations.
export type InviteForm = { firstName: string; lastName: string; email: string; department: string; roleId: string };

export async function inviteMember(form: InviteForm, send: typeof fetch = fetch): Promise<{ ok: true } | { ok: false; message: string }> {
  const response = await send('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim().toLowerCase(),
      department: form.department.trim(),
      roleId: form.roleId,
    }),
  });
  if (response.ok) return { ok: true };
  const data = await response.json().catch(() => null);
  return { ok: false, message: data?.error?.message ?? 'The invitation could not be sent.' };
}

export async function resendInvitation(userId: string, send: typeof fetch = fetch): Promise<{ ok: true } | { ok: false; message: string }> {
  const response = await send(`/api/users/${encodeURIComponent(userId)}/invitation`, { method: 'POST' });
  if (response.ok) return { ok: true };
  const data = await response.json().catch(() => null);
  return { ok: false, message: data?.error?.message ?? 'The invitation could not be resent.' };
}

export async function resetTwoStepVerification(userId: string, reason: string, send: typeof fetch = fetch): Promise<{ ok: true } | { ok: false; message: string }> {
  const response = await send(`/api/users/${encodeURIComponent(userId)}/mfa-reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: reason.trim() }),
  });
  if (response.ok) return { ok: true };
  const data = await response.json().catch(() => null);
  return { ok: false, message: data?.error?.message ?? 'Two-step verification could not be reset.' };
}

export type DeactivationOpenWork = { approvalSteps: unknown[]; trainingAssignments: unknown[]; ownedDocuments: unknown[] };

export async function deactivateMember(userId: string, reason: string, send: typeof fetch = fetch): Promise<{ ok: true; openWork: DeactivationOpenWork } | { ok: false; message: string }> {
  const response = await send(`/api/users/${encodeURIComponent(userId)}/deactivate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: reason.trim() }),
  });
  const data = await response.json().catch(() => null);
  if (response.ok) return { ok: true, openWork: data?.openWork ?? { approvalSteps: [], trainingAssignments: [], ownedDocuments: [] } };
  return { ok: false, message: data?.error?.message ?? 'The member could not be deactivated.' };
}

// What a deactivated member leaves open, for the administrator to reassign.
export function openWorkSummary(work: DeactivationOpenWork): string {
  const counted = (count: number, noun: string) => (count === 0 ? null : `${count} ${noun}${count === 1 ? '' : 's'}`);
  const parts = [
    counted(work.approvalSteps.length, 'pending approval step'),
    counted(work.trainingAssignments.length, 'open training assignment'),
    counted(work.ownedDocuments.length, 'owned document'),
  ].filter((part): part is string => part !== null);
  return parts.length === 0 ? 'They had no open work.' : `They still have ${parts.join(', ')} to reassign.`;
}

export async function changeMemberRole(userId: string, roleId: string, reason: string, send: typeof fetch = fetch): Promise<{ ok: true; roleName: string } | { ok: false; message: string }> {
  const response = await send(`/api/users/${encodeURIComponent(userId)}/role`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roleId, reason: reason.trim() }),
  });
  const data = await response.json().catch(() => null);
  if (response.ok) return { ok: true, roleName: data?.role?.roleName ?? '' };
  return { ok: false, message: data?.error?.message ?? 'The role could not be changed.' };
}
