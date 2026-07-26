import prisma from '@/lib/db';

export interface EUGMPRequirementSeed {
  requirementId: string;
  chapter: string;
  section: string;
  title: string;
  category: string;
  riskLevel: 'CRITICAL' | 'MAJOR' | 'MINOR' | 'INFORMATIONAL';
  requirementText: string;
  expectedEvidence: string;
  applicableAreas: string[];
  affectedProcesses: string[];
}

export const EU_GMP_CHAPTERS = [
  'Chapter 1: Pharmaceutical Quality System',
  'Chapter 2: Personnel',
  'Chapter 3: Premises and Equipment',
  'Chapter 4: Documentation',
  'Chapter 5: Production',
  'Chapter 6: Quality Control',
  'Chapter 7: Outsourced Activities',
  'Chapter 8: Complaints and Product Recall',
  'Chapter 9: Self Inspection',
];

export const QUALITY_TAXONOMY_AREAS = [
  'Quality System',
  'Documentation',
  'Personnel',
  'Production',
  'Laboratory Control',
  'Supplier Management',
  'Validation',
  'Data Integrity',
];

export const INITIAL_EU_GMP_REQUIREMENTS: EUGMPRequirementSeed[] = [
  // Chapter 1: Pharmaceutical Quality System
  {
    requirementId: 'EU-GMP-CH1-001',
    chapter: 'Chapter 1: Pharmaceutical Quality System',
    section: '1.4',
    title: 'Pharmaceutical Quality System (PQS) Architecture & Oversight',
    category: 'Quality System',
    riskLevel: 'CRITICAL',
    requirementText: 'The manufacturer must design, establish, document, and maintain a comprehensive Pharmaceutical Quality System (PQS) ensuring product quality, management commitment, and active participation of senior executive leadership.',
    expectedEvidence: 'Approved Quality Manual, PQS Management Review Minutes, Senior Leadership Signed Quality Policy, Org Chart with independent QA reporting line.',
    applicableAreas: ['Quality Assurance', 'Executive Leadership', 'Regulatory Affairs'],
    affectedProcesses: ['Audit', 'Change Control', 'Training', 'Document Management'],
  },
  {
    requirementId: 'EU-GMP-CH1-002',
    chapter: 'Chapter 1: Pharmaceutical Quality System',
    section: '1.8',
    title: 'Product Quality Review (PQR) & Quality Risk Management (QRM)',
    category: 'Quality System',
    riskLevel: 'MAJOR',
    requirementText: 'Regular, annual product quality reviews (PQRs) must be conducted for all authorized medicinal products to verify process consistency, appropriateness of specifications, and identify trends.',
    expectedEvidence: 'Completed annual PQR reports, Trend analysis charts for active batches, Quality Risk Management (QRM) risk assessments (ICH Q9).',
    applicableAreas: ['Quality Assurance', 'Quality Control', 'Production'],
    affectedProcesses: ['Document Management', 'Audit', 'Change Control'],
  },

  // Chapter 2: Personnel
  {
    requirementId: 'EU-GMP-CH2-001',
    chapter: 'Chapter 2: Personnel',
    section: '2.4',
    title: 'Key Personnel Qualification & Functional Independence',
    category: 'Personnel',
    riskLevel: 'CRITICAL',
    requirementText: 'Key Personnel including the Head of Production, Head of Quality Control, and Qualified Person (QP) must possess distinct responsibilities, verified academic qualifications, and complete functional independence.',
    expectedEvidence: 'Job descriptions signed by QP/QA Head, Qualified Person authorization registry, Diplomas, CVs, and delegation of authority logs.',
    applicableAreas: ['Quality Assurance', 'Human Resources', 'Production', 'Quality Control'],
    affectedProcesses: ['Training', 'Document Management'],
  },
  {
    requirementId: 'EU-GMP-CH2-002',
    chapter: 'Chapter 2: Personnel',
    section: '2.11',
    title: 'Initial & Continuing GxP Training Program',
    category: 'Personnel',
    riskLevel: 'MAJOR',
    requirementText: 'The manufacturer must provide GxP training for all personnel whose duties take them into manufacturing areas or control laboratories, with regular effectiveness assessments.',
    expectedEvidence: 'Role-based training matrices, Signed GxP training completion certificates, Quiz logs, Retraining records following SOP revisions.',
    applicableAreas: ['Quality Assurance', 'Production', 'Quality Control'],
    affectedProcesses: ['Training', 'Change Control'],
  },

  // Chapter 3: Premises and Equipment
  {
    requirementId: 'EU-GMP-CH3-001',
    chapter: 'Chapter 3: Premises and Equipment',
    section: '3.6',
    title: 'Premises Design & Cross-Contamination Prevention (HVAC)',
    category: 'Production',
    riskLevel: 'CRITICAL',
    requirementText: 'Premises must be designed, located, constructed, and maintained to suit the operations to be carried out, minimizing risk of errors and cross-contamination.',
    expectedEvidence: 'HVAC Qualification Protocols (DQ/IQ/OQ/PQ), Differential pressure logs, Environmental Monitoring (EM) reports, Airflow pattern studies.',
    applicableAreas: ['Engineering', 'Production', 'Quality Assurance'],
    affectedProcesses: ['Audit', 'Deviation'],
  },
  {
    requirementId: 'EU-GMP-CH3-002',
    chapter: 'Chapter 3: Premises and Equipment',
    section: '3.34',
    title: 'Equipment Maintenance, Calibration & Qualification',
    category: 'Validation',
    riskLevel: 'MAJOR',
    requirementText: 'Manufacturing and control equipment must be designed, located, and maintained to suit its intended purpose, with calibrated measuring instrumentation.',
    expectedEvidence: 'Equipment Calibration Certificates, Preventative Maintenance (PM) logs, Out-of-Tolerance impact assessments, Equipment Qualification Dossiers.',
    applicableAreas: ['Engineering', 'Quality Control', 'Production'],
    affectedProcesses: ['Deviation', 'Audit'],
  },

  // Chapter 4: Documentation
  {
    requirementId: 'EU-GMP-CH4-001',
    chapter: 'Chapter 4: Documentation',
    section: '4.1',
    title: 'Documentation System Specifications & ALCOA+ Integrity',
    category: 'Documentation',
    riskLevel: 'CRITICAL',
    requirementText: 'Good documentation practices (GDocP) must be enforced. Documents must be designed, prepared, reviewed, and distributed with care, adhering to ALCOA+ principles.',
    expectedEvidence: 'Document Control SOP (SOP-QA-042), Audit Trail logs, Approved Master Document Templates, Single-line strikethrough correction evidence.',
    applicableAreas: ['Quality Assurance', 'Regulatory Affairs', 'Production', 'Quality Control'],
    affectedProcesses: ['Document Management', 'Change Control', 'Training', 'Audit'],
  },
  {
    requirementId: 'EU-GMP-CH4-002',
    chapter: 'Chapter 4: Documentation',
    section: '4.17',
    title: 'Batch Processing & Packaging Record Control',
    category: 'Documentation',
    riskLevel: 'MAJOR',
    requirementText: 'A Batch Processing Record must be kept for each batch processed. It must be based on relevant parts of the currently approved Master Formula and Processing Instructions.',
    expectedEvidence: 'Executed Batch Production Records (BPRs), Line clearance sign-offs, In-process check sheets, Batch release checklist signed by QA/QP.',
    applicableAreas: ['Production', 'Quality Assurance'],
    affectedProcesses: ['Document Management', 'Deviation', 'Audit'],
  },

  // Chapter 5: Production
  {
    requirementId: 'EU-GMP-CH5-001',
    chapter: 'Chapter 5: Production',
    section: '5.20',
    title: 'Cross-Contamination Avoidance & Toxicological Limits (HBEL)',
    category: 'Production',
    riskLevel: 'CRITICAL',
    requirementText: 'Contamination of a starting material or product by another material must be prevented. Dedicated facilities or campaign production backed by Health-Based Exposure Limits (HBEL) are mandatory.',
    expectedEvidence: 'Toxicological Evaluation Reports (PDE/ADE calculations), Cleaning Validation Studies, Dedicated suite containment qualification.',
    applicableAreas: ['Production', 'Quality Assurance', 'Validation'],
    affectedProcesses: ['Change Control', 'Deviation', 'Audit'],
  },

  // Chapter 6: Quality Control
  {
    requirementId: 'EU-GMP-CH6-001',
    chapter: 'Chapter 6: Quality Control',
    section: '6.15',
    title: 'Analytical Method Validation & Out-of-Specification (OOS) Procedures',
    category: 'Laboratory Control',
    riskLevel: 'CRITICAL',
    requirementText: 'Quality Control operations must ensure that necessary testing is performed and that materials are not released until their quality has been judged satisfactory.',
    expectedEvidence: 'Analytical Method Validation Reports (ICH Q2), OOS Investigation SOP, Re-testing protocols, Certificate of Analysis (CoA) records.',
    applicableAreas: ['Quality Control', 'Quality Assurance'],
    affectedProcesses: ['Deviation', 'Document Management', 'Audit'],
  },

  // Chapter 7: Outsourced Activities
  {
    requirementId: 'EU-GMP-CH7-001',
    chapter: 'Chapter 7: Outsourced Activities',
    section: '7.12',
    title: 'Technical Quality Agreements & Contract Acceptor Qualification',
    category: 'Supplier Management',
    riskLevel: 'MAJOR',
    requirementText: 'Any activity covered by the GMP Guide that is outsourced must be appropriately defined, agreed, and controlled in a written Technical Quality Agreement.',
    expectedEvidence: 'Executed Quality Agreements, Vendor Audit Reports, Contract Laboratory Qualification Dossiers, Supplier Evaluation Matrix.',
    applicableAreas: ['Quality Assurance', 'Supply Chain', 'Regulatory Affairs'],
    affectedProcesses: ['Audit', 'Change Control'],
  },

  // Chapter 8: Complaints and Product Recall
  {
    requirementId: 'EU-GMP-CH8-001',
    chapter: 'Chapter 8: Complaints and Product Recall',
    section: '8.10',
    title: 'Quality Defect Investigations & Rapid Recall Execution',
    category: 'Quality System',
    riskLevel: 'CRITICAL',
    requirementText: 'A system must be in place to record, evaluate, investigate, and review all quality defects and complaints, with mock recall capabilities capable of prompt execution at any time.',
    expectedEvidence: 'Product Complaint Log, Defect Classification SOP, Mock Recall Test Records (mock execution < 4 hours), Regulatory Notification Protocol.',
    applicableAreas: ['Quality Assurance', 'Regulatory Affairs', 'Executive Leadership'],
    affectedProcesses: ['Deviation', 'Audit', 'Change Control'],
  },

  // Chapter 9: Self Inspection
  {
    requirementId: 'EU-GMP-CH9-001',
    chapter: 'Chapter 9: Self Inspection',
    section: '9.1',
    title: 'Independent Internal Audit Program & CAPA Tracking',
    category: 'Quality System',
    riskLevel: 'MAJOR',
    requirementText: 'Self inspections must be conducted in order to monitor the implementation and compliance with Good Manufacturing Practice principles and to propose necessary corrective actions.',
    expectedEvidence: 'Annual Self-Inspection Schedule, Internal Audit Reports, Independent Lead Auditor appointment records, CAPA verification logs.',
    applicableAreas: ['Quality Assurance', 'Auditor'],
    affectedProcesses: ['Audit', 'Training', 'Document Management'],
  },
];

