import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { logAuditEvent } from '@/lib/auth';

// GET /api/auth/sso/microsoft/callback - Handle Microsoft OAuth 2.0 Auth Code Callback
export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get('code');
    const error = req.nextUrl.searchParams.get('error');

    if (error || !code) {
      return NextResponse.redirect(`${req.nextUrl.origin}/?sso=demo`);
    }

    const clientId = process.env.AZURE_AD_CLIENT_ID;
    const clientSecret = process.env.AZURE_AD_CLIENT_SECRET;
    const tenantId = process.env.AZURE_AD_TENANT_ID || 'common';
    const redirectUri = process.env.AZURE_AD_REDIRECT_URI || `${req.nextUrl.origin}/api/auth/sso/microsoft/callback`;

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(`${req.nextUrl.origin}/?sso=demo`);
    }

    // Exchange auth code for access token
    const tokenRes = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      return NextResponse.redirect(`${req.nextUrl.origin}/?sso=demo`);
    }

    // Fetch user profile from Microsoft Graph API
    const userRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const msUser = await userRes.json();
    const email = msUser.mail || msUser.userPrincipalName;
    const fullName = msUser.displayName || `${msUser.givenName || ''} ${msUser.surname || ''}`.trim() || 'Microsoft User';

    if (!email) {
      return NextResponse.redirect(`${req.nextUrl.origin}/?sso=demo`);
    }

    // Look up or auto-provision user in tenant
    let user = await prisma.user.findUnique({
      where: { email },
      include: { tenant: true },
    });

    if (!user) {
      const firstTenant = await prisma.tenant.findFirst();
      if (!firstTenant) {
        return NextResponse.redirect(`${req.nextUrl.origin}/?sso=demo`);
      }

      user = await prisma.user.create({
        data: {
          email,
          fullName,
          role: 'EMPLOYEE',
          department: 'QA',
          clearance: 'INTERNAL',
          mfaEnabled: true,
          tenantId: firstTenant.id,
        },
        include: { tenant: true },
      });
    }

    await logAuditEvent({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'Auth.MicrosoftSSO',
      objectType: 'User',
      objectId: user.id,
      payload: { provider: 'Microsoft 365 Azure AD', email: user.email },
      status: 'Success',
      requestUrl: req.nextUrl.pathname,
    });

    const response = NextResponse.redirect(`${req.nextUrl.origin}/?sso=success`);
    response.cookies.set('user-email', user.email, { path: '/', maxAge: 86400 * 30 });

    return response;
  } catch (error: any) {
    console.error('Microsoft SSO callback error:', error);
    return NextResponse.redirect(`${req.nextUrl.origin}/?sso=demo`);
  }
}
