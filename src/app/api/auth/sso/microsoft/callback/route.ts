import { NextResponse } from 'next/server';

const DISABLED_RESPONSE = {
  error: {
    code: 'SsoDisabled',
    message: 'Microsoft single sign-on is temporarily unavailable',
  },
} as const;

/**
 * The callback intentionally performs no code exchange, profile lookup,
 * tenant selection, user provisioning, or session creation while SSO is under
 * recovery.
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
