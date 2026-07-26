import prisma from '@/lib/db';
import { logAuditEvent } from '@/lib/auth';

/**
 * Automatically maps a deviation to the most appropriate regulatory requirement chapter/section,
 * flags the relationship, and auto-generates a Corrective and Preventive Action (CAPA).
 */
export async function autoMapDeviationAndCreateCapa(deviationId: string, operatorUser: { id: string; email: string; role: string }) {
  try {
    // 1. Fetch the deviation details
    const deviation = await prisma.deviation.findUnique({
      where: { id: deviationId },
      include: { tenant: true },
    });

    if (!deviation) return null;

    // 2. Fetch all regulatory requirements in the database
    const requirements = await prisma.regulatoryRequirement.findMany({
      where: { status: 'APPROVED' },
    });

    if (requirements.length === 0) return null;

    // 3. Simple semantic matching engine based on GxP terminology
    const textToAnalyze = `${deviation.title} ${deviation.description}`.toLowerCase();
    
    let bestMatch = null;
    let maxMatchedKeywords = 0;

    const categoryKeywords: Record<string, string[]> = {
      'Personnel': ['personnel', 'training', 'employee', 'staff', 'qualification', 'competence', 'signature', 'cv', 'experience'],
      'Premises and Equipment': ['premises', 'equipment', 'hvac', 'cleanroom', 'facility', 'autoclave', 'sterilization', 'fridge', 'freezer', 'calibration', 'maintenance', 'temperature', 'humidity'],
      'Documentation': ['documentation', 'document', 'sop', 'record', 'logbook', 'signature', 'batch record', 'raw data', 'pdf', 'excel', 'alcoa'],
      'Production': ['production', 'manufacturing', 'packaging', 'labeling', 'batch', 'contamination', 'cross-contamination', 'cleaning', 'processing'],
      'Quality Control': ['quality control', 'qc', 'analytical', 'lab', 'laboratory', 'test', 'reagent', 'sample', 'oos', 'out of specification', 'stability'],
      'Supplier Management': ['supplier', 'vendor', 'contract', 'outsourced', 'audit', 'agreement', 'technical agreement'],
      'Quality System': ['deviation', 'capa', 'non-conformance', 'quality system', 'pqs', 'oops', 'audit', 'self-inspection', 'recall', 'complaint'],
    };

    for (const req of requirements) {
      const reqText = `${req.chapter} ${req.title} ${req.requirementText} ${req.category}`.toLowerCase();
      let matchCount = 0;

      // Count matched keywords of target category
      const keywords = categoryKeywords[req.category] || [];
      for (const keyword of keywords) {
        if (textToAnalyze.includes(keyword) && reqText.includes(keyword)) {
          matchCount += 2; // High weight for category-specific keywords
        }
      }

      // General string match checks
      const titleWords = req.title.toLowerCase().split(/\s+/);
      for (const word of titleWords) {
        if (word.length > 4 && textToAnalyze.includes(word)) {
          matchCount++;
        }
      }

      if (matchCount > maxMatchedKeywords) {
        maxMatchedKeywords = matchCount;
        bestMatch = req;
      }
    }

    // Fallback to first requirement if no keywords match
    const matchedRequirement = bestMatch || requirements[0];

    // 4. Create the Requirement Relationship for the Deviation
    await prisma.requirementRelationship.create({
      data: {
        requirementId: matchedRequirement.id,
        targetType: 'DEVIATION',
        targetId: deviation.id,
        targetTitle: deviation.title,
        relationshipType: 'LINKED_TO',
      },
    });

    // 5. Auto-Generate the CAPA
    const actionPlan = `CORRECTIVE ACTION:
Investigate root cause of the deviation: "${deviation.description}".
Verify compliance against regulatory requirement ${matchedRequirement.requirementId} (${matchedRequirement.title}).

PREVENTIVE ACTION REQUIRED EVIDENCE:
Provide the following evidence as defined in GxP regulations:
${matchedRequirement.expectedEvidence}`;

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30); // 30 days default due date for CAPAs

    const capa = await prisma.cAPA.create({
      data: {
        tenantId: deviation.tenantId,
        title: `CAPA: Remediation of ${matchedRequirement.requirementId} deficit`,
        actionPlan,
        status: 'OPEN',
        dueDate,
        assignedToId: deviation.detectedById, // Auto-assign to the person who reported the deviation
        deviationId: deviation.id,
      },
    });

    // 6. Link the CAPA to the Regulation
    await prisma.requirementRelationship.create({
      data: {
        requirementId: matchedRequirement.id,
        targetType: 'CAPA',
        targetId: capa.id,
        targetTitle: capa.title,
        relationshipType: 'MITIGATED_BY',
      },
    });

    // 7. Log Audit Trail
    await logAuditEvent({
      tenantId: deviation.tenantId,
      userId: operatorUser.id,
      userEmail: operatorUser.email,
      userRole: operatorUser.role,
      action: 'AI.AutoMapAndCapa',
      objectType: 'Deviation',
      objectId: deviation.id,
      payload: {
        deviationId: deviation.id,
        mappedRequirementId: matchedRequirement.requirementId,
        mappedRequirementTitle: matchedRequirement.title,
        capaId: capa.id,
        actionPlanCreated: actionPlan,
      },
      status: 'Success',
      requestUrl: '/api/deviations',
    });

    return {
      matchedRequirement,
      capa,
    };
  } catch (error) {
    console.error('Error in autoMapDeviationAndCreateCapa:', error);
    return null;
  }
}
