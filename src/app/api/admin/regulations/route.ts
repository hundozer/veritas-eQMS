import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getContext, isPlatformAdminEmail, logAuditEvent } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getContext(req);
    if (!user || !isPlatformAdminEmail(user.email)) {
      return NextResponse.json({ error: { code: 'Forbidden', message: 'Access Denied: Simpleafied Admins only' } }, { status: 403 });
    }

    const regulations = await prisma.regulationSource.findMany({
      include: {
        requirements: {
          orderBy: { requirementId: 'asc' },
        },
      },
      orderBy: { regulationId: 'asc' },
    });

    return NextResponse.json(regulations);
  } catch (error: any) {
    console.error('GET /api/admin/regulations error:', error);
    return NextResponse.json({ error: { code: 'InternalServerError', message: error.message } }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getContext(req);
    if (!user || !isPlatformAdminEmail(user.email)) {
      return NextResponse.json({ error: { code: 'Forbidden', message: 'Access Denied: Simpleafied Admins only' } }, { status: 403 });
    }

    const body = await req.json();
    const { action, payload } = body;

    if (!action || !payload) {
      return NextResponse.json({ error: { code: 'ValidationFailed', message: 'action and payload are required' } }, { status: 400 });
    }

    if (action === 'CREATE_REGULATION') {
      const { regulationId, title, authority, region, version, sourceUrl } = payload;
      if (!regulationId || !title || !authority) {
        return NextResponse.json({ error: { code: 'ValidationFailed', message: 'regulationId, title, authority are required' } }, { status: 400 });
      }

      const record = await prisma.regulationSource.create({
        data: {
          regulationId,
          title,
          authority,
          region: region || 'Global',
          version: version || '1.0',
          sourceUrl: sourceUrl || null,
          status: 'ACTIVE',
        },
      });

      await logAuditEvent({
        tenantId: user.tenantId,
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        action: 'PlatformAdmin.CreateRegulation',
        objectType: 'RegulationSource',
        objectId: record.id,
        payload,
        status: 'Success',
        requestUrl: req.nextUrl.pathname,
      });

      return NextResponse.json({ success: true, data: record });
    }

    if (action === 'EDIT_REGULATION') {
      const { id, title, authority, region, version, sourceUrl, status } = payload;
      if (!id) {
        return NextResponse.json({ error: { code: 'ValidationFailed', message: 'Regulation ID is required' } }, { status: 400 });
      }

      const record = await prisma.regulationSource.update({
        where: { id },
        data: {
          title,
          authority,
          region,
          version,
          sourceUrl,
          status,
          lastReviewedDate: new Date(),
        },
      });

      await logAuditEvent({
        tenantId: user.tenantId,
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        action: 'PlatformAdmin.EditRegulation',
        objectType: 'RegulationSource',
        objectId: record.id,
        payload,
        status: 'Success',
        requestUrl: req.nextUrl.pathname,
      });

      return NextResponse.json({ success: true, data: record });
    }

    if (action === 'CREATE_REQUIREMENT') {
      const {
        regulationSourceId,
        requirementId,
        chapter,
        section,
        title,
        category,
        riskLevel,
        requirementText,
        expectedEvidence,
        applicableAreas,
        affectedProcesses,
      } = payload;

      if (!regulationSourceId || !requirementId || !chapter || !title || !requirementText || !expectedEvidence) {
        return NextResponse.json({ error: { code: 'ValidationFailed', message: 'Missing required requirement fields' } }, { status: 400 });
      }

      // Check uniqueness
      const existing = await prisma.regulatoryRequirement.findUnique({
        where: { requirementId },
      });
      if (existing) {
        return NextResponse.json({ error: { code: 'DuplicateId', message: `Requirement ID ${requirementId} already exists` } }, { status: 400 });
      }

      const record = await prisma.regulatoryRequirement.create({
        data: {
          regulationSourceId,
          requirementId,
          chapter,
          section: section || null,
          title,
          category,
          riskLevel: riskLevel || 'MAJOR',
          requirementText,
          expectedEvidence,
          applicableAreas: JSON.stringify(applicableAreas || []),
          affectedProcesses: JSON.stringify(affectedProcesses || []),
          status: 'APPROVED',
          changeType: 'NEW',
        },
      });

      await logAuditEvent({
        tenantId: user.tenantId,
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        action: 'PlatformAdmin.CreateRequirement',
        objectType: 'RegulatoryRequirement',
        objectId: record.id,
        payload,
        status: 'Success',
        requestUrl: req.nextUrl.pathname,
      });

      return NextResponse.json({ success: true, data: record });
    }

    if (action === 'EDIT_REQUIREMENT') {
      const {
        id,
        chapter,
        section,
        title,
        category,
        riskLevel,
        requirementText,
        expectedEvidence,
        applicableAreas,
        affectedProcesses,
        status,
      } = payload;

      if (!id) {
        return NextResponse.json({ error: { code: 'ValidationFailed', message: 'Requirement ID is required' } }, { status: 400 });
      }

      const oldRequirement = await prisma.regulatoryRequirement.findUnique({
        where: { id },
      });

      if (!oldRequirement) {
        return NextResponse.json({ error: { code: 'NotFound', message: 'Requirement not found' } }, { status: 404 });
      }

      const record = await prisma.regulatoryRequirement.update({
        where: { id },
        data: {
          chapter,
          section,
          title,
          category,
          riskLevel,
          requirementText,
          expectedEvidence,
          applicableAreas: JSON.stringify(applicableAreas || []),
          affectedProcesses: JSON.stringify(affectedProcesses || []),
          status: status || 'APPROVED',
          changeType: 'MODIFIED',
          previousText: oldRequirement.requirementText,
        },
      });

      await logAuditEvent({
        tenantId: user.tenantId,
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        action: 'PlatformAdmin.EditRequirement',
        objectType: 'RegulatoryRequirement',
        objectId: record.id,
        payload,
        status: 'Success',
        requestUrl: req.nextUrl.pathname,
      });

      return NextResponse.json({ success: true, data: record });
    }

    if (action === 'DELETE_REQUIREMENT') {
      const { id } = payload;
      if (!id) {
        return NextResponse.json({ error: { code: 'ValidationFailed', message: 'Requirement ID is required' } }, { status: 400 });
      }

      // Instead of absolute deletion, we mark it as DEPRECATED or delete it based on standard compliance
      const record = await prisma.regulatoryRequirement.update({
        where: { id },
        data: {
          status: 'DEPRECATED',
          changeType: 'DEPRECATED',
        },
      });

      await logAuditEvent({
        tenantId: user.tenantId,
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        action: 'PlatformAdmin.DeprecateRequirement',
        objectType: 'RegulatoryRequirement',
        objectId: record.id,
        payload,
        status: 'Success',
        requestUrl: req.nextUrl.pathname,
      });

      return NextResponse.json({ success: true, data: record });
    }

    return NextResponse.json({ error: { code: 'InvalidAction', message: `Unknown action: ${action}` } }, { status: 400 });
  } catch (error: any) {
    console.error('POST /api/admin/regulations error:', error);
    return NextResponse.json({ error: { code: 'InternalServerError', message: error.message } }, { status: 500 });
  }
}
