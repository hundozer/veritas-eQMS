import prisma from '@/lib/db';

export interface ComplianceHealthResult {
  overallScore: number;
  grade: 'A+' | 'A' | 'B' | 'C' | 'CRITICAL';
  statusLabel: string;
  metrics: {
    trainingCompliancePct: number;
    openCapasCount: number;
    overdueCapasCount: number;
    openDeviationsCount: number;
    equipmentCalibrationDueCount: number;
    effectiveDocumentsCount: number;
    draftDocumentsCount: number;
  };
  recommendations: Array<{
    id: string;
    standard: 'EU Annex 11' | '21 CFR Part 11' | 'ISO 13485:2016' | 'EU GMP';
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
    title: string;
    actionRequired: string;
  }>;
  impactGraph: Array<{
    sourceType: 'Document' | 'Deviation' | 'Equipment' | 'ChangeRequest';
    sourceName: string;
    impactedDomain: string;
    riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
    detail: string;
  }>;
}

export async function calculateTenantComplianceHealth(tenantId: string): Promise<ComplianceHealthResult> {
  const now = new Date();

  // 1. Fetch Tenant GxP Entities & EU GMP Requirements
  const [
    documents,
    trainings,
    capas,
    deviations,
    equipmentList,
    requirements,
  ] = await Promise.all([
    prisma.document.findMany({ where: { tenantId } }),
    prisma.trainingAssignment.findMany({
      where: { user: { tenantId } },
      include: { requirement: { include: { document: true } } },
    }),
    prisma.cAPA.findMany({ where: { tenantId } }),
    prisma.deviation.findMany({ where: { tenantId } }),
    prisma.equipment.findMany({ where: { tenantId } }),
    prisma.regulatoryRequirement.findMany({
      include: { relationships: true },
    }),
  ]);

  // 2. Training Compliance Score
  const totalTrainings = trainings.length;
  const completedTrainings = trainings.filter(t => t.status === 'COMPLETED').length;
  const trainingCompliancePct = totalTrainings > 0
    ? Math.round((completedTrainings / totalTrainings) * 100)
    : 100;

  // 3. EU GMP Regulatory Coverage Score
  const totalReqs = requirements.length;
  const mappedReqs = requirements.filter(r => r.relationships.length > 0).length;
  const regulatoryCoveragePct = totalReqs > 0 ? Math.round((mappedReqs / totalReqs) * 100) : 100;

  // 4. CAPA Risk Metrics
  const openCapas = capas.filter(c => c.status !== 'CLOSED');
  const overdueCapas = openCapas.filter(c => new Date(c.dueDate) < now);

  // 5. Deviation Metrics
  const openDeviations = deviations.filter(d => d.status !== 'CLOSED');

  // 6. Equipment Calibration Metrics
  const equipmentDue = equipmentList.filter(e => new Date(e.nextCalibrationDueDate) <= now || e.status === 'CALIBRATION_DUE');

  // 7. Compute Weighted Audit Readiness Health Score
  // Base 100, deduction penalties for GxP non-conformances
  let scoreDeductions = 0;

  // Penalty for incomplete training
  scoreDeductions += (100 - trainingCompliancePct) * 0.30;

  // Penalty for unmapped regulatory requirements
  scoreDeductions += (100 - regulatoryCoveragePct) * 0.20;

  // Penalty for overdue CAPAs (15 pts per overdue CAPA)
  scoreDeductions += overdueCapas.length * 15;

  // Penalty for open deviations (5 pts per open deviation)
  scoreDeductions += openDeviations.length * 5;

  // Penalty for overdue equipment calibrations (10 pts per equipment)
  scoreDeductions += equipmentDue.length * 10;

  const rawScore = Math.max(0, Math.min(100, Math.round(100 - scoreDeductions)));

  let grade: ComplianceHealthResult['grade'] = 'A+';
  let statusLabel = 'Audit Ready';

  if (rawScore >= 95) {
    grade = 'A+';
    statusLabel = '100% Audit Ready — Continuous Compliance';
  } else if (rawScore >= 85) {
    grade = 'A';
    statusLabel = 'Audit Compliant — Minor Action Items';
  } else if (rawScore >= 70) {
    grade = 'B';
    statusLabel = 'Attention Required — Open GxP Actions';
  } else if (rawScore >= 50) {
    grade = 'C';
    statusLabel = 'Audit Vulnerability Detected';
  } else {
    grade = 'CRITICAL';
    statusLabel = 'Non-Compliance Risk — Immediate Remediation Required';
  }

  // 8. Generate Intelligent GxP Recommendations
  const recommendations: ComplianceHealthResult['recommendations'] = [];

  if (regulatoryCoveragePct < 90) {
    recommendations.push({
      id: 'rec-eugmp-gap',
      standard: 'EU GMP',
      severity: 'HIGH',
      title: 'EU GMP Regulatory Coverage Deficit',
      actionRequired: `Current EU GMP Volume 4 evidence coverage is ${regulatoryCoveragePct}%. Link SOP documents and internal audits to unmapped requirements in Regulatory Intelligence.`,
    });
  }

  if (overdueCapas.length > 0) {
    recommendations.push({
      id: 'rec-capa-overdue',
      standard: 'EU GMP',
      severity: 'CRITICAL',
      title: 'Overdue Corrective & Preventive Action (CAPA)',
      actionRequired: `Resolve ${overdueCapas.length} overdue CAPA record(s) immediately to prevent FDA Form 483 / EU Annex 11 inspection findings.`,
    });
  }

  if (trainingCompliancePct < 90) {
    recommendations.push({
      id: 'rec-training-gap',
      standard: 'ISO 13485:2016',
      severity: 'HIGH',
      title: 'Training Matrix Completion Deficit',
      actionRequired: `Current tenant training compliance is ${trainingCompliancePct}%. Require role-based SOP sign-off to reach >90% compliance.`,
    });
  }

  if (equipmentDue.length > 0) {
    recommendations.push({
      id: 'rec-equip-cal',
      standard: '21 CFR Part 11',
      severity: 'HIGH',
      title: 'Equipment Calibration Overdue',
      actionRequired: `${equipmentDue.length} GxP laboratory/manufacturing instrument(s) are past calibration due date. Log maintenance sign-off.`,
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      id: 'rec-all-clear',
      standard: 'EU Annex 11',
      severity: 'MEDIUM',
      title: 'Continuous Regulatory Validation Active',
      actionRequired: 'All automated GxP checks passed. Schedule next routine internal audit.',
    });
  }

  // 8. Generate Impact Graph
  const impactGraph: ComplianceHealthResult['impactGraph'] = [];

  overdueCapas.forEach(c => {
    impactGraph.push({
      sourceType: 'Deviation',
      sourceName: c.title,
      impactedDomain: 'CAPA Resolution',
      riskLevel: 'HIGH',
      detail: `Overdue CAPA assigned to user ID ${c.assignedToId.substring(0, 8)}`,
    });
  });

  equipmentDue.forEach(e => {
    impactGraph.push({
      sourceType: 'Equipment',
      sourceName: e.name,
      impactedDomain: 'Quality Control / Testing',
      riskLevel: 'HIGH',
      detail: `Instrument out of calibration at ${e.location}`,
    });
  });

  return {
    overallScore: rawScore,
    grade,
    statusLabel,
    metrics: {
      trainingCompliancePct,
      openCapasCount: openCapas.length,
      overdueCapasCount: overdueCapas.length,
      openDeviationsCount: openDeviations.length,
      equipmentCalibrationDueCount: equipmentDue.length,
      effectiveDocumentsCount: documents.filter(d => d.status === 'EFFECTIVE').length,
      draftDocumentsCount: documents.filter(d => d.status === 'DRAFT').length,
    },
    recommendations,
    impactGraph,
  };
}
