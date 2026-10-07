import { NextRequest, NextResponse } from 'next/server';
import { tenantRead, tenantTransaction } from '@/lib/tenant-db';
import { getContext, logAuditEvent } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { writeMandatoryAudit } from '@/lib/audit';
import { unexpectedErrorResponse } from '../../../../lib/server-errors';
import {
  cleanupUncontrolledObject,
  createControlledObjectKey,
  decodeControlledUpload,
  vercelBlobStorage,
} from '@/lib/controlled-storage';
import { assertTransition, lifecycleErrorResponse } from '@/lib/document-lifecycle';
import { clientIp, recordSignature, SignatureError, signatureFailedResponse, verifySignerOrRecordFailure } from '@/lib/signatures';

// GET /api/documents/[id] - Get document details + version history + training configs
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getContext(req);
    if (!user) {
      return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    }
    if (!hasPermission(user, 'documents.read')) {
      return NextResponse.json({ error: { code: 'Forbidden', message: 'Insufficient permission' } }, { status: 403 });
    }

    const document = await tenantRead(user.tenantId, (tx) => tx.document.findFirst({
      where: { id, tenantId: user.tenantId },
      select: {
        id: true,
        documentNumber: true,
        documentType: true,
        title: true,
        description: true,
        classification: true,
        status: true,
        ownerId: true,
        currentVersionNumber: true,
        createdAt: true,
        updatedAt: true,
        owner: { select: { id: true, fullName: true } },
        versions: {
          orderBy: { versionNumber: 'desc' },
          select: {
            id: true,
            versionNumber: true,
            status: true,
            effectiveDate: true,
            changeSummary: true,
            hash: true,
            originalFileName: true,
            mimeType: true,
            sizeBytes: true,
            createdAt: true,
            createdBy: true,
            authoredById: true,
            approvalRoutes: {
              orderBy: { createdAt: 'desc' },
              select: {
                id: true,
                status: true,
                steps: {
                  orderBy: { sequence: 'asc' },
                  select: {
                    id: true,
                    stepType: true,
                    status: true,
                    approver: { select: { id: true, fullName: true } },
                  },
                },
              },
            },
          }
        },
        trainingRequirement: {
          select: { id: true, requiredForRoles: true, requiresQuiz: true },
        },
      },
    }));

    if (!document) {
      return NextResponse.json({ error: { code: 'NotFound', message: 'Document not found' } }, { status: 404 });
    }

    // Log the read action asynchronously
    await logAuditEvent({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      userRole: user.membershipRole,
      action: 'Document.View',
      objectType: 'Document',
      objectId: id,
      payload: { title: document.title, version: document.currentVersionNumber },
      status: 'Success',
      requestUrl: req.nextUrl.pathname,
    });

    return NextResponse.json(
      { document },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error: any) {
    return unexpectedErrorResponse('document.get');
  }
}