// Seed or update the EU GMP Volume 4 Knowledge Base in Postgres DB
export async function ensureEUGMPKnowledgeBaseSeeded(): Promise<string> {
  try {
    // 1. Ensure RegulationSource exists
    let regSource = await prisma.regulationSource.findUnique({
      where: { regulationId: 'EU-GMP-VOL4' },
    });

    if (!regSource) {
      regSource = await prisma.regulationSource.create({
        data: {
          regulationId: 'EU-GMP-VOL4',
          title: 'EU GMP Volume 4 — Medicinal Products for Human & Veterinary Use',
          authority: 'European Commission / European Medicines Agency (EMA)',
          region: 'European Union',
          version: 'EudraLex Vol 4 Current Revision',
          status: 'ACTIVE',
          lastReviewedDate: new Date(),
        },
      });
    }

    // 2. Upsert Requirements
    for (const reqSeed of INITIAL_EU_GMP_REQUIREMENTS) {
      await prisma.regulatoryRequirement.upsert({
        where: { requirementId: reqSeed.requirementId },
        update: {
          chapter: reqSeed.chapter,
          section: reqSeed.section,
          title: reqSeed.title,
          category: reqSeed.category,
          riskLevel: reqSeed.riskLevel,
          requirementText: reqSeed.requirementText,
          expectedEvidence: reqSeed.expectedEvidence,
          applicableAreas: JSON.stringify(reqSeed.applicableAreas),
          affectedProcesses: JSON.stringify(reqSeed.affectedProcesses),
          status: 'APPROVED',
        },
        create: {
          requirementId: reqSeed.requirementId,
          regulationSourceId: regSource.id,
          chapter: reqSeed.chapter,
          section: reqSeed.section,
          title: reqSeed.title,
          category: reqSeed.category,
          riskLevel: reqSeed.riskLevel,
          requirementText: reqSeed.requirementText,
          expectedEvidence: reqSeed.expectedEvidence,
          applicableAreas: JSON.stringify(reqSeed.applicableAreas),
          affectedProcesses: JSON.stringify(reqSeed.affectedProcesses),
          status: 'APPROVED',
          aiExtracted: false,
        },
      });
    }

    // 3. Ensure sample Knowledge Graph Relationships exist for tenant documents
    const doc102 = await prisma.document.findFirst({
      where: { title: { contains: 'SOP-102' } },
    });

    const ch4Req = await prisma.regulatoryRequirement.findUnique({
      where: { requirementId: 'EU-GMP-CH4-001' },
    });

    if (doc102 && ch4Req) {
      const existingRel = await prisma.requirementRelationship.findFirst({
        where: {
          requirementId: ch4Req.id,
          targetId: doc102.id,
        },
      });

      if (!existingRel) {
        await prisma.requirementRelationship.create({
          data: {
            requirementId: ch4Req.id,
            targetType: 'DOCUMENT',
            targetId: doc102.id,
            targetTitle: doc102.title,
            relationshipType: 'REQUIRES',
          },
        });
      }
    }

    return regSource.id;
  } catch (err) {
    console.error('Error seeding EU GMP Knowledge Base:', err);
    throw err;
  }
}
