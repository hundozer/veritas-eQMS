import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getContext, logAuditEvent, checkAbac } from '@/lib/auth';
import * as fs from 'fs';
import * as path from 'path';

// GET /api/documents/[id] - Get document details + version history + training configs
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getContext(req);
    if (!user) {
      return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    }

    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        owner: true,
        versions: {
          orderBy: { versionNumber: 'desc' },
          include: {
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

    // Check ABAC view access
    if (!checkAbac(user, { classification: document.classification, ownerId: document.ownerId }, 'view')) {
      await logAuditEvent({
        tenantId: user.tenantId,
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        action: 'Document.View',
        objectType: 'Document',
        objectId: id,
        payload: { title: document.title, reason: 'ABAC check failed' },
        status: 'Denied',
        requestUrl: req.nextUrl.pathname,
      });
      return NextResponse.json({ error: { code: 'Forbidden', message: 'Access denied by ABAC policy' } }, { status: 403 });
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
  try {
    const { id } = await params;
    const user = await getContext(req);
    if (!user) {
      return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    }

    const document = await prisma.document.findUnique({
      where: { id },
      include: { versions: true },
    });

    if (!document || document.tenantId !== user.tenantId) {
      return NextResponse.json({ error: { code: 'NotFound', message: 'Document not found' } }, { status: 404 });
    }

    // Check ABAC edit access
    if (!checkAbac(user, { classification: document.classification, ownerId: document.ownerId }, 'edit')) {
      return NextResponse.json({ error: { code: 'Forbidden', message: 'Access denied: you are not the document owner' } }, { status: 403 });
    }

    const body = await req.json();
    const { title, description, classification, contentBase64, requiredRoles, requiresQuiz, quizQuestions } = body;

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
    let filePath = document.versions[0]?.filePath || '';
    let hash = document.versions[0]?.hash || '';

    if (contentBase64) {
      const crypto = await import('crypto');
      const buffer = Buffer.from(contentBase64, 'base64');
      hash = crypto.createHash('sha256').update(buffer).digest('hex');
      
      const uploadDir = path.join(process.cwd(), 'public', 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      const cleanTitle = (title || document.title).replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const fileName = `${Date.now()}-${cleanTitle}-v${nextVersionNumber}.pdf`;
      filePath = `uploads/${fileName}`;
      fs.writeFileSync(path.join(process.cwd(), 'public', filePath), buffer);
    }

    // 2. Transactionally save everything (metadata update, new version entry, update training)
    const updatedDoc = await prisma.$transaction(async (tx) => {
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
      if (contentBase64) {
        await tx.documentVersion.create({
          data: {
            documentId: id,
            versionNumber: nextVersionNumber,
            filePath,
            hash,
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

      return doc;
    });

    // 3. Log audit event
    await logAuditEvent({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'Document.Update',
      objectType: 'Document',
      objectId: id,
      payload: {
        title: updatedDoc.title,
        status: updatedDoc.status,
        version: updatedDoc.currentVersionNumber,
        newVersionUploaded: !!contentBase64,
        hash: contentBase64 ? hash : undefined,
      },
      status: 'Success',
      requestUrl: req.nextUrl.pathname,
    });

    return NextResponse.json({ document: updatedDoc });
  } catch (error: any) {
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

    const document = await prisma.document.findUnique({
      where: { id },
    });

    if (!document || document.tenantId !== user.tenantId) {
      return NextResponse.json({ error: { code: 'NotFound', message: 'Document not found' } }, { status: 404 });
    }

    // Only Owner or Admin can delete
    if (!checkAbac(user, { classification: document.classification, ownerId: document.ownerId }, 'delete')) {
      return NextResponse.json({ error: { code: 'Forbidden', message: 'Access denied: only owner or admin can archive' } }, { status: 403 });
    }

    // Set status to OBSOLETE (instead of hard deleting to preserve GxP audit records)
    const archivedDoc = await prisma.document.update({
      where: { id },
      data: { status: 'OBSOLETE' },
    });

    // Log the transaction
    await logAuditEvent({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'Document.Obsolete',
      objectType: 'Document',
      objectId: id,
      payload: { title: archivedDoc.title, previousStatus: document.status },
      status: 'Success',
      requestUrl: req.nextUrl.pathname,
    });

    return NextResponse.json({ success: true, document: archivedDoc });
  } catch (error: any) {
    console.error('Delete document error:', error);
    return NextResponse.json({ error: { code: 'InternalError', message: error.message } }, { status: 500 });
  }
}
