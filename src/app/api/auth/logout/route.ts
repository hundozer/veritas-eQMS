import { NextRequest, NextResponse } from 'next/server';
import { revokeIamSession } from '@/lib/iam/session';

const SESSION_COOKIE_NAME = 'iam-access-token';

export async function POST(req: NextRequest) {
  const sessionToken = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (sessionToken) await revokeIamSession(sessionToken);

  const response = NextResponse.json(
    { success: true },
    { headers: { 'Cache-Control': 'no-store' } },
  );
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: new Date(0),
    maxAge: 0,
  });
  response.cookies.delete('user-email');
  return response;
}
