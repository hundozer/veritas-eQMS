import { describe, expect, it, vi } from 'vitest';
import { submitCode, submitPassword } from './sign-in-client';

const reply = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

describe('sign-in steps in the browser', () => {
  it('SIGNIN-T001 a correct password leads to the code step, with setup details on first sign-in', async () => {
    const enroll = { mfa: 'ENROLL', setupKey: 'ABC', otpauthUri: 'otpauth://totp/x', qrSvg: '<svg/>' };
    const fetchFn = reply(200, enroll);
    expect(await submitPassword('a@b', 'pw', fetchFn as never)).toEqual({ kind: 'code', challenge: enroll });
    expect(fetchFn).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({ method: 'POST', body: JSON.stringify({ email: 'a@b', password: 'pw' }) }));
    expect(await submitPassword('a@b', 'pw', reply(200, { mfa: 'VERIFY' }) as never)).toEqual({ kind: 'code', challenge: { mfa: 'VERIFY' } });
  });

  it('SIGNIN-T002 password refusals show the server\'s message and start again', async () => {
    expect(await submitPassword('a@b', 'pw', reply(429, { error: { message: 'Too many failed sign-ins; try again in 15 minutes' } }) as never))
      .toEqual({ kind: 'error', message: 'Too many failed sign-ins; try again in 15 minutes', restart: true });
    expect(await submitPassword('a@b', 'pw', vi.fn(async () => { throw new Error('offline'); }) as never)).toMatchObject({ kind: 'error', restart: true });
  });

  it('SIGNIN-T003 the code is sent without spaces; a wrong code may be retried, an expired sign-in starts again', async () => {
    const ok = reply(200, { user: {} });
    expect(await submitCode('123 456', ok as never)).toEqual({ kind: 'done' });
    expect(ok).toHaveBeenCalledWith('/api/auth/mfa', expect.objectContaining({ body: JSON.stringify({ code: '123456' }) }));
    expect(await submitCode('000000', reply(401, { error: { code: 'CodeMismatch', message: 'The code did not match' } }) as never))
      .toEqual({ kind: 'error', message: 'The code did not match', restart: false });
    expect(await submitCode('000000', reply(401, { error: { code: 'SignInExpired', message: 'Your sign-in expired' } }) as never))
      .toEqual({ kind: 'error', message: 'Your sign-in expired', restart: true });
    expect(await submitCode('000000', reply(429, { error: { code: 'TooManyAttempts', message: 'Too many wrong codes' } }) as never))
      .toMatchObject({ restart: true });
  });
});
