import { NextRequest, NextResponse } from 'next/server';
import { tenantRead, tenantTransaction } from '@/lib/tenant-db';
import { getContext, logAuditEvent } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { writeMandatoryAudit } from '@/lib/audit';
import { randomUUID } from 'node:crypto';
import { unexpectedErrorResponse } from '../../../lib/server-errors';
import {
  cleanupUncontrolledObject,
  createControlledObjectKey,
  decodeControlledUpload,
  vercelBlobStorage,
} from '@/lib/controlled-storage';
import { generateDocumentNumber, normalizeDocumentType } from '@/lib/document-lifecycle';

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
    const dbDocs = await tenantRead(user.tenantId, (tx) => tx.document.findMany({
      where: {
        tenantId: user.tenantId,
      },
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
            approvalRoutes: {
              orderBy: { createdAt: 'desc' },
              take: 1,
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
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    }));

    // Log the read action asynchronously
    await logAuditEvent({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      userRole: user.membershipRole,
      action: 'Document.List',
      objectType: 'Document',
      payload: { countReturned: dbDocs.length, queryParams: Object.fromEntries(req.nextUrl.searchParams) },
      status: 'Success',
      requestUrl: req.nextUrl.pathname,
    });

    return NextResponse.json(
      { documents: dbDocs },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error: any) {
    return unexpectedErrorResponse('document.list');
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
    const { title, description, classification, documentType: requestedType, contentBase64, fileName, mimeType, requiredRoles, requiresQuiz, quizQuestions } = body;

    if (!title || !classification) {
      return NextResponse.json({ error: { code: 'ValidationFailed', message: 'Title and classification are required' } }, { status: 400 });
    }
    let documentType;
    try {
      documentType = normalizeDocumentType(requestedType);
    } catch (error) {
      return NextResponse.json({ error: { code: 'ValidationFailed', message: (error as Error).message } }, { status: 400 });
    }
    const documentNumber = generateDocumentNumber(documentType);

    let upload;
    try {
      upload = decodeControlledUpload({ contentBase64, fileName, mimeType });
    } catch (error) {
      return NextResponse.json({ error: { code: 'ValidationFailed', message: (error as Error).message } }, { status: 400 });
    }

    const documentId = randomUUID();
    const storageKey = createControlledObjectKey({ tenantId: user.tenantId, documentId, versionNumber: 1 });
    uploadedKey = storageKey;
    await vercelBlobStorage.putObject(storageKey, upload.bytes, upload.mimeType);

    // 2. Database transaction (Outbox-equivalent in prisma: save doc + version + training config in one txn)
    const result = await tenantTransaction(user.tenantId, async (tx) => {
      // Create Document
      const document = await tx.document.create({
        data: {
          id: documentId,
          documentNumber,
          documentType,
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
          tenantId: user.tenantId,
          versionNumber: 1,
          status: 'DRAFT',
          filePath: storageKey,
          fileData: null,
          storageKey,
          originalFileName: upload.fileName,
          mimeType: upload.mimeType,
          sizeBytes: upload.bytes.byteLength,
          hash: upload.hash,
          createdBy: user.fullName,
          authoredById: user.id,
        },
      });

      // Create Training Requirements if specified
      if (requiredRoles) {
        await tx.trainingRequirement.create({
          data: {
            documentId: document.id,
            tenantId: user.tenantId,
            requiredForRoles: requiredRoles, // Comma separated, e.g. "EMPLOYEE,OWNER"
            requiresQuiz: requiresQuiz === true,
            quizQuestions: quizQuestions ? JSON.stringify(quizQuestions) : null,
          },
        });
      }

      await writeMandatoryAudit(tx, {
        context: user,
        action: 'DOCUMENT_CREATED',
        objectType: 'Document',
        objectId: document.id,
        payload: { documentNumber, documentType, title: document.title, classification: document.classification, status: document.status, version: 1, hash: upload.hash, requiredRoles },
        requestUrl: req.nextUrl.pathname,
      });

      return document;
    });

    uploadedKey = null;
    return NextResponse.json({ document: result }, { status: 201 });
  } catch (error: any) {
    if (uploadedKey) await cleanupUncontrolledObject(vercelBlobStorage, uploadedKey);
    return unexpectedErrorResponse('document.create');
  }
}
