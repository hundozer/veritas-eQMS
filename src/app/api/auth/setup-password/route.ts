import { NextRequest, NextResponse } from 'next/server';
import { completePasswordSetup, PasswordSetupError } from '@/lib/iam/password-setup';
import { unexpectedErrorResponse } from '../../../../lib/server-errors';

const NO_STORE = { 'Cache-Control': 'no-store' };

// POST /api/auth/setup-password - an invited person sets their first password
export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json().catch(() => null);
    const { token, password } = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
    await completePasswordSetup(token, password, req.headers.get('x-forwarded-for')?.split(',')[0]?.trim());
    return NextResponse.json({ success: true }, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof PasswordSetupError) {
      const failure = error;
      return NextResponse.json(
        { error: { code: failure.failure, message: failure.message } },
        { status: 400, headers: NO_STORE },
      );
    }
    return unexpectedErrorResponse('auth.setupPassword');
  }
}
