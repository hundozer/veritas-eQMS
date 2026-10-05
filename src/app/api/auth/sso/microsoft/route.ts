import { NextResponse } from 'next/server';

const DISABLED_RESPONSE = {
  error: {
    code: 'SsoDisabled',
    message: 'Microsoft single sign-on is temporarily unavailable',
  },
} as const;

/**
 * Microsoft SSO remains fail-closed until organization-bound configuration,
 * state/nonce validation, explicit membership, and IAM session issuance have
 * been implemented and validated.
 */
export async function GET() {
  return NextResponse.json(DISABLED_RESPONSE, {
    status: 503,
    headers: {
      'Cache-Control': 'no-store',
      'Retry-After': '86400',
    },
  });
}