// PUT /api/documents/[id] - Replace content or metadata of the current DRAFT version only
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let uploadedKey: string | null = null;
  try {
    const { id } = await params;
    const user = await getContext(req);
    if (!user) {
      return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    }
    if (!hasPermission(user, 'documents.update_draft')) {
      return NextResponse.json({ error: { code: 'Forbidden', message: 'Insufficient permission' } }, { status: 403 });
    }

    const document = await tenantRead(user.tenantId, (tx) => tx.document.findFirst({
      where: { id, tenantId: user.tenantId },
      include: { versions: { orderBy: { versionNumber: 'desc' } } },
    }));

    if (!document) {
      return NextResponse.json({ error: { code: 'NotFound', message: 'Document not found' } }, { status: 404 });
    }

    const body = await req.json();
    const { title, description, classification, contentBase64, fileName, mimeType, requiredRoles, requiresQuiz, quizQuestions } = body;

    const currentVersion = document.versions.find((version) => version.versionNumber === document.currentVersionNumber);
    if (!currentVersion || document.status !== 'DRAFT' || currentVersion.status !== 'DRAFT') {
      return NextResponse.json({ error: { code: 'InvalidTransition', message: 'Only the current draft version may be edited' } }, { status: 409 });
    }

    // 1. Process new version upload if contentBase64 is provided
    let upload: ReturnType<typeof decodeControlledUpload> | null = null;

    if (contentBase64) {
      try {
        upload = decodeControlledUpload({ contentBase64, fileName, mimeType });
      } catch (error) {
        return NextResponse.json({ error: { code: 'ValidationFailed', message: (error as Error).message } }, { status: 400 });
      }
      uploadedKey = createControlledObjectKey({ tenantId: user.tenantId, documentId: id, versionNumber: currentVersion.versionNumber });
      await vercelBlobStorage.putObject(uploadedKey, upload.bytes, upload.mimeType);
    }

    // 2. Transactionally save everything (metadata update, new version entry, update training)
    const updatedDoc = await tenantTransaction(user.tenantId, async (tx) => {
      // Update basic fields
      const documentUpdate = await tx.document.updateMany({
        where: { id, tenantId: user.tenantId, status: 'DRAFT', currentVersionNumber: currentVersion.versionNumber },
        data: {
          title: title || document.title,
          description: description !== undefined ? description : document.description,
          classification: classification || document.classification,
        },
      });
      if (documentUpdate.count !== 1) throw new Error('STALE_DRAFT');

      // A draft replacement gets a fresh immutable object key while retaining the
      // same draft version identity. Reviewed/historical versions never reach here.
      if (upload && uploadedKey) {
        const replaced = await tx.documentVersion.updateMany({
          where: { id: currentVersion.id, status: 'DRAFT' },
          data: {
            filePath: uploadedKey,
            fileData: null,
            storageKey: uploadedKey,
            originalFileName: upload.fileName,
            mimeType: upload.mimeType,
            sizeBytes: upload.bytes.byteLength,
            hash: upload.hash,
          },
        });
        if (replaced.count !== 1) throw new Error('STALE_DRAFT');
      }

      // Update training requirements
      if (requiredRoles !== undefined) {
        await tx.trainingRequirement.upsert({
          where: { documentId: id },
          update: {
            requiredForRoles: requiredRoles,
            requiresQuiz: requiresQuiz === true,
            quizQuestions: quizQuestions ? JSON.stringify(quizQuestions) : null,
          },
          create: {
            documentId: id,
            tenantId: user.tenantId,
            requiredForRoles: requiredRoles,
            requiresQuiz: requiresQuiz === true,
            quizQuestions: quizQuestions ? JSON.stringify(quizQuestions) : null,
          },
        });
      }

      await writeMandatoryAudit(tx, {
        context: user, action: 'DOCUMENT_DRAFT_UPDATED', objectType: 'DocumentVersion', objectId: currentVersion.id,
        payload: { documentId: id, version: currentVersion.versionNumber, status: 'DRAFT', contentReplaced: Boolean(contentBase64), previousHash: contentBase64 ? currentVersion.hash : undefined, hash: upload?.hash },
        requestUrl: req.nextUrl.pathname,
      });
      return tx.document.findUniqueOrThrow({ where: { id } });
    });

    uploadedKey = null;
    return NextResponse.json({ document: updatedDoc });
  } catch (error: any) {
    if (uploadedKey) await cleanupUncontrolledObject(vercelBlobStorage, uploadedKey);
    if (error.message === 'STALE_DRAFT') return NextResponse.json({ error: { code: 'StaleWorkflowAction', message: 'Draft changed; refresh and try again' } }, { status: 409 });
    return unexpectedErrorResponse('document.update');
  }
}

