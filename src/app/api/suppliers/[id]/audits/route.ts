import { NextResponse } from 'next/server';

// Supplier-audit decisions remain fail-closed until IAM reauthentication,
// supplier-audit permission, segregation of duties, and atomic signature/audit
// evidence are implemented and validated together.
export async function POST() {
  return NextResponse.json(
    {
      error: {
        code: 'ElectronicSignatureDisabled',
        message: 'Supplier audit signatures are temporarily unavailable',
      },
    },
    {
      status: 503,
      headers: { 'Cache-Control': 'no-store', 'Retry-After': '86400' },
    },
  );
}
