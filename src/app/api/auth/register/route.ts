import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { randomUUID } from 'node:crypto';
import { cleanupUncontrolledObject, createControlledObjectKey, createServerGeneratedTextUpload, vercelBlobStorage } from '@/lib/controlled-storage';

// POST /api/auth/register - Onboarding API for new Organization & Quality Owner
export async function POST(req: NextRequest) {
  const uploadedKeys: string[] = [];
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

    const tenantId = randomUUID();
    const userId = randomUUID();
    const sop1Id = randomUUID();
    const sop2Id = randomUUID();
    const starterUploads = [
      {
        documentId: sop1Id,
        upload: createServerGeneratedTextUpload('SOP-001 starter record. Replace through the controlled revision process.', 'SOP-001-v1.txt'),
      },
      {
        documentId: sop2Id,
        upload: createServerGeneratedTextUpload('SOP-002 starter record. Replace through the controlled revision process.', 'SOP-002-v1.txt'),
      },
    ];
    for (const item of starterUploads) {
      const key = createControlledObjectKey({ tenantId, documentId: item.documentId, versionNumber: 1 });
      uploadedKeys.push(key);
      await vercelBlobStorage.putObject(key, item.upload.bytes, item.upload.mimeType);
    }

    // Execute onboarding transaction
    const result = await prisma.$transaction(async (tx: any) => {
      // 1. Create Tenant (Organization)
      const tenant = await tx.tenant.create({
        data: {
          id: tenantId,
          name: companyName,
        },
      });

      // 2. Create Owner User
      const user = await tx.user.create({
        data: {
          id: userId,
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
          id: sop1Id,
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
                filePath: uploadedKeys[0],
                storageKey: uploadedKeys[0],
                originalFileName: starterUploads[0].upload.fileName,
                mimeType: starterUploads[0].upload.mimeType,
                sizeBytes: starterUploads[0].upload.bytes.byteLength,
                hash: starterUploads[0].upload.hash,
                createdBy: user.id,
                signatureManifest: {
                  create: {
                    signedAt: new Date(),
                    meaning: 'Approval and Release of SOP-001 Rev 1.0',
                    ipAddress: '127.0.0.1',
                    signedBy: user.id,
                    hashSigned: starterUploads[0].upload.hash,
                  },
                },
              },
            ],
          },
        },
      });

      const sop2 = await tx.document.create({
        data: {
          id: sop2Id,
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
                filePath: uploadedKeys[1],
                storageKey: uploadedKeys[1],
                originalFileName: starterUploads[1].upload.fileName,
                mimeType: starterUploads[1].upload.mimeType,
                sizeBytes: starterUploads[1].upload.bytes.byteLength,
                hash: starterUploads[1].upload.hash,
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

    uploadedKeys.length = 0;
    const response = NextResponse.json({
      success: true,
      tenant: result.tenant,
      user: result.user,
    }, { status: 201 });

    return response;
  } catch (error: any) {
    await Promise.all(uploadedKeys.map((key) => cleanupUncontrolledObject(vercelBlobStorage, key)));
    console.error('POST /api/auth/register error:', error);
    return NextResponse.json({ error: { code: 'InternalServerError', message: error.message } }, { status: 500 });
  }
}
