import { describe, expect, it, vi } from 'vitest';
import { inviteMember, resendInvitation } from './invitations-client';

describe('invitations from the Users screen', () => {
  it('INVITE-UI-T001 sends a normalised invitation', async () => {
    const send = vi.fn().mockResolvedValue(new Response('{}', { status: 201 }));

    await expect(inviteMember({ firstName: ' Ana ', lastName: 'Lee ', email: ' Ana.Lee@Example.Invalid ', department: 'QA', roleId: 'role-1' }, send))
      .resolves.toEqual({ ok: true });
    expect(send).toHaveBeenCalledWith('/api/users', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ firstName: 'Ana', lastName: 'Lee', email: 'ana.lee@example.invalid', department: 'QA', roleId: 'role-1' }),
    }));
  });

  it('INVITE-UI-T002 shows the server reason when an invitation or resend fails', async () => {
    const send = vi.fn().mockResolvedValue(Response.json({ error: { message: 'A user with this email address already exists' } }, { status: 409 }));

    await expect(inviteMember({ firstName: 'A', lastName: 'B', email: 'a@b.invalid', department: 'QA', roleId: 'r' }, send))
      .resolves.toEqual({ ok: false, message: 'A user with this email address already exists' });
    await expect(resendInvitation('user/1', send)).resolves.toMatchObject({ ok: false });
    expect(send).toHaveBeenLastCalledWith('/api/users/user%2F1/invitation', { method: 'POST' });
  });
});
