import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getContext, logAuditEvent } from '@/lib/auth';

// POST /api/intelligence/relationships - Create or delete Knowledge Graph relationships between EU GMP requirements and tenant QMS objects
export async function POST(req: NextRequest) {
  try {
    const user = await getContext(req);
    if (!user) {
      return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    }

    if (!['QUALITY_MANAGER', 'REGULATORY_AFFAIRS', 'ADMIN', 'OWNER'].includes(user.role)) {
      return NextResponse.json({ error: { code: 'Forbidden', message: 'Only Quality Managers and Regulatory Affairs can modify regulatory mappings' } }, { status: 403 });
    }

    const body = await req.json();
    const { action = 'CREATE', requirementId, targetType, targetId, targetTitle, relationshipType = 'REQUIRES', relationshipId } = body;

    if (action === 'DELETE' && relationshipId) {
      await prisma.requirementRelationship.delete({
        where: { id: relationshipId },
      });

      await logAuditEvent({
        tenantId: user.tenantId,
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        action: 'RegulatoryIntelligence.DeleteRelationship',
        objectType: 'RequirementRelationship',
        objectId: relationshipId,
        payload: { action: 'DELETE', relationshipId },
        status: 'Success',
        requestUrl: req.nextUrl.pathname,
      });

      return NextResponse.json({ success: true, message: 'Relationship unlinked successfully' });
    }

    if (!requirementId || !targetType || !targetId || !targetTitle) {
      return NextResponse.json({ error: { code: 'InvalidInput', message: 'Requirement ID, targetType, targetId, and targetTitle are required' } }, { status: 400 });
    }

    // Check if relationship already exists
    const existing = await prisma.requirementRelationship.findFirst({
      where: {
        requirementId,
        targetType,
        targetId,
      },
    });

    if (existing) {
      return NextResponse.json({ relationship: existing, message: 'Relationship already exists' });
    }

    const relationship = await prisma.requirementRelationship.create({
      data: {
        requirementId,
        targetType,
        targetId,
        targetTitle,
        relationshipType,
      },
    });

    await logAuditEvent({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'RegulatoryIntelligence.CreateRelationship',
      objectType: 'RequirementRelationship',
      objectId: relationship.id,
      payload: { requirementId, targetType, targetId, targetTitle, relationshipType },
      status: 'Success',
      requestUrl: req.nextUrl.pathname,
    });

    return NextResponse.json({ relationship });
  } catch (error: any) {
    console.error('Save relationship error:', error);
    return NextResponse.json({ error: { code: 'InternalError', message: error.message } }, { status: 500 });
  }
}
