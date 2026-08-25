import { NextResponse } from 'next/server';

// Self-service registration remains fail-closed until organization ownership,
// tenant-bound identity activation, idempotency, abuse controls, and mandatory
// audit evidence are designed and validated as one provisioning workflow.
export async function POST() {
  return NextResponse.json(
    {
      error: {
        code: 'RegistrationDisabled',
        message: 'Self-service organization registration is temporarily unavailable',
      },
    },
    {
      status: 503,
      headers: {
        'Cache-Control': 'no-store',
        'Retry-After': '86400',
      },
    },
  );
}
