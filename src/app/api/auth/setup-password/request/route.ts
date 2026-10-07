import { NextRequest, NextResponse } from 'next/server';
import { requestSetupLink } from '@/lib/iam/provisioning';

// POST /api/auth/setup-password/request - an invited person asks for a fresh
// setup link. Always answers the same, so it does not reveal which addresses exist.
export async function POST(req: NextRequest) {
  const body: unknown = await req.json().catch(() => null);
  const email = body && typeof body === 'object' ? (body as Record<string, unknown>).email : undefined;
  await requestSetupLink(email, req.headers.get('x-forwarded-for')?.split(',')[0]?.trim());
  return NextResponse.json(
    { success: true, message: 'If this address has an open invitation, a new link is on its way.' },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
