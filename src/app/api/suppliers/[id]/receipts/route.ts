import { NextResponse } from 'next/server';

// Material receipt and auto-deviation mutations remain fail-closed until an
// explicit membership permission and mandatory atomic audit are available.
export async function POST() {
  return NextResponse.json(
    { error: { code: 'SupplierMutationDisabled', message: 'Material receipt recording is temporarily unavailable' } },
    { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '86400' } },
  );
}
