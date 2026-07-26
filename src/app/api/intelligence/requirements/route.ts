import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getContext, logAuditEvent } from '@/lib/auth';
import { ensureEUGMPKnowledgeBaseSeeded, EU_GMP_CHAPTERS, QUALITY_TAXONOMY_AREAS } from '@/lib/eugmp-knowledge-base';

// GET /api/intelligence/requirements - Fetch structured EU GMP requirements, sources, graph relationships & metrics
export async function GET(req: NextRequest) {
  try {
    const user = await getContext(req);
    if (!user) {
      return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    }

    // Ensure EU GMP Knowledge Base is initialized
    await ensureEUGMPKnowledgeBaseSeeded();

    const searchParams = req.nextUrl.searchParams;
    const chapterFilter = searchParams.get('chapter');
    const categoryFilter = searchParams.get('category');
    const riskFilter = searchParams.get('riskLevel');
    const searchQuery = searchParams.get('search');

    // Build Prisma query filters
    const where: any = {};
    if (chapterFilter && chapterFilter !== 'ALL') {
      where.chapter = chapterFilter;
    }
    if (categoryFilter && categoryFilter !== 'ALL') {
      where.category = categoryFilter;
    }
    if (riskFilter && riskFilter !== 'ALL') {
      where.riskLevel = riskFilter;
    }
    if (searchQuery) {
      where.OR = [
        { title: { contains: searchQuery, mode: 'insensitive' } },
        { requirementId: { contains: searchQuery, mode: 'insensitive' } },
        { requirementText: { contains: searchQuery, mode: 'insensitive' } },
        { expectedEvidence: { contains: searchQuery, mode: 'insensitive' } },
      ];
    }

    const [sources, requirements, allRelationships, documents, capas, deviations, auditPlans] = await Promise.all([
      prisma.regulationSource.findMany({
        include: { _count: { select: { requirements: true } } },
      }),
      prisma.regulatoryRequirement.findMany({
        where,
        include: {
          relationships: true,
          regulationSource: { select: { regulationId: true, title: true, authority: true } },
        },
        orderBy: { requirementId: 'asc' },
      }),
      prisma.requirementRelationship.findMany({
        include: { requirement: true },
      }),
      prisma.document.findMany({ where: { tenantId: user.tenantId } }),
      prisma.cAPA.findMany({ where: { tenantId: user.tenantId } }),
      prisma.deviation.findMany({ where: { tenantId: user.tenantId } }),
      prisma.auditPlan.findMany({ where: { tenantId: user.tenantId } }),
    ]);

    // Calculate Dashboard Metrics
    const totalRequirements = requirements.length;
    const criticalRiskCount = requirements.filter(r => r.riskLevel === 'CRITICAL').length;
    const highMajorRiskCount = requirements.filter(r => r.riskLevel === 'MAJOR').length;
    const withoutEvidenceCount = requirements.filter(r => r.relationships.length === 0).length;
    const mappedRequirementsCount = requirements.filter(r => r.relationships.length > 0).length;
    
    const coveragePercentage = totalRequirements > 0
      ? Math.round((mappedRequirementsCount / totalRequirements) * 100)
      : 0;

    // Group requirements by chapter
    const byChapterStats: Record<string, number> = {};
    EU_GMP_CHAPTERS.forEach(ch => {
      byChapterStats[ch] = requirements.filter(r => r.chapter === ch).length;
    });

    await logAuditEvent({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'RegulatoryIntelligence.ViewRepository',
      objectType: 'RegulationSource',
      objectId: 'EU-GMP-VOL4',
      payload: { filterChapter: chapterFilter, totalRequirements },
      status: 'Success',
      requestUrl: req.nextUrl.pathname,
    });

    return NextResponse.json({
      sources,
      requirements,
      metrics: {
        totalRequirements,
        criticalRiskCount,
        highMajorRiskCount,
        withoutEvidenceCount,
        mappedRequirementsCount,
        coveragePercentage,
        byChapterStats,
      },
      taxonomy: {
        chapters: EU_GMP_CHAPTERS,
        qualityAreas: QUALITY_TAXONOMY_AREAS,
        riskCategories: ['CRITICAL', 'MAJOR', 'MINOR', 'INFORMATIONAL'],
      },
      availableQmsEntities: {
        documents: documents.map(d => ({ id: d.id, title: d.title, status: d.status })),
        capas: capas.map(c => ({ id: c.id, title: c.title, status: c.status })),
        deviations: deviations.map(d => ({ id: d.id, title: d.title, status: d.status })),
        audits: auditPlans.map(a => ({ id: a.id, title: a.title, status: a.status })),
      },
    });
  } catch (error: any) {
    console.error('Fetch regulatory requirements error:', error);
    return NextResponse.json({ error: { code: 'InternalError', message: error.message } }, { status: 500 });
  }
}

// POST /api/intelligence/requirements - Create or update a regulatory requirement statement
export async function POST(req: NextRequest) {
  try {
    const user = await getContext(req);
    if (!user) {
      return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    }

    // Role check: Quality Manager, Regulatory Affairs, or Admin
    if (!['QUALITY_MANAGER', 'REGULATORY_AFFAIRS', 'ADMIN', 'OWNER'].includes(user.role)) {
      return NextResponse.json({ error: { code: 'Forbidden', message: 'Only Quality Managers and Regulatory Affairs can modify regulatory definitions' } }, { status: 403 });
    }

    const body = await req.json();
    const {
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
      status = 'APPROVED',
    } = body;

    if (!requirementId || !chapter || !title || !requirementText) {
      return NextResponse.json({ error: { code: 'InvalidInput', message: 'Requirement ID, chapter, title, and statement text are required' } }, { status: 400 });
    }

    const sourceId = await ensureEUGMPKnowledgeBaseSeeded();

    const requirement = await prisma.regulatoryRequirement.upsert({
      where: { requirementId },
      update: {
        chapter,
        section: section || null,
        title,
        category: category || 'Quality System',
        riskLevel: riskLevel || 'MAJOR',
        requirementText,
        expectedEvidence: expectedEvidence || '',
        applicableAreas: Array.isArray(applicableAreas) ? JSON.stringify(applicableAreas) : (applicableAreas || '[]'),
        affectedProcesses: Array.isArray(affectedProcesses) ? JSON.stringify(affectedProcesses) : (affectedProcesses || '[]'),
        status,
      },
      create: {
        requirementId,
        regulationSourceId: sourceId,
        chapter,
        section: section || null,
        title,
        category: category || 'Quality System',
        riskLevel: riskLevel || 'MAJOR',
        requirementText,
        expectedEvidence: expectedEvidence || '',
        applicableAreas: Array.isArray(applicableAreas) ? JSON.stringify(applicableAreas) : (applicableAreas || '[]'),
        affectedProcesses: Array.isArray(affectedProcesses) ? JSON.stringify(affectedProcesses) : (affectedProcesses || '[]'),
        status,
        aiExtracted: false,
      },
    });

    await logAuditEvent({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'RegulatoryIntelligence.UpdateRequirement',
      objectType: 'RegulatoryRequirement',
      objectId: requirement.id,
      payload: { requirementId, title, riskLevel },
      status: 'Success',
      requestUrl: req.nextUrl.pathname,
    });

    return NextResponse.json({ requirement });
  } catch (error: any) {
    console.error('Save requirement error:', error);
    return NextResponse.json({ error: { code: 'InternalError', message: error.message } }, { status: 500 });
  }
}
