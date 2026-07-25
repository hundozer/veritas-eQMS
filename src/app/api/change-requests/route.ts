import { NextRequest, NextResponse } from 'next/server';
import prisma, { TxClient } from '@/lib/db';
import { getContext, logAuditEvent } from '@/lib/auth';

// GET /api/change-requests - List all Change Requests (tenant-scoped)
export async function GET(req: NextRequest) {
  try {
    const user = await getContext(req);
    if (!user) {
      return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    }

    const changeRequests = await prisma.changeRequest.findMany({
      where: {
        documents: {
          some: {
            document: {
              tenantId: user.tenantId
            }
          }
        }
      },
      include: {
        documents: {
          include: {
            document: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Log the read action
    await logAuditEvent({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'ChangeControl.List',
      objectType: 'ChangeRequest',
      payload: { countReturned: changeRequests.length },
      status: 'Success',
      requestUrl: req.nextUrl.pathname,
    });

    return NextResponse.json({ changeRequests });
  } catch (error: any) {
    console.error('List change requests error:', error);
    return NextResponse.json({ error: { code: 'InternalError', message: error.message } }, { status: 500 });
  }
}

// POST /api/change-requests - Create a new Change Request
export async function POST(req: NextRequest) {
  try {
    const user = await getContext(req);
    if (!user) {
      return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    }

    // Only QA Admin, Owner, or Approver can initiate CRs (not Employee/Auditor)
    if (user.role === 'EMPLOYEE' || user.role === 'AUDITOR') {
      return NextResponse.json({ error: { code: 'Forbidden', message: 'Permissions insufficient to initiate Change Requests' } }, { status: 403 });
    }

    const body = await req.json();
    const { title, reason, riskLevel, documentIds } = body;

    if (!title || !reason || !riskLevel || !documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return NextResponse.json({ error: { code: 'ValidationFailed', message: 'Title, reason, riskLevel, and at least one linked document are required' } }, { status: 400 });
    }

    // Verify all documentIds belong to this tenant
    const docs = await prisma.document.findMany({
      where: {
        id: { in: documentIds },
        tenantId: user.tenantId
      }
    });

    if (docs.length !== documentIds.length) {
      return NextResponse.json({ error: { code: 'NotFound', message: 'One or more selected documents were not found in this tenant' } }, { status: 404 });
    }

    // Database transaction to create CR + link documents
    const result = await prisma.$transaction(async (tx: TxClient) => {
      const cr = await tx.changeRequest.create({
        data: {
          title,
          reason,
          riskLevel,
          status: 'UNDER_REVIEW',
        }
      });

      for (const docId of documentIds) {
        await tx.changeRequestDocument.create({
          data: {
            changeRequestId: cr.id,
            documentId: docId
          }
        });
        
        // Optionally update document status to IN_REVIEW when change request is created
        await tx.document.update({
          where: { id: docId },
          data: { status: 'IN_REVIEW' }
        });
      }

      return cr;
    });

    // Log GxP audit log
    await logAuditEvent({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'ChangeControl.Create',
      objectType: 'ChangeRequest',
      objectId: result.id,
      payload: {
        title: result.title,
        riskLevel: result.riskLevel,
        documentCount: documentIds.length,
      },
      status: 'Success',
      requestUrl: req.nextUrl.pathname,
    });

    return NextResponse.json({ changeRequest: result }, { status: 201 });
  } catch (error: any) {
    console.error('Create change request error:', error);
    return NextResponse.json({ error: { code: 'InternalError', message: error.message } }, { status: 500 });
  }
}
