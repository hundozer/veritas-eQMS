import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

// POST /api/auth/register - Onboarding API for new Organization & Quality Owner
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { companyName, fullName, email, department, role, GxPStandard } = body;

    if (!companyName || !fullName || !email) {
      return NextResponse.json({ error: { code: 'ValidationFailed', message: 'Company Name, Full Name, and Work Email are required' } }, { status: 400 });
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ error: { code: 'AlreadyExists', message: 'An account with this email address already exists.' } }, { status: 400 });
    }

    // Execute onboarding transaction
    const result = await prisma.$transaction(async (tx: any) => {
      // 1. Create Tenant (Organization)
      const tenant = await tx.tenant.create({
        data: {
          name: companyName,
        },
      });

      // 2. Create Owner User
      const user = await tx.user.create({
        data: {
          email,
          fullName,
          role: role || 'OWNER',
          department: department || 'QA',
          clearance: 'RESTRICTED',
          tenantId: tenant.id,
        },
      });

      // 3. Auto-seed Default GxP Starter SOPs for the new organization
      const sop1 = await tx.document.create({
        data: {
          tenantId: tenant.id,
          title: 'SOP-001: Document Control Standard Operating Procedure',
          description: `Standard operating procedure governing creation, review, approval, release, and archiving of controlled GxP documents compliant with ${GxPStandard || '21 CFR Part 11 & ISO 13485'}.`,
          classification: 'CONTROLLED',
          status: 'EFFECTIVE',
          ownerId: user.id,
          versions: {
            create: [
              {
                versionNumber: 1,
                filePath: '/docs/SOP-001-v1.pdf',
                hash: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
                createdBy: user.id,
                signatureManifest: {
                  create: {
                    signedAt: new Date(),
                    meaning: 'Approval and Release of SOP-001 Rev 1.0',
                    ipAddress: '127.0.0.1',
                    signerId: user.id,
                  },
                },
              },
            ],
          },
        },
      });

      const sop2 = await tx.document.create({
        data: {
          tenantId: tenant.id,
          title: 'SOP-002: Quality Event & CAPA Management SOP',
          description: 'Defines procedure for logging non-conformances, conducting root cause investigations, and implementing corrective/preventive actions.',
          classification: 'CONTROLLED',
          status: 'EFFECTIVE',
          ownerId: user.id,
          versions: {
            create: [
              {
                versionNumber: 1,
                filePath: '/docs/SOP-002-v1.pdf',
                hash: 'b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef01',
                createdBy: user.id,
              },
            ],
          },
        },
      });

      // 4. Create Initial Audit Log
      await tx.auditLog.create({
        data: {
          tenantId: tenant.id,
          eventId: `EVT-INIT-${Date.now()}`,
          userId: user.id,
          userEmail: user.email,
          userRole: user.role,
          action: 'Tenant.Onboarded',
          objectType: 'Tenant',
          objectId: tenant.id,
          payload: JSON.stringify({ companyName, ownerEmail: email, GxPStandard: GxPStandard || '21 CFR Part 11' }),
          status: 'Success',
          requestUrl: req.nextUrl.pathname,
        },
      });

      return { tenant, user, sop1, sop2 };
    });

    const response = NextResponse.json({
      success: true,
      tenant: result.tenant,
      user: result.user,
    }, { status: 201 });

    // Set sticky user cookie
    response.cookies.set('user-email', result.user.email, { path: '/', maxAge: 86400 * 30 });

    return response;
  } catch (error: any) {
    console.error('POST /api/auth/register error:', error);
    return NextResponse.json({ error: { code: 'InternalServerError', message: error.message } }, { status: 500 });
  }
}
