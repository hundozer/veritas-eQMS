import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getContext, logAuditEvent } from '@/lib/auth';

// Current content version published by Simpleafied Regulatory Content Authority.
// In production this would be fetched from a central API (e.g. https://api.simpleafied.app/regulatory/versions).
// For now we define it here as the single source of truth that gets updated with each deployment.
const SIMPLEAFIED_REGULATORY_REGISTRY: Record<string, {
  latestVersion: string;
  publishedAt: string;
  summary: string;
  changelog: Array<{ type: 'ADDED' | 'MODIFIED' | 'DEPRECATED'; requirementId: string; description: string }>;
}> = {
  'EU-GMP-VOL4': {
    latestVersion: '2024.1',
    publishedAt: '2024-08-01T00:00:00Z',
    summary: 'EU GMP Volume 4 — Baseline content package (Chapters 1–9). No pending updates.',
    changelog: [],
  },
};

// GET /api/intelligence/updates — Check for available regulatory content updates
export async function GET(req: NextRequest) {
  try {
    const user = await getContext(req);
    if (!user) {
      return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    }

    const sources = await prisma.regulationSource.findMany({
      include: {
        _count: { select: { requirements: true } },
        updateLogs: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    const updateStatus = sources.map(source => {
      const registry = SIMPLEAFIED_REGULATORY_REGISTRY[source.regulationId];
      const isUpToDate = !registry || source.version === registry.latestVersion;
      const updateAvailable = registry && source.version !== registry.latestVersion;

      return {
        regulationId: source.regulationId,
        title: source.title,
        authority: source.authority,
        region: source.region,
        currentVersion: source.version,
        latestAvailableVersion: registry?.latestVersion || source.version,
        sourceUrl: source.sourceUrl,
        status: isUpToDate ? 'UP_TO_DATE' : 'UPDATE_AVAILABLE',
        lastCheckedForUpdate: source.lastCheckedForUpdate,
        lastReviewedDate: source.lastReviewedDate,
        requirementCount: source._count.requirements,
        updateAvailable,
        pendingUpdate: updateAvailable ? {
          fromVersion: source.version,
          toVersion: registry!.latestVersion,
          publishedAt: registry!.publishedAt,
          summary: registry!.summary,
          changelog: registry!.changelog,
        } : null,
        recentUpdateHistory: source.updateLogs.map(log => ({
          id: log.id,
          fromVersion: log.fromVersion,
          toVersion: log.toVersion,
          publishedAt: log.publishedAt,
          appliedAt: log.appliedAt,
          status: log.status,
          summary: log.summary,
          addedRequirements: log.addedRequirements,
          modifiedRequirements: log.modifiedRequirements,
          deprecatedRequirements: log.deprecatedRequirements,
        })),
      };
    });

    // Update the lastCheckedForUpdate timestamp
    for (const source of sources) {
      await prisma.regulationSource.update({
        where: { id: source.id },
        data: { lastCheckedForUpdate: new Date() },
      });
    }

    await logAuditEvent({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'RegulatoryIntelligence.CheckForUpdates',
      objectType: 'RegulationSource',
      objectId: 'ALL',
      payload: { sourcesChecked: sources.length },
      status: 'Success',
      requestUrl: req.nextUrl.pathname,
    });

    return NextResponse.json({
      checkedAt: new Date().toISOString(),
      sources: updateStatus,
    });
  } catch (error: any) {
    console.error('Check regulatory updates error:', error);
    return NextResponse.json({ error: { code: 'InternalError', message: error.message } }, { status: 500 });
  }
}

// POST /api/intelligence/updates — Apply a regulatory content update (or dismiss it)
export async function POST(req: NextRequest) {
  try {
    const user = await getContext(req);
    if (!user) {
      return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    }

    if (!['QUALITY_MANAGER', 'REGULATORY_AFFAIRS', 'ADMIN', 'OWNER'].includes(user.role)) {
      return NextResponse.json({ error: { code: 'Forbidden', message: 'Only Quality Managers and Regulatory Affairs can apply regulatory updates' } }, { status: 403 });
    }

    const body = await req.json();
    const { regulationId, action } = body; // action: 'APPLY' | 'DISMISS'

    if (!regulationId) {
      return NextResponse.json({ error: { code: 'InvalidInput', message: 'regulationId is required' } }, { status: 400 });
    }

    const source = await prisma.regulationSource.findUnique({
      where: { regulationId },
    });

    if (!source) {
      return NextResponse.json({ error: { code: 'NotFound', message: `Regulation ${regulationId} not found` } }, { status: 404 });
    }

    const registry = SIMPLEAFIED_REGULATORY_REGISTRY[regulationId];
    if (!registry || source.version === registry.latestVersion) {
      return NextResponse.json({ message: 'Regulation is already up to date', version: source.version });
    }

    // Create update log entry
    const updateLog = await prisma.regulatoryUpdateLog.create({
      data: {
        regulationSourceId: source.id,
        fromVersion: source.version,
        toVersion: registry.latestVersion,
        publishedAt: new Date(registry.publishedAt),
        appliedAt: action === 'APPLY' ? new Date() : null,
        appliedByUserId: action === 'APPLY' ? user.id : null,
        status: action === 'APPLY' ? 'APPLIED' : 'DISMISSED',
        summary: registry.summary,
        addedRequirements: registry.changelog.filter(c => c.type === 'ADDED').length,
        modifiedRequirements: registry.changelog.filter(c => c.type === 'MODIFIED').length,
        deprecatedRequirements: registry.changelog.filter(c => c.type === 'DEPRECATED').length,
        changeManifest: JSON.stringify(registry.changelog),
      },
    });

    if (action === 'APPLY') {
      // Update the source version
      await prisma.regulationSource.update({
        where: { regulationId },
        data: {
          version: registry.latestVersion,
          status: 'ACTIVE',
          latestAvailableVersion: null,
          lastReviewedDate: new Date(),
        },
      });
    }

    await logAuditEvent({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: action === 'APPLY' ? 'RegulatoryIntelligence.ApplyUpdate' : 'RegulatoryIntelligence.DismissUpdate',
      objectType: 'RegulatoryUpdateLog',
      objectId: updateLog.id,
      payload: { regulationId, fromVersion: source.version, toVersion: registry.latestVersion },
      status: 'Success',
      requestUrl: req.nextUrl.pathname,
    });

    return NextResponse.json({
      message: action === 'APPLY'
        ? `Regulatory update applied: ${source.version} → ${registry.latestVersion}`
        : `Regulatory update dismissed for ${regulationId}`,
      updateLog: { id: updateLog.id, status: updateLog.status },
    });
  } catch (error: any) {
    console.error('Apply regulatory update error:', error);
    return NextResponse.json({ error: { code: 'InternalError', message: error.message } }, { status: 500 });
  }
}
