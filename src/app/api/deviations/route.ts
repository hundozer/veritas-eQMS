import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getContext, logAuditEvent } from '@/lib/auth';
import { autoMapDeviationAndCreateCapa } from '@/lib/regulatory-ai-mapper';

// GET /api/deviations - List all deviations in the tenant
export async function GET(req: NextRequest) {
  try {
    const user = await getContext(req);
    if (!user) {
      return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    }

    const deviations = await prisma.deviation.findMany({
      where: { tenantId: user.tenantId },
      include: {
        detectedBy: true,
        investigator: true,
        capas: {
          include: {
            assignedTo: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Log the read audit event
    await logAuditEvent({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'Deviation.List',
      objectType: 'Deviation',
      payload: { countReturned: deviations.length },
      status: 'Success',
      requestUrl: req.nextUrl.pathname,
    });

    return NextResponse.json({ deviations });
  } catch (error: any) {
    console.error('List deviations error:', error);
    return NextResponse.json({ error: { code: 'InternalError', message: error.message } }, { status: 500 });
  }
}

// POST /api/deviations - Log a new deviation
export async function POST(req: NextRequest) {
  try {
    const user = await getContext(req);
    if (!user) {
      return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    }

    const body = await req.json();
    const { title, description, classification } = body;

    if (!title || !description || !classification) {
      return NextResponse.json({ error: { code: 'ValidationFailed', message: 'Title, description, and classification are required' } }, { status: 400 });
    }

    if (!['MINOR', 'MAJOR', 'CRITICAL'].includes(classification)) {
      return NextResponse.json({ error: { code: 'ValidationFailed', message: 'Classification must be MINOR, MAJOR, or CRITICAL' } }, { status: 400 });
    }

    const deviation = await prisma.deviation.create({
      data: {
        tenantId: user.tenantId,
        title,
        description,
        classification,
        status: 'LOGGED',
        detectedById: user.id,
      },
      include: {
        detectedBy: true
      }
    });

    // Automatically map deviation to global regulations and generate corrective CAPA plan
    try {
      await autoMapDeviationAndCreateCapa(deviation.id, {
        id: user.id,
        email: user.email,
        role: user.role,
      });
    } catch (e) {
      console.error('Failed to auto-map deviation and create CAPA:', e);
    }

    // Log creation audit log
    await logAuditEvent({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'Deviation.Create',
      objectType: 'Deviation',
      objectId: deviation.id,
      payload: {
        title: deviation.title,
        classification: deviation.classification,
        status: deviation.status,
      },
      status: 'Success',
      requestUrl: req.nextUrl.pathname,
    });

    return NextResponse.json({ deviation }, { status: 201 });
  } catch (error: any) {
    console.error('Create deviation error:', error);
    return NextResponse.json({ error: { code: 'InternalError', message: error.message } }, { status: 500 });
  }
}
