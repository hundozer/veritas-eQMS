import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getContext, logAuditEvent, checkAbac } from '@/lib/auth';
import * as fs from 'fs';

import * as path from 'path';

// GET /api/documents - List documents with tenant-scoping and ABAC filtering
export async function GET(req: NextRequest) {
  try {
    const user = await getContext(req);
    if (!user) {
      return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
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
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Post-evaluate ABAC for each document (e.g., clearance checks)
    const filteredDocs = dbDocs.filter((doc: any) => {
      return checkAbac(user, { classification: doc.classification, ownerId: doc.ownerId }, 'view');
    });

    // Log the read action asynchronously
    await logAuditEvent({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'Document.List',
      objectType: 'Document',
      payload: { countReturned: filteredDocs.length, queryParams: Object.fromEntries(req.nextUrl.searchParams) },
      status: 'Success',
      requestUrl: req.nextUrl.pathname,
    });

    return NextResponse.json({ documents: filteredDocs });
  } catch (error: any) {
    console.error('List documents error:', error);
    return NextResponse.json({ error: { code: 'InternalError', message: error.message } }, { status: 500 });
  }
}

// POST /api/documents - Create a new document draft
export async function POST(req: NextRequest) {
  try {
    const user = await getContext(req);
    if (!user) {
      return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    }

    // Any authenticated tenant user can author document drafts

    const body = await req.json();
    const { title, description, classification, contentBase64, requiredRoles, requiresQuiz, quizQuestions } = body;

    if (!title || !classification) {
      return NextResponse.json({ error: { code: 'ValidationFailed', message: 'Title and classification are required' } }, { status: 400 });
    }

    // 1. Save uploaded file content if provided
    let filePath = '';
    let hash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'; // empty hash fallback

    if (contentBase64) {
      const crypto = await import('crypto');
      const buffer = Buffer.from(contentBase64, 'base64');
      hash = crypto.createHash('sha256').update(buffer).digest('hex');
      
      const uploadDir = path.join(process.cwd(), 'public', 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      const fileName = `${Date.now()}-${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
      filePath = `uploads/${fileName}`;
      fs.writeFileSync(path.join(process.cwd(), 'public', filePath), buffer);
    } else {
      filePath = 'drafts/placeholder.pdf';
    }

    // 2. Database transaction (Outbox-equivalent in prisma: save doc + version + training config in one txn)
    const result = await prisma.$transaction(async (tx: any) => {
      // Create Document
      const document = await tx.document.create({
        data: {
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
          filePath,
          hash,
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

      return document;
    });

    // 3. Log GxP transactional audit event
    await logAuditEvent({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'Document.Create',
      objectType: 'Document',
      objectId: result.id,
      payload: {
        title: result.title,
        classification: result.classification,
        status: result.status,
        version: 1,
        hash,
        requiredRoles,
      },
      status: 'Success',
      requestUrl: req.nextUrl.pathname,
    });

    return NextResponse.json({ document: result }, { status: 201 });
  } catch (error: any) {
    console.error('Create document error:', error);
    return NextResponse.json({ error: { code: 'InternalError', message: error.message } }, { status: 500 });
  }
}
