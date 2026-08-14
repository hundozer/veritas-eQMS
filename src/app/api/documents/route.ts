import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getContext, logAuditEvent } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { writeMandatoryAudit } from '@/lib/audit';
import { randomUUID } from 'node:crypto';
import {
  cleanupUncontrolledObject,
  createControlledObjectKey,
  decodeControlledUpload,
  vercelBlobStorage,
} from '@/lib/controlled-storage';

// GET /api/documents - List documents with tenant-scoping and ABAC filtering
export async function GET(req: NextRequest) {
  try {
    const user = await getContext(req);
    if (!user) {
      return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    }
    if (!hasPermission(user, 'documents.read')) {
      return NextResponse.json({ error: { code: 'Forbidden', message: 'Insufficient permission' } }, { status: 403 });
    }

    // Tenant isolation
    const dbDocs = await prisma.document.findMany({
      where: {
        tenantId: user.tenantId,
      },
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
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Log the read action asynchronously
    await logAuditEvent({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'Document.List',
      objectType: 'Document',
      payload: { countReturned: dbDocs.length, queryParams: Object.fromEntries(req.nextUrl.searchParams) },
      status: 'Success',
      requestUrl: req.nextUrl.pathname,
    });

    return NextResponse.json({ documents: dbDocs });
  } catch (error: any) {
    console.error('List documents error:', error);
    return NextResponse.json({ error: { code: 'InternalError', message: error.message } }, { status: 500 });
  }
}

// POST /api/documents - Create a new document draft
export async function POST(req: NextRequest) {
  let uploadedKey: string | null = null;
  try {
    const user = await getContext(req);
    if (!user) {
      return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    }
    if (!hasPermission(user, 'documents.create')) {
      return NextResponse.json({ error: { code: 'Forbidden', message: 'Insufficient permission' } }, { status: 403 });
    }

    // Any authenticated tenant user can author document drafts

    const body = await req.json();
    const { title, description, classification, contentBase64, fileName, mimeType, requiredRoles, requiresQuiz, quizQuestions } = body;

    if (!title || !classification) {
      return NextResponse.json({ error: { code: 'ValidationFailed', message: 'Title and classification are required' } }, { status: 400 });
    }

    let upload;
    try {
      upload = decodeControlledUpload({ contentBase64, fileName, mimeType });
    } catch (error) {
      return NextResponse.json({ error: { code: 'ValidationFailed', message: (error as Error).message } }, { status: 400 });
    }

    const documentId = randomUUID();
    uploadedKey = createControlledObjectKey({ tenantId: user.tenantId, documentId, versionNumber: 1 });
    await vercelBlobStorage.putObject(uploadedKey, upload.bytes, upload.mimeType);

    // 2. Database transaction (Outbox-equivalent in prisma: save doc + version + training config in one txn)
    const result = await prisma.$transaction(async (tx: any) => {
      // Create Document
      const document = await tx.document.create({
        data: {
          id: documentId,
          title,
          description: description || '',
          classification,
          status: 'DRAFT',
          ownerId: user.id,
          tenantId: user.tenantId,
          currentVersionNumber: 1,
        },
      });

      // Create Document Version
      await tx.documentVersion.create({
        data: {
          documentId: document.id,
          versionNumber: 1,
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

      // Create Training Requirements if specified
      if (requiredRoles) {
        await tx.trainingRequirement.create({
          data: {
            documentId: document.id,
            requiredForRoles: requiredRoles, // Comma separated, e.g. "EMPLOYEE,OWNER"
            requiresQuiz: requiresQuiz === true,
            quizQuestions: quizQuestions ? JSON.stringify(quizQuestions) : null,
          },
        });
      }

      await writeMandatoryAudit(tx, {
        context: user,
        action: 'Document.Create',
        objectType: 'Document',
        objectId: document.id,
        payload: { title: document.title, classification: document.classification, status: document.status, version: 1, hash: upload.hash, requiredRoles },
        requestUrl: req.nextUrl.pathname,
      });

      return document;
    });

    uploadedKey = null;
    return NextResponse.json({ document: result }, { status: 201 });
  } catch (error: any) {
    if (uploadedKey) await cleanupUncontrolledObject(vercelBlobStorage, uploadedKey);
    console.error('Create document error:', error);
    return NextResponse.json({ error: { code: 'InternalError', message: error.message } }, { status: 500 });
  }
}
