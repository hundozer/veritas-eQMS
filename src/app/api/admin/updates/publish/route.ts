import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getContext, isPlatformAdminEmail, logAuditEvent } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const user = await getContext(req);
    if (!user || !isPlatformAdminEmail(user.email)) {
      return NextResponse.json({ error: { code: 'Forbidden', message: 'Access Denied: Simpleafied Admins only' } }, { status: 403 });
    }

    const body = await req.json();
    const { regulationId, newVersion, summary } = body;

    if (!regulationId || !newVersion || !summary) {
      return NextResponse.json({ error: { code: 'ValidationFailed', message: 'regulationId, newVersion, and summary are required' } }, { status: 400 });
    }

    const source = await prisma.regulationSource.findUnique({
      where: { regulationId },
      include: { requirements: true },
    });

    if (!source) {
      return NextResponse.json({ error: { code: 'NotFound', message: `Regulation source ${regulationId} not found` } }, { status: 404 });
    }

    // Identify requirements that changed (marked as NEW, MODIFIED, or DEPRECATED)
    const changedRequirements = source.requirements.filter(r => 
      r.changeType === 'NEW' || r.changeType === 'MODIFIED' || r.changeType === 'DEPRECATED'
    );

    const addedCount = source.requirements.filter(r => r.changeType === 'NEW').length;
    const modifiedCount = source.requirements.filter(r => r.changeType === 'MODIFIED').length;
    const deprecatedCount = source.requirements.filter(r => r.changeType === 'DEPRECATED').length;

    const changelog = changedRequirements.map(r => ({
      type: r.changeType as 'ADDED' | 'MODIFIED' | 'DEPRECATED',
      requirementId: r.requirementId,
      description: `${r.title} (${r.chapter}) - Text: ${r.requirementText.substring(0, 60)}...`,
    }));

    // Update the regulation source to reflect the new available version
    await prisma.regulationSource.update({
      where: { id: source.id },
      data: {
        latestAvailableVersion: newVersion,
        status: 'UPDATE_AVAILABLE',
      },
    });

    // Create a new AVAILABLE update log in the database
    const updateLog = await prisma.regulatoryUpdateLog.create({
      data: {
        regulationSourceId: source.id,
        fromVersion: source.version,
        toVersion: newVersion,
        publishedAt: new Date(),
        status: 'AVAILABLE',
        summary,
        addedRequirements: addedCount,
        modifiedRequirements: modifiedCount,
        deprecatedRequirements: deprecatedCount,
        changeManifest: JSON.stringify(changelog),
      },
    });

    // Reset all requirement changeType tags back to null/UNCHANGED now that they are packaged into this release
    for (const reqRecord of source.requirements) {
      if (reqRecord.changeType) {
        await prisma.regulatoryRequirement.update({
          where: { id: reqRecord.id },
          data: { changeType: null },
        });
      }
    }

    await logAuditEvent({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'PlatformAdmin.PublishUpdate',
      objectType: 'RegulatoryUpdateLog',
      objectId: updateLog.id,
      payload: { regulationId, fromVersion: source.version, toVersion: newVersion, addedCount, modifiedCount, deprecatedCount },
      status: 'Success',
      requestUrl: req.nextUrl.pathname,
    });

    return NextResponse.json({
      success: true,
      message: `Successfully published version ${newVersion} update for ${regulationId}`,
      updateLog,
    });
  } catch (error: any) {
    console.error('POST /api/admin/updates/publish error:', error);
    return NextResponse.json({ error: { code: 'InternalServerError', message: error.message } }, { status: 500 });
  }
}
