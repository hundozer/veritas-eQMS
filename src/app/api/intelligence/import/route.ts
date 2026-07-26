import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getContext, logAuditEvent } from '@/lib/auth';
import { ensureEUGMPKnowledgeBaseSeeded } from '@/lib/eugmp-knowledge-base';

// POST /api/intelligence/import - Parse raw PDF or text regulatory document into candidate requirement statements
export async function POST(req: NextRequest) {
  try {
    const user = await getContext(req);
    if (!user) {
      return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    }

    if (!['QUALITY_MANAGER', 'REGULATORY_AFFAIRS', 'ADMIN', 'OWNER'].includes(user.role)) {
      return NextResponse.json({ error: { code: 'Forbidden', message: 'Only Quality Managers and Regulatory Affairs can import regulatory sources' } }, { status: 403 });
    }

    const body = await req.json();
    const { documentName, documentText, chapter = 'Chapter 4: Documentation' } = body;

    if (!documentName || !documentText) {
      return NextResponse.json({ error: { code: 'InvalidInput', message: 'Document name and text content are required' } }, { status: 400 });
    }

    const sourceId = await ensureEUGMPKnowledgeBaseSeeded();

    // Split text into paragraphs and extract regulatory requirement candidates
    const paragraphs = documentText
      .split(/\n\s*\n/)
      .map((p: string) => p.trim())
      .filter((p: string) => p.length > 20);

    const extractedCandidates = [];
    const timestamp = Date.now().toString().slice(-4);

    for (let i = 0; i < Math.min(paragraphs.length, 5); i++) {
      const pText = paragraphs[i];
      const reqId = `EU-GMP-IMP-${timestamp}-${i + 1}`;
      
      // Determine candidate risk level based on keywords
      let riskLevel = 'MAJOR';
      if (/must|shall|critical|mandatory|prohibited|toxic|sterile/i.test(pText)) {
        riskLevel = 'CRITICAL';
      } else if (/recommended|should|informational/i.test(pText)) {
        riskLevel = 'MINOR';
      }

      // Suggest affected processes
      const affectedProcesses = [];
      if (/document|sop|record|log|signature/i.test(pText)) affectedProcesses.push('Document Management');
      if (/train|qualification|personnel|staff/i.test(pText)) affectedProcesses.push('Training');
      if (/change|revision|amend/i.test(pText)) affectedProcesses.push('Change Control');
      if (/audit|inspect|verify|check/i.test(pText)) affectedProcesses.push('Audit');

      const title = pText.length > 60 ? `${pText.substring(0, 57)}...` : pText;

      const created = await prisma.regulatoryRequirement.upsert({
        where: { requirementId: reqId },
        update: {
          requirementText: pText,
          status: 'PENDING_REVIEW',
        },
        create: {
          requirementId: reqId,
          regulationSourceId: sourceId,
          chapter,
          section: `Import Sec ${i + 1}`,
          title: `[Candidate] ${title}`,
          category: 'Documentation',
          riskLevel,
          requirementText: pText,
          expectedEvidence: 'Pending Quality Manager Evidence Verification',
          applicableAreas: JSON.stringify(['Quality Assurance', 'Regulatory Affairs']),
          affectedProcesses: JSON.stringify(affectedProcesses.length > 0 ? affectedProcesses : ['Document Management']),
          status: 'PENDING_REVIEW',
          aiExtracted: true,
        },
      });

      extractedCandidates.push(created);
    }

    await logAuditEvent({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'RegulatoryIntelligence.ImportDocument',
      objectType: 'RegulationSource',
      objectId: sourceId,
      payload: { documentName, candidatesExtractedCount: extractedCandidates.length },
      status: 'Success',
      requestUrl: req.nextUrl.pathname,
    });

    return NextResponse.json({
      success: true,
      message: `Successfully extracted ${extractedCandidates.length} candidate requirement statements. Human confirmation required.`,
      candidates: extractedCandidates,
    });
  } catch (error: any) {
    console.error('Import regulatory document error:', error);
    return NextResponse.json({ error: { code: 'InternalError', message: error.message } }, { status: 500 });
  }
}
