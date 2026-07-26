import { NextRequest, NextResponse } from 'next/server';

// GET /api/auth/sso/microsoft - Initiate Microsoft 365 Azure AD / Entra ID OAuth SSO Flow
export async function GET(req: NextRequest) {
  const clientId = process.env.AZURE_AD_CLIENT_ID;
  const tenantId = process.env.AZURE_AD_TENANT_ID || 'common';
  const redirectUri = process.env.AZURE_AD_REDIRECT_URI || `${req.nextUrl.origin}/api/auth/sso/microsoft/callback`;

  // If Azure AD Client ID is not configured in environment, render a clean HTML workspace entry page
  if (!clientId) {
    const htmlResponse = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <title>Microsoft 365 SSO — Simpleafied Veritas</title>
        <style>
          body {
            background-color: #FBFBFA;
            color: #0A0E17;
            font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            padding: 24px;
          }
          .card {
            background: #FFFFFF;
            border: 1px solid rgba(10, 14, 23, 0.15);
            max-width: 520px;
            padding: 40px;
            text-align: left;
          }
          .badge {
            font-family: monospace;
            font-size: 11px;
            color: #047857;
            font-weight: 700;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            margin-bottom: 12px;
          }
          h1 {
            font-size: 24px;
            font-weight: 800;
            margin: 0 0 16px;
            letter-spacing: -0.02em;
          }
          p {
            font-size: 14px;
            color: #475569;
            line-height: 1.6;
            margin-bottom: 24px;
          }
          .btn {
            display: inline-block;
            background: #0A0E17;
            color: #FBFBFA;
            padding: 14px 28px;
            font-weight: 700;
            font-size: 13px;
            text-decoration: none;
            font-family: monospace;
          }
          .note {
            font-family: monospace;
            font-size: 11px;
            color: #64748B;
            margin-top: 20px;
            border-top: 1px solid rgba(10, 14, 23, 0.08);
            padding-top: 16px;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="badge">● ENTERPRISE SSO READY</div>
          <h1>Microsoft 365 Azure AD SSO</h1>
          <p>
            Microsoft Entra ID single sign-on requires setting <code>AZURE_AD_CLIENT_ID</code> and <code>AZURE_AD_CLIENT_SECRET</code> in Vercel environment settings.
          </p>
          <a href="/?sso=demo" class="btn">⚡ ENTER VERITAS WORKSPACE DIRECTLY →</a>
          <div class="note">
            Simpleafied Veritas • 21 CFR Part 11 / EU Annex 11 Compliance Infrastructure
          </div>
        </div>
      </body>
      </html>
    `;
    return new NextResponse(htmlResponse, {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    });
  }

  const scope = encodeURIComponent('openid profile email User.Read');
  const authUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&response_mode=query&scope=${scope}&state=veritas_sso_state`;

  return NextResponse.redirect(authUrl);
}
