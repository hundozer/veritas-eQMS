import { IamCredentialActionPurpose } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  buildCredentialActionEmail,
  buildCredentialActionUrl,
  CredentialEmailError,
  sendCredentialActionEmail,
} from './credential-email';

const SETUP = IamCredentialActionPurpose.PASSWORD_SETUP;
const RESET = IamCredentialActionPurpose.PASSWORD_RESET;
const TOKEN = 'synthetic-credential-token';
const RECIPIENT = 'recipient@example.test';

describe('IAM credential email service', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('APP_ORIGIN', 'https://veritas.example.test/');
    vi.stubEnv('RESEND_API_KEY', 'synthetic-resend-key');
    vi.stubEnv('EMAIL_FROM', 'Veritas <security@example.test>');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('EMAIL-T001: builds a setup URL from the configured origin and token only', () => {
    const url = buildCredentialActionUrl(TOKEN, SETUP);

    expect(url.origin).toBe('https://veritas.example.test');
    expect(url.pathname).toBe('/auth/setup-password');
    expect(url.searchParams.get('token')).toBe(TOKEN);
    expect([...url.searchParams.keys()]).toEqual(['token']);
  });

  it('EMAIL-T002: builds the distinct password-reset URL', () => {
    const url = buildCredentialActionUrl(TOKEN, RESET);

    expect(url.pathname).toBe('/auth/reset-password');
    expect(url.searchParams.get('token')).toBe(TOKEN);
  });

  it('EMAIL-T003: has no request-controlled origin input', () => {
    const builder = buildCredentialActionUrl as (...args: unknown[]) => URL;
    const url = builder(TOKEN, SETUP, {
      host: 'attacker.example',
      origin: 'https://attacker.example',
      forwardedHost: 'attacker.example',
    });

    expect(buildCredentialActionUrl).toHaveLength(2);
    expect(url.origin).toBe('https://veritas.example.test');
  });

  it('EMAIL-T004: rejects HTTP origins in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('APP_ORIGIN', 'http://veritas.example.test');

    expect(() => buildCredentialActionUrl(TOKEN, SETUP)).toThrow(CredentialEmailError);
  });

  it('EMAIL-T005: rejects a malformed application origin', () => {
    vi.stubEnv('APP_ORIGIN', 'not-an-absolute-url');

    expect(() => buildCredentialActionUrl(TOKEN, SETUP)).toThrow(CredentialEmailError);
  });

  it.each([
    'https://user:password@veritas.example.test',
    'https://veritas.example.test?destination=unsafe',
    'https://veritas.example.test#unsafe',
  ])('EMAIL-T006: rejects unsafe origin components in %s', unsafeOrigin => {
    vi.stubEnv('APP_ORIGIN', unsafeOrigin);

    expect(() => buildCredentialActionUrl(TOKEN, SETUP)).toThrow(CredentialEmailError);
  });

  it('EMAIL-T007: permits localhost HTTP outside production only', () => {
    vi.stubEnv('APP_ORIGIN', 'http://localhost:3000/');
    expect(buildCredentialActionUrl(TOKEN, SETUP).origin).toBe('http://localhost:3000');

    vi.stubEnv('NODE_ENV', 'production');
    expect(() => buildCredentialActionUrl(TOKEN, SETUP)).toThrow(CredentialEmailError);
  });

  it('EMAIL-T008: builds setup-specific one-time, 30-minute content', () => {
    const url = buildCredentialActionUrl(TOKEN, SETUP);
    const email = buildCredentialActionEmail(url, SETUP);

    expect(email.subject).toBe('Set up your Veritas password');
    expect(email.text).toContain('set up your Veritas password');
    expect(email.text).toContain(url.toString());
    expect(email.text).toContain('30 minutes');
    expect(email.text).toContain('only once');
  });

  it('EMAIL-T009: builds distinct reset-specific content', () => {
    const url = buildCredentialActionUrl(TOKEN, RESET);
    const email = buildCredentialActionEmail(url, RESET);

    expect(email.subject).toBe('Reset your Veritas password');
    expect(email.text).toContain('reset your Veritas password');
    expect(email.text).not.toContain('set up your Veritas password');
    expect(email.text).toContain('ignore it');
  });

  it('EMAIL-T010: makes exactly one minimal Resend request', async () => {
    await sendCredentialActionEmail(RECIPIENT, TOKEN, SETUP);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('https://api.resend.com/emails', expect.objectContaining({
      method: 'POST',
      headers: {
        Authorization: 'Bearer synthetic-resend-key',
        'Content-Type': 'application/json',
      },
    }));
    const request = vi.mocked(fetch).mock.calls[0][1];
    expect(JSON.parse(String(request?.body))).toEqual(expect.objectContaining({
      from: 'Veritas <security@example.test>',
      to: [RECIPIENT],
      subject: 'Set up your Veritas password',
      text: expect.stringContaining('/auth/setup-password?token='),
      html: expect.stringContaining('/auth/setup-password?token='),
    }));
  });

  it('EMAIL-T011: fails closed without a Resend API key', async () => {
    vi.stubEnv('RESEND_API_KEY', '');

    await expect(sendCredentialActionEmail(RECIPIENT, TOKEN, SETUP))
      .rejects.toBeInstanceOf(CredentialEmailError);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('EMAIL-T012: fails closed without a sender', async () => {
    vi.stubEnv('EMAIL_FROM', '');

    await expect(sendCredentialActionEmail(RECIPIENT, TOKEN, SETUP))
      .rejects.toBeInstanceOf(CredentialEmailError);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('EMAIL-T013: sanitizes Resend failures without fallback or token disclosure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: vi.fn().mockResolvedValue({ detail: TOKEN }),
    }));

    const result = sendCredentialActionEmail(RECIPIENT, TOKEN, RESET);
    await expect(result).rejects.toEqual(expect.objectContaining({
      code: 'CREDENTIAL_EMAIL_FAILED',
      message: 'Unable to send credential email',
    }));
    await expect(result).rejects.not.toEqual(expect.objectContaining({ message: expect.stringContaining(TOKEN) }));
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('EMAIL-T014: rejects an unsupported purpose before delivery', async () => {
    await expect(sendCredentialActionEmail(RECIPIENT, TOKEN, 'UNSUPPORTED' as typeof SETUP))
      .rejects.toBeInstanceOf(CredentialEmailError);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('EMAIL-T015: never logs credential delivery material', async () => {
    const spies = [
      vi.spyOn(console, 'log').mockImplementation(() => undefined),
      vi.spyOn(console, 'info').mockImplementation(() => undefined),
      vi.spyOn(console, 'warn').mockImplementation(() => undefined),
      vi.spyOn(console, 'error').mockImplementation(() => undefined),
      vi.spyOn(console, 'debug').mockImplementation(() => undefined),
    ];

    await sendCredentialActionEmail(RECIPIENT, TOKEN, SETUP);
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });

  it('EMAIL-T016: encodes token delimiters without query or path injection', () => {
    const unsafeToken = 'synthetic?next=https://attacker.example/#fragment&role=admin';
    const url = buildCredentialActionUrl(unsafeToken, SETUP);

    expect(url.searchParams.get('token')).toBe(unsafeToken);
    expect([...url.searchParams.keys()]).toEqual(['token']);
    expect(url.pathname).toBe('/auth/setup-password');
  });

  it('EMAIL-T017: token and purpose input cannot redirect away from APP_ORIGIN', () => {
    const redirectToken = 'https://attacker.example/auth/reset-password';
    const setupUrl = buildCredentialActionUrl(redirectToken, SETUP);
    const resetUrl = buildCredentialActionUrl(redirectToken, RESET);

    expect(setupUrl.origin).toBe('https://veritas.example.test');
    expect(resetUrl.origin).toBe('https://veritas.example.test');
    expect(setupUrl.searchParams.get('token')).toBe(redirectToken);
    expect(resetUrl.searchParams.get('token')).toBe(redirectToken);
  });
});
