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
