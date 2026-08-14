import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getContext, logAuditEvent } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { writeMandatoryAudit } from '@/lib/audit';
import {
  cleanupUncontrolledObject,
  createControlledObjectKey,
  decodeControlledUpload,
  vercelBlobStorage,
} from '@/lib/controlled-storage';

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

    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        owner: true,
        versions: {
          orderBy: { versionNumber: 'desc' },
          select: {
            id: true,
            versionNumber: true,
            hash: true,
            originalFileName: true,
            mimeType: true,
            sizeBytes: true,
            createdAt: true,
            createdBy: true,
            signatureManifest: {
              include: { signer: true }
            }
          }
        },
        trainingRequirement: true,
      },
    });

    if (!document || document.tenantId !== user.tenantId) {
      return NextResponse.json({ error: { code: 'NotFound', message: 'Document not found' } }, { status: 404 });
    }

    // Log the read action asynchronously
    await logAuditEvent({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'Document.View',
      objectType: 'Document',
      objectId: id,
      payload: { title: document.title, version: document.currentVersionNumber },
      status: 'Success',
      requestUrl: req.nextUrl.pathname,
    });

    return NextResponse.json({ document });
  } catch (error: any) {
    console.error('Get document details error:', error);
    return NextResponse.json({ error: { code: 'InternalError', message: error.message } }, { status: 500 });
  }
}

// PUT /api/documents/[id] - Upload a new version or edit document metadata
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

    const document = await prisma.document.findUnique({
      where: { id },
      include: { versions: { orderBy: { versionNumber: 'desc' } } },
    });

    if (!document || document.tenantId !== user.tenantId) {
      return NextResponse.json({ error: { code: 'NotFound', message: 'Document not found' } }, { status: 404 });
    }

    const body = await req.json();
    const { title, description, classification, contentBase64, fileName, mimeType, requiredRoles, requiresQuiz, quizQuestions } = body;

    // Enforce Change Control lock on effective documents
    if (document.status === 'EFFECTIVE' && contentBase64) {
      const activeCR = await prisma.changeRequest.findFirst({
        where: {
          status: 'APPROVED',
          documents: {
            some: {
              documentId: id
            }
          }
        }
      });

      if (!activeCR) {
        return NextResponse.json({
          error: {
            code: 'Forbidden',
            message: 'Revising this effective GxP document is locked. An APPROVED Change Request is required to create a new version.'
          }
        }, { status: 403 });
      }
    }

    const nextVersionNumber = document.currentVersionNumber + 1;

    // 1. Process new version upload if contentBase64 is provided
    let upload: ReturnType<typeof decodeControlledUpload> | null = null;

    if (contentBase64) {
      try {
        upload = decodeControlledUpload({ contentBase64, fileName, mimeType });
      } catch (error) {
        return NextResponse.json({ error: { code: 'ValidationFailed', message: (error as Error).message } }, { status: 400 });
      }
      uploadedKey = createControlledObjectKey({ tenantId: user.tenantId, documentId: id, versionNumber: nextVersionNumber });
      await vercelBlobStorage.putObject(uploadedKey, upload.bytes, upload.mimeType);
    }

    // 2. Transactionally save everything (metadata update, new version entry, update training)
    const updatedDoc = await prisma.$transaction(async (tx: any) => {
      // Update basic fields
      const doc = await tx.document.update({
        where: { id },
        data: {
          title: title || document.title,
          description: description !== undefined ? description : document.description,
          classification: classification || document.classification,
          currentVersionNumber: contentBase64 ? nextVersionNumber : document.currentVersionNumber,
          status: contentBase64 ? 'DRAFT' : document.status, // Reverts to DRAFT for review if new content is uploaded
        },
      });

      // Insert new version if new content uploaded
      if (upload && uploadedKey) {
        await tx.documentVersion.create({
          data: {
            documentId: id,
            versionNumber: nextVersionNumber,
            filePath: uploadedKey,
            fileData: null,
            storageKey: uploadedKey,
            originalFileName: upload.fileName,
            mimeType: upload.mimeType,
            sizeBytes: upload.bytes.byteLength,
            hash: upload.hash,
            createdBy: user.fullName,
          },
        });
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
            requiredForRoles: requiredRoles,
            requiresQuiz: requiresQuiz === true,
            quizQuestions: quizQuestions ? JSON.stringify(quizQuestions) : null,
          },
        });
      }

      await writeMandatoryAudit(tx, {
        context: user, action: 'Document.Update', objectType: 'Document', objectId: id,
        payload: { previousStatus: document.status, status: doc.status, previousVersion: document.currentVersionNumber, version: doc.currentVersionNumber, newVersionUploaded: Boolean(contentBase64) },
        requestUrl: req.nextUrl.pathname,
      });
      return doc;
    });

    uploadedKey = null;
    return NextResponse.json({ document: updatedDoc });
  } catch (error: any) {
    if (uploadedKey) await cleanupUncontrolledObject(vercelBlobStorage, uploadedKey);
    console.error('Update document error:', error);
    return NextResponse.json({ error: { code: 'InternalError', message: error.message } }, { status: 500 });
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

    const document = await prisma.document.findUnique({
      where: { id },
    });

    if (!document || document.tenantId !== user.tenantId) {
      return NextResponse.json({ error: { code: 'NotFound', message: 'Document not found' } }, { status: 404 });
    }

    // Set status to OBSOLETE (instead of hard deleting to preserve GxP audit records)
    const archivedDoc = await prisma.$transaction(async (tx) => {
      const archived = await tx.document.update({ where: { id }, data: { status: 'OBSOLETE' } });
      await writeMandatoryAudit(tx, {
      context: user,
      action: 'Document.Obsolete',
      objectType: 'Document',
      objectId: id,
      payload: { previousStatus: document.status, status: archived.status },
      requestUrl: req.nextUrl.pathname,
    });
      return archived;
    });

    return NextResponse.json({ success: true, document: archivedDoc });
  } catch (error: any) {
    console.error('Delete document error:', error);
    return NextResponse.json({ error: { code: 'InternalError', message: error.message } }, { status: 500 });
  }
}
