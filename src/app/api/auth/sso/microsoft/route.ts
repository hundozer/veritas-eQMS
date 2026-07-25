import { NextRequest, NextResponse } from 'next/server';

// GET /api/auth/sso/microsoft - Initiate Microsoft 365 Azure AD / Entra ID OAuth SSO Flow
export async function GET(req: NextRequest) {
  const clientId = process.env.AZURE_AD_CLIENT_ID;
  const tenantId = process.env.AZURE_AD_TENANT_ID || 'common';
  const redirectUri = process.env.AZURE_AD_REDIRECT_URI || `${req.nextUrl.origin}/api/auth/sso/microsoft/callback`;

  if (!clientId) {
    return NextResponse.json({
      status: 'SSO_CONFIGURATION_REQUIRED',
      message: 'Microsoft 365 / Azure Entra ID SSO requires App Registration in Microsoft Azure Portal.',
      setupInstructions: {
        step1: 'Go to Microsoft Azure Portal (https://portal.azure.com) -> Azure Active Directory -> App Registrations.',
        step2: 'Click "New Registration", name it "Veritas eQMS", and set Redirect URI to: ' + redirectUri,
        step3: 'Add environment variables to your .env.local file:',
        envVariables: [
          'AZURE_AD_CLIENT_ID="your-azure-app-client-id"',
          'AZURE_AD_CLIENT_SECRET="your-azure-app-client-secret"',
          'AZURE_AD_TENANT_ID="your-azure-tenant-id-or-common"',
          'AZURE_AD_REDIRECT_URI="' + redirectUri + '"',
        ],
      },
    }, { status: 400 });
  }

  const scope = encodeURIComponent('openid profile email User.Read');
  const authUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&response_mode=query&scope=${scope}&state=veritas_sso_state`;

  return NextResponse.redirect(authUrl);
}
