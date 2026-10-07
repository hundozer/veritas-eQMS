// Client-side checks and request for the password-setup page. The server
// enforces the same rules; these only give the person an early answer.
export const MIN_PASSWORD_LENGTH = 12;

export function passwordSetupProblem(password: string, confirmation: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (password !== confirmation) return 'The two passwords do not match.';
  return null;
}

export async function submitPasswordSetup(
  token: string,
  password: string,
  send: typeof fetch = fetch,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const response = await send('/api/auth/setup-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }),
  });
  if (response.ok) return { ok: true };
  const data = await response.json().catch(() => null);
  return { ok: false, message: data?.error?.message ?? 'Your password could not be set.' };
}

export async function requestNewSetupLink(email: string, send: typeof fetch = fetch): Promise<string> {
  const response = await send('/api/auth/setup-password/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  });
  const data = await response.json().catch(() => null);
  return data?.message ?? 'If this address has an open invitation, a new link is on its way.';
}
