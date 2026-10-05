import { NextResponse } from 'next/server';

// Public lead capture remains fail-closed until an approved privacy notice,
// retention policy, abuse controls, and one explicitly configured processor
// are implemented and verified together.
export async function POST() {
  return NextResponse.json(
    {
      error: {
        code: 'DemoRequestDisabled',
        message: 'Online demonstration requests are temporarily unavailable',
      },
    },
    {
      status: 503,
      headers: { 'Cache-Control': 'no-store', 'Retry-After': '86400' },
    },
  );
}
