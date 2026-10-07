import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getContext } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { writeMandatoryAudit } from '@/lib/audit';
import { cleanupUncontrolledObject, createControlledObjectKey, decodeControlledUpload, vercelBlobStorage } from '@/lib/controlled-storage';
import { reportServerError } from '../../../../../lib/server-errors';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let uploadedKey: string | null = null;
  try {
    const { id } = await params;
    const user = await getContext(req);
    if (!user) return NextResponse.json({ error: { code: 'Unauthorized', message: 'Authentication required' } }, { status: 401 });
    if (!hasPermission(user, 'documents.update_draft')) return NextResponse.json({ error: { code: 'Forbidden', message: 'Document-revision permission is required' } }, { status: 403 });
    const body = await req.json();
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (!reason) return NextResponse.json({ error: { code: 'ValidationFailed', message: 'A revision reason or change summary is required' } }, { status: 400 });
    let upload;
    try {
      upload = decodeControlledUpload({ contentBase64: body.contentBase64, fileName: body.fileName, mimeType: body.mimeType });
    } catch (error) {
      return NextResponse.json({ error: { code: 'ValidationFailed', message: (error as Error).message } }, { status: 400 });
    }
    const document = await prisma.document.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!document) return NextResponse.json({ error: { code: 'NotFound', message: 'Document not found' } }, { status: 404 });
    const effectiveVersion = await prisma.documentVersion.findFirst({ where: { documentId: id, status: 'EFFECTIVE' } });
    if (document.status !== 'EFFECTIVE' || !effectiveVersion || effectiveVersion.versionNumber !== document.currentVersionNumber) {
      return NextResponse.json({ error: { code: 'InvalidTransition', message: 'A revision can be created only from the current effective version' } }, { status: 409 });
    }
    const nextVersionNumber = document.currentVersionNumber + 1;
    uploadedKey = createControlledObjectKey({ tenantId: user.tenantId, documentId: id, versionNumber: nextVersionNumber });
    await vercelBlobStorage.putObject(uploadedKey, upload.bytes, upload.mimeType);

    const version = await prisma.$transaction(async (tx) => {
      const documentUpdate = await tx.document.updateMany({
        where: { id, tenantId: user.tenantId, status: 'EFFECTIVE', currentVersionNumber: effectiveVersion.versionNumber },
        data: { status: 'DRAFT', currentVersionNumber: nextVersionNumber },
      });
      if (documentUpdate.count !== 1) throw new Error('STALE_REVISION');
      const created = await tx.documentVersion.create({
        data: {
          documentId: id, tenantId: user.tenantId, versionNumber: nextVersionNumber, status: 'DRAFT', changeSummary: reason,
          filePath: uploadedKey!, fileData: null, storageKey: uploadedKey!, originalFileName: upload.fileName,
          mimeType: upload.mimeType, sizeBytes: upload.bytes.byteLength, hash: upload.hash,
          createdBy: user.fullName, authoredById: user.id,
        },
      });
      await writeMandatoryAudit(tx, {
        context: user, action: 'DOCUMENT_REVISION_CREATED', objectType: 'DocumentVersion', objectId: created.id,
        payload: { documentId: id, previousVersion: effectiveVersion.versionNumber, version: nextVersionNumber, status: 'DRAFT', reason, hash: upload.hash },
        requestUrl: req.nextUrl.pathname,
      });
      return created;
    });
    uploadedKey = null;
    return NextResponse.json({ version }, { status: 201 });
  } catch (error) {
    if (uploadedKey) await cleanupUncontrolledObject(vercelBlobStorage, uploadedKey);
    if ((error as Error).message === 'STALE_REVISION') return NextResponse.json({ error: { code: 'StaleWorkflowAction', message: 'Document state changed; refresh and try again' } }, { status: 409 });
    reportServerError('document.revision');
    return NextResponse.json({ error: { code: 'InternalError', message: 'Unable to create document revision' } }, { status: 500 });
  }
}
