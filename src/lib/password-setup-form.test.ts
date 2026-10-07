import { describe, expect, it, vi } from 'vitest';
import { passwordSetupProblem, requestNewSetupLink, submitPasswordSetup } from './password-setup-form';

describe('password setup page', () => {
  it('PWSETUP-UI-T001 asks for a long enough, confirmed password before sending', () => {
    expect(passwordSetupProblem('short', 'short')).toMatch(/12 characters/);
    expect(passwordSetupProblem('long-enough-pass', 'different-pass!')).toMatch(/do not match/);
    expect(passwordSetupProblem('long-enough-pass', 'long-enough-pass')).toBeNull();
  });

  it('PWSETUP-UI-T002 sends the token and password and reports the server answer', async () => {
    const send = vi.fn()
      .mockResolvedValueOnce(new Response('{"success":true}', { status: 200 }))
      .mockResolvedValueOnce(Response.json({ error: { message: 'This link is invalid, already used or expired; ask for a new invitation' } }, { status: 400 }));

    await expect(submitPasswordSetup('tok', 'long-enough-pass', send)).resolves.toEqual({ ok: true });
    expect(send).toHaveBeenCalledWith('/api/auth/setup-password', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ token: 'tok', password: 'long-enough-pass' }),
    }));
    await expect(submitPasswordSetup('tok', 'long-enough-pass', send)).resolves.toEqual({ ok: false, message: expect.stringMatching(/invalid/) });
  });

  it('PWSETUP-UI-T003 asks for a new link by normalised email and shows the neutral answer', async () => {
    const send = vi.fn().mockResolvedValue(Response.json({ success: true, message: 'If this address has an open invitation, a new link is on its way.' }));

    await expect(requestNewSetupLink(' Rita@Example.Invalid ', send)).resolves.toMatch(/open invitation/);
    expect(send).toHaveBeenCalledWith('/api/auth/setup-password/request', expect.objectContaining({ body: JSON.stringify({ email: 'rita@example.invalid' }) }));
  });
});
