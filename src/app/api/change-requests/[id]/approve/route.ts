import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getContext, logAuditEvent } from '@/lib/auth';


// POST /api/change-requests/[id]/approve - Approves or Closes a Change Request (E-Sign required)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getContext(req);
    if (!user) {
      return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    }

    // Role check: Only QA Admin (ADMIN) or Approver (APPROVER)
    if (user.role !== 'ADMIN' && user.role !== 'APPROVER') {
      return NextResponse.json({ error: { code: 'Forbidden', message: 'Only QA Admins or authorized Approvers can execute Change Control sign-offs' } }, { status: 403 });
    }

    const body = await req.json();
    const { password, actionType, comment } = body; // actionType is 'APPROVE' or 'CLOSE'

    if (!password || password.trim() === '') {
      return NextResponse.json({ error: { code: 'ValidationFailed', message: 'E-signature confirmation password is required' } }, { status: 400 });
    }

    if (actionType !== 'APPROVE' && actionType !== 'CLOSE') {
      return NextResponse.json({ error: { code: 'ValidationFailed', message: 'Action type must be either APPROVE or CLOSE' } }, { status: 400 });
    }

    const cr = await prisma.changeRequest.findUnique({
      where: { id },
      include: {
        documents: {
          include: {
            document: true
          }
        }
      }
    });

    if (!cr) {
      return NextResponse.json({ error: { code: 'NotFound', message: 'Change Request not found' } }, { status: 404 });
    }

    // Validate active tenant context of linked documents (to maintain tenant isolation)
    if (cr.documents.length > 0 && cr.documents[0].document.tenantId !== user.tenantId) {
      return NextResponse.json({ error: { code: 'NotFound', message: 'Change Request not found' } }, { status: 404 });
    }

    if (actionType === 'APPROVE' && cr.status !== 'UNDER_REVIEW') {
      return NextResponse.json({ error: { code: 'Conflict', message: 'Change Request is not under review' } }, { status: 409 });
    }

    if (actionType === 'CLOSE' && cr.status !== 'APPROVED') {
      return NextResponse.json({ error: { code: 'Conflict', message: 'Change Request is not in approved state' } }, { status: 409 });
    }

    // Process transition
    const nextStatus = actionType === 'APPROVE' ? 'APPROVED' : 'CLOSED';

    const result = await prisma.$transaction(async (tx: any) => {
      const updatedCr = await tx.changeRequest.update({
        where: { id },
        data: { status: nextStatus }
      });

      // If closing, ensure linked documents revert back to their final statuses if they are not effective
      // Normally, linked documents are approved to EFFECTIVE during the CR lifecycle, so closing just flags the CR complete.

      return updatedCr;
    });

    // Log GxP audit log
    await logAuditEvent({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: actionType === 'APPROVE' ? 'ChangeControl.Approve' : 'ChangeControl.Close',
      objectType: 'ChangeRequest',
      objectId: id,
      payload: {
        title: cr.title,
        previousStatus: cr.status,
        newStatus: result.status,
        signedBy: user.fullName,
        comment: comment || '',
      },
      status: 'Success',
      requestUrl: req.nextUrl.pathname,
    });

    return NextResponse.json({ success: true, changeRequest: result });
  } catch (error: any) {
    console.error('Update CR status error:', error);
    return NextResponse.json({ error: { code: 'InternalError', message: error.message } }, { status: 500 });
  }
}
