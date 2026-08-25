import { NextResponse } from 'next/server';

const DISABLED_RESPONSE = {
  error: {
    code: 'ProvisioningDisabled',
    message: 'Enterprise workspace provisioning is temporarily unavailable',
  },
} as const;

/**
 * Enterprise provisioning is intentionally fail-closed while tenant-bound IAM,
 * verified ownership, idempotency, abuse controls, and mandatory audit evidence
 * are rebuilt and validated.
 */
export async function POST() {
  return NextResponse.json(DISABLED_RESPONSE, {
    status: 503,
    headers: {
      'Cache-Control': 'no-store',
      'Retry-After': '86400',
    },
  });
}
