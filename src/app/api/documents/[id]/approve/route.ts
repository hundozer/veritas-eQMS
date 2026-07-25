import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getContext, logAuditEvent } from '@/lib/auth';



// POST /api/documents/[id]/approve - Approves and signs a document, triggering training assignments on release
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getContext(req);
    if (!user) {
      return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    }

    // Check permissions - OWNER, ADMIN, or APPROVER
    if (user.role !== 'OWNER' && user.role !== 'ADMIN' && user.role !== 'APPROVER') {
      return NextResponse.json({ error: { code: 'Forbidden', message: 'Only authorized Approvers, System Owners, or QA Admins can execute approvals' } }, { status: 403 });
    }

    const body = await req.json();
    const { password, meaning, comment } = body;

    // Simulate 2-Factor Authentication (confirm password)
    // For local mock verification, any non-empty password is fine, but in GxP it validates credentials.
    if (!password || password.trim() === '') {
      return NextResponse.json({ error: { code: 'ValidationFailed', message: 'E-signature requires password verification' } }, { status: 400 });
    }

    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
        },
        trainingRequirement: true,
      },
    });

    if (!document || document.tenantId !== user.tenantId) {
      return NextResponse.json({ error: { code: 'NotFound', message: 'Document not found' } }, { status: 404 });
    }

    if (document.status !== 'DRAFT' && document.status !== 'IN_REVIEW') {
      return NextResponse.json({ error: { code: 'Conflict', message: 'Document is not in a state that can be approved' } }, { status: 409 });
    }

    const latestVersion = document.versions[0];
    if (!latestVersion) {
      return NextResponse.json({ error: { code: 'Conflict', message: 'Document has no files uploaded to approve' } }, { status: 409 });
    }

    // Execute approval workflow transaction
    const result = await prisma.$transaction(async (tx: any) => {
      // 1. Update Document Status to EFFECTIVE (making it active in the system)
      const updatedDoc = await tx.document.update({
        where: { id },
        data: { status: 'EFFECTIVE' },
      });

      // 2. Create E-Signature Manifest (21 CFR Part 11 record)
      const manifest = await tx.signatureManifest.create({
        data: {
          documentVersionId: latestVersion.id,
          signedBy: user.id,
          meaning: meaning || 'Approval of Document Release',
          hashSigned: `${latestVersion.hash}-${user.fullName.toUpperCase()}-APPROVED`,
          ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
        },
      });

      // 3. Auto-Trigger Training Assignments if requirements exist
      let assignmentsCreated = 0;
      if (document.trainingRequirement) {
        const requiredRoles = document.trainingRequirement.requiredForRoles.split(',');

        // Find all users in the tenant who match these roles/departments
        const targetUsers = await tx.user.findMany({
          where: {
            tenantId: user.tenantId,
            OR: [
              { role: { in: requiredRoles } },
              { department: { in: requiredRoles } },
            ],
            // Exclude user who just approved it if they are also the author (authors are usually self-trained or assigned separately, but let's assign them anyway. Let's not exclude unless requested.)
          },
        });

        for (const targetUser of targetUsers) {
          // Check if assignment already exists for this requirement and user
          const existing = await tx.trainingAssignment.findFirst({
            where: {
              requirementId: document.trainingRequirement.id,
              userId: targetUser.id,
            },
          });

          if (!existing) {
            await tx.trainingAssignment.create({
              data: {
                requirementId: document.trainingRequirement.id,
                userId: targetUser.id,
                status: 'ASSIGNED',
              },
            });
            assignmentsCreated++;
          }
        }
      }

      return { updatedDoc, manifest, assignmentsCreated };
    });

    // 4. Log the GxP audit event
    await logAuditEvent({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'Document.Approve',
      objectType: 'Document',
      objectId: id,
      payload: {
        title: result.updatedDoc.title,
        version: latestVersion.versionNumber,
        signedBy: user.fullName,
        meaning: result.manifest.meaning,
        ipAddress: result.manifest.ipAddress,
        trainingAssignmentsCreated: result.assignmentsCreated,
      },
      status: 'Success',
      requestUrl: req.nextUrl.pathname,
    });

    return NextResponse.json({
      success: true,
      document: result.updatedDoc,
      signature: result.manifest,
      trainingAssignmentsCreated: result.assignmentsCreated,
    });
  } catch (error: any) {
    console.error('Approve document error:', error);
    return NextResponse.json({ error: { code: 'InternalError', message: error.message } }, { status: 500 });
  }
}
