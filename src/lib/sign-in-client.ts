// Browser side of the two sign-in steps (DEC-080): the password, then the
// authenticator code. Kept outside the page so it can be tested without a browser.

export type SignInChallenge =
  | { mfa: 'VERIFY' }
  | { mfa: 'ENROLL'; setupKey: string; otpauthUri: string; qrSvg: string };

export type SignInStep =
  | { kind: 'code'; challenge: SignInChallenge }
  | { kind: 'done' }
  | { kind: 'error'; message: string; restart: boolean };

const json = (body: unknown) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

async function errorOf(response: Response, fallback: string, restart: (code?: string) => boolean): Promise<SignInStep> {
  const data = await response.json().catch(() => null) as { error?: { code?: string; message?: string } } | null;
  return { kind: 'error', message: data?.error?.message || fallback, restart: restart(data?.error?.code) };
}

export async function submitPassword(email: string, password: string, fetchFn: typeof fetch = (...args) => fetch(...args)): Promise<SignInStep> {
  try {
    const response = await fetchFn('/api/auth/login', json({ email, password }));
    if (!response.ok) return errorOf(response, 'Sign-in failed', () => true);
    const challenge = await response.json() as SignInChallenge;
    return challenge.mfa === 'VERIFY' || challenge.mfa === 'ENROLL'
      ? { kind: 'code', challenge }
      : { kind: 'error', message: 'Sign-in failed', restart: true };
  } catch {
    return { kind: 'error', message: 'Sign-in failed; check your connection and try again', restart: true };
  }
}

export async function submitCode(code: string, fetchFn: typeof fetch = (...args) => fetch(...args)): Promise<SignInStep> {
  try {
    const response = await fetchFn('/api/auth/mfa', json({ code: code.replace(/\s/g, '') }));
    if (response.ok) return { kind: 'done' };
    // A wrong code may be retried; an expired or refused sign-in starts again.
    return errorOf(response, 'The code was not accepted', (code) => code !== 'CodeMismatch');
  } catch {
    return { kind: 'error', message: 'Sign-in failed; check your connection and try again', restart: false };
  }
}
