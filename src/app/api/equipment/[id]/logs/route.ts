import { NextResponse } from 'next/server';

// Maintenance and calibration entries remain fail-closed until the current IAM
// identity can be reauthenticated and the signature, meaning, record mutation,
// and mandatory audit evidence can be committed as one validated operation.
export async function POST() {
  return NextResponse.json(
    {
      error: {
        code: 'ElectronicSignatureDisabled',
        message: 'Equipment maintenance signatures are temporarily unavailable',
      },
    },
    {
      status: 503,
      headers: { 'Cache-Control': 'no-store', 'Retry-After': '86400' },
    },
  );
}