// DELETE /api/documents/[id] - Soft/hard delete (archives document)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getContext(req);
    if (!user) {
      return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    }
    if (!hasPermission(user, 'documents.obsolete')) {
      return NextResponse.json({ error: { code: 'Forbidden', message: 'Insufficient permission' } }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (!reason) return NextResponse.json({ error: { code: 'ValidationFailed', message: 'An obsolescence reason is required' } }, { status: 400 });

    const document = await tenantRead(user.tenantId, (tx) => tx.document.findFirst({ where: { id, tenantId: user.tenantId } }));

    if (!document) {
      return NextResponse.json({ error: { code: 'NotFound', message: 'Document not found' } }, { status: 404 });
    }

    if (!['DRAFT', 'APPROVED', 'EFFECTIVE'].includes(document.status)) {
      return NextResponse.json({ error: { code: 'InvalidTransition', message: `Document cannot be obsoleted from ${document.status}` } }, { status: 409 });
    }
    const version = await tenantRead(user.tenantId, (tx) => tx.documentVersion.findUnique({ where: { documentId_versionNumber: { documentId: id, versionNumber: document.currentVersionNumber } } }));
    if (!version) return NextResponse.json({ error: { code: 'Conflict', message: 'Current document version is missing' } }, { status: 409 });
    assertTransition(version.status, 'OBSOLETE');

    const effectiveVersions = await tenantRead(user.tenantId, (tx) => tx.documentVersion.findMany({
      where: { documentId: id, status: 'EFFECTIVE', id: { not: version.id } },
      select: { id: true, versionNumber: true },
    }));

    // An open revision (draft, in review or approved) sits on top of a live effective
    // version. Obsoleting it here would also retire the SOP people are working to.
    // Withdraw the revision first (POST /api/documents/[id]/withdraw-revision).
    if (version.status !== 'EFFECTIVE' && effectiveVersions.length > 0) {
      return NextResponse.json(
        { error: { code: 'RevisionInProgress', message: 'This document has an open revision; the effective version cannot be obsoleted until the revision is withdrawn' } },
        { status: 409 },
      );
    }
    // Retirement is signed (DEC-066): it takes a controlled document out of use.
    await verifySignerOrRecordFailure(user, body.password, version.id, req);

    const archivedDoc = await tenantTransaction(user.tenantId, async (tx) => {
      const versionUpdate = await tx.documentVersion.updateMany({ where: { id: version.id, status: version.status }, data: { status: 'OBSOLETE' } });
      const effectiveUpdate = await tx.documentVersion.updateMany({
        where: { id: { in: effectiveVersions.map((item) => item.id) }, status: 'EFFECTIVE' },
        data: { status: 'OBSOLETE' },
      });
      const documentUpdate = await tx.document.updateMany({ where: { id, tenantId: user.tenantId, currentVersionNumber: version.versionNumber, status: document.status }, data: { status: 'OBSOLETE' } });
      if (versionUpdate.count !== 1 || effectiveUpdate.count !== effectiveVersions.length || documentUpdate.count !== 1) throw new Error('STALE_OBSOLESCENCE');
      const archived = await tx.document.findUniqueOrThrow({ where: { id } });
      await recordSignature(tx, { context: user, version, meaning: 'RETIRED', comment: reason, sourceIp: clientIp(req.headers), requestUrl: req.nextUrl.pathname });
      await writeMandatoryAudit(tx, {
        context: user,
        action: 'DOCUMENT_OBSOLETED',
        objectType: 'DocumentVersion',
        objectId: version.id,
        payload: { documentId: id, version: version.versionNumber, before: document.status, after: archived.status, reason },
        requestUrl: req.nextUrl.pathname,
      });
      for (const effective of effectiveVersions) {
        await writeMandatoryAudit(tx, {
          context: user,
          action: 'DOCUMENT_OBSOLETED',
          objectType: 'DocumentVersion',
          objectId: effective.id,
          payload: { documentId: id, version: effective.versionNumber, before: 'EFFECTIVE', after: 'OBSOLETE', reason },
          requestUrl: req.nextUrl.pathname,
        });
      }
      return archived;
    });

    return NextResponse.json({ success: true, document: archivedDoc });
  } catch (error: any) {
    if (error instanceof SignatureError) return signatureFailedResponse(error);
    const lifecycle = lifecycleErrorResponse(error);
    if (lifecycle) return NextResponse.json({ error: { code: lifecycle.code, message: lifecycle.message } }, { status: lifecycle.status });
    if (error.message === 'STALE_OBSOLESCENCE') return NextResponse.json({ error: { code: 'StaleWorkflowAction', message: 'Document state changed; refresh and try again' } }, { status: 409 });
    return unexpectedErrorResponse('document.delete');
  }
}
