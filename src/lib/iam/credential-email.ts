import 'server-only';

import { IamCredentialActionPurpose } from '@prisma/client';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

const ACTION_PATHS: Record<IamCredentialActionPurpose, string> = {
  [IamCredentialActionPurpose.PASSWORD_SETUP]: '/auth/setup-password',
  [IamCredentialActionPurpose.PASSWORD_RESET]: '/auth/reset-password',
};

export class CredentialEmailError extends Error {
  readonly code = 'CREDENTIAL_EMAIL_FAILED';

  constructor() {
    super('Unable to send credential email');
    this.name = 'CredentialEmailError';
  }
}

export type CredentialActionEmail = {
  subject: string;
  text: string;
  html: string;
};

function getActionPath(purpose: IamCredentialActionPurpose): string {
  const path = ACTION_PATHS[purpose];
  if (!path) throw new CredentialEmailError();
  return path;
}

function getApplicationOrigin(): URL {
  const configuredOrigin = process.env.APP_ORIGIN;
  if (!configuredOrigin) throw new CredentialEmailError();

  let origin: URL;
  try {
    origin = new URL(configuredOrigin);
  } catch {
    throw new CredentialEmailError();
  }

  const isLocalhost = origin.hostname === 'localhost' || origin.hostname === '127.0.0.1';
  const isPermittedDevelopmentHttp = process.env.NODE_ENV !== 'production' && isLocalhost;

  if (
    (origin.protocol !== 'https:' && !isPermittedDevelopmentHttp) ||
    origin.username ||
    origin.password ||
    origin.search ||
    origin.hash ||
    (origin.pathname !== '/' && origin.pathname !== '')
  ) {
    throw new CredentialEmailError();
  }

  origin.pathname = '/';
  return origin;
}

export function buildCredentialActionUrl(
  token: string,
  purpose: IamCredentialActionPurpose,
): URL {
  if (!token) throw new CredentialEmailError();

  const url = new URL(getActionPath(purpose), getApplicationOrigin());
  url.searchParams.set('token', token);
  return url;
}

export function buildCredentialActionEmail(
  actionUrl: URL,
  purpose: IamCredentialActionPurpose,
): CredentialActionEmail {
  const actionPath = getActionPath(purpose);
  if (actionUrl.protocol !== 'https:' && actionUrl.protocol !== 'http:') {
    throw new CredentialEmailError();
  }

  const isSetup = actionPath === ACTION_PATHS[IamCredentialActionPurpose.PASSWORD_SETUP];
  const subject = isSetup ? 'Set up your Veritas password' : 'Reset your Veritas password';
  const action = isSetup ? 'set up your Veritas password' : 'reset your Veritas password';
  const link = actionUrl.toString();
  const text = [
    `Use the link below to ${action}:`,
    '',
    link,
    '',
    'This link expires in 30 minutes and can be used only once.',
    'If you did not expect this message, you can ignore it.',
  ].join('\n');
  const html = [
    `<p>Use the link below to ${action}:</p>`,
    `<p><a href="${link}">${isSetup ? 'Set up password' : 'Reset password'}</a></p>`,
    '<p>This link expires in 30 minutes and can be used only once.</p>',
    '<p>If you did not expect this message, you can ignore it.</p>',
  ].join('');

  return { subject, text, html };
}

export async function sendCredentialActionEmail(
  recipient: string,
  token: string,
  purpose: IamCredentialActionPurpose,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from || !recipient) throw new CredentialEmailError();

  const actionUrl = buildCredentialActionUrl(token, purpose);
  const email = buildCredentialActionEmail(actionUrl, purpose);

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [recipient],
        subject: email.subject,
        text: email.text,
        html: email.html,
      }),
    });

    if (!response.ok) throw new CredentialEmailError();
  } catch {
    throw new CredentialEmailError();
  }
}
