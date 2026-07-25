const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  await prisma.cAPA.deleteMany({});
  await prisma.deviation.deleteMany({});
  await prisma.changeRequestDocument.deleteMany({});
  await prisma.changeRequest.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.quizResult.deleteMany({});
  await prisma.trainingAssignment.deleteMany({});
  await prisma.trainingRequirement.deleteMany({});
  await prisma.signatureManifest.deleteMany({});
  await prisma.approvalRouteStep.deleteMany({});
  await prisma.approvalRoute.deleteMany({});
  await prisma.documentVersion.deleteMany({});
  await prisma.document.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.tenant.deleteMany({});

  // 1. Create Tenants
  const acme = await prisma.tenant.create({
    data: {
      name: 'Acme Biotech',
    },
  });

  const biolabs = await prisma.tenant.create({
    data: {
      name: 'BioLabs Inc',
    },
  });

  console.log('Created Tenants');

  // 2. Create Users for Acme
  const acmeAdmin = await prisma.user.create({
    data: {
      email: 'admin@acme.com',
      fullName: 'Alice QA Admin',
      role: 'ADMIN',
      department: 'QA',
      clearance: 'RESTRICTED',
      tenantId: acme.id,
    },
  });

  const acmeOwner = await prisma.user.create({
    data: {
      email: 'owner@acme.com',
      fullName: 'Bob Owner',
      role: 'OWNER',
      department: 'QA',
      clearance: 'RESTRICTED',
      tenantId: acme.id,
    },
  });

  const acmeApprover = await prisma.user.create({
    data: {
      email: 'approver@acme.com',
      fullName: 'Charlie Approver',
      role: 'APPROVER',
      department: 'PRODUCTION',
      clearance: 'RESTRICTED',
      tenantId: acme.id,
    },
  });

  const acmeEmployee = await prisma.user.create({
    data: {
      email: 'employee@acme.com',
      fullName: 'Dave Employee',
      role: 'EMPLOYEE',
      department: 'ENGINEERING',
      clearance: 'INTERNAL',
      tenantId: acme.id,
    },
  });

  const acmeAuditor = await prisma.user.create({
    data: {
      email: 'auditor@acme.com',
      fullName: 'Emily Auditor',
      role: 'AUDITOR',
      department: 'EXTERNAL',
      clearance: 'INTERNAL',
      tenantId: acme.id,
    },
  });

  // Create Users for BioLabs (for tenant isolation verification)
  const biolabsAdmin = await prisma.user.create({
    data: {
      email: 'admin@biolabs.com',
      fullName: 'Brian BioLabs Admin',
      role: 'ADMIN',
      department: 'QA',
      clearance: 'RESTRICTED',
      tenantId: biolabs.id,
    },
  });

  const biolabsEmployee = await prisma.user.create({
    data: {
      email: 'employee@biolabs.com',
      fullName: 'Edward BioLabs Employee',
      role: 'EMPLOYEE',
      department: 'PRODUCTION',
      clearance: 'INTERNAL',
      tenantId: biolabs.id,
    },
  });

  console.log('Created Users');

  // 3. Create Documents in Acme
  // Draft Document (SOP-101)
  const doc1 = await prisma.document.create({
    data: {
      title: 'SOP-101: Standard Operating Procedure for Lab Access',
      description: 'Defines safety guidelines and protocols for entering GxP clean rooms.',
      classification: 'CONTROLLED',
      status: 'DRAFT',
      ownerId: acmeOwner.id,
      tenantId: acme.id,
      currentVersionNumber: 1,
    },
  });

  await prisma.documentVersion.create({
    data: {
      documentId: doc1.id,
      versionNumber: 1,
      filePath: 'drafts/SOP-101-v1.pdf',
      hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', // empty file hash
      createdBy: acmeOwner.fullName,
    },
  });

  // Effective Document (SOP-102) with full training & quiz
  const doc2 = await prisma.document.create({
    data: {
      title: 'SOP-102: Standard Operating Procedure for Documentation Control',
      description: 'Specifies document authoring, reviewing, approval, and retention rules.',
      classification: 'CONTROLLED',
      status: 'EFFECTIVE',
      ownerId: acmeOwner.id,
      tenantId: acme.id,
      currentVersionNumber: 1,
    },
  });

  const doc2Version = await prisma.documentVersion.create({
    data: {
      documentId: doc2.id,
      versionNumber: 1,
      filePath: 'effective/SOP-102-v1.pdf',
      hash: '8f43c5b3648fa39e6a32d1e2b4f9958ae49f50e82c589a195ca195fb7852c811',
      createdBy: acmeOwner.fullName,
    },
  });

  // Create Signature Manifest for released document (SOP-102)
  await prisma.signatureManifest.create({
    data: {
      documentVersionId: doc2Version.id,
      signedBy: acmeApprover.id,
      meaning: 'Approval of Document Release',
      hashSigned: '8f43c5b3648fa39e6a32d1e2b4f9958ae49f50e82c589a195ca195fb7852c811-CHARLIE-APPROVED',
      ipAddress: '192.168.1.50',
    },
  });

  console.log('Created Documents and Versions');

  // 4. Create Training Requirement for SOP-102 (Acme)
  const quizQuestions = [
    {
      id: 'q1',
      text: 'What is the correct way to correct a handwritten error on a GxP document?',
      options: [
        'Use white-out/correction fluid',
        'Draw a single line through it, write correction, then initial and date',
        'Scribble it out completely so it cannot be read'
      ],
      correctAnswerIndex: 1
    },
    {
      id: 'q2',
      text: 'Who must approve a critical SOP change before it becomes effective?',
      options: [
        'The document owner only',
        'QA department / Authorized Approvers',
        'No approval is needed'
      ],
      correctAnswerIndex: 1
    }
  ];

  const trainingReq = await prisma.trainingRequirement.create({
    data: {
      documentId: doc2.id,
      requiredForRoles: 'EMPLOYEE,OWNER',
      requiresQuiz: true,
      quizQuestions: JSON.stringify(quizQuestions),
    },
  });

  // Training Assignments
  // Dave Employee has NOT completed the training
  await prisma.trainingAssignment.create({
    data: {
      requirementId: trainingReq.id,
      userId: acmeEmployee.id,
      status: 'ASSIGNED',
    },
  });

  // Bob Owner HAS completed the training (scored 100%)
  const bobQuizResult = await prisma.quizResult.create({
    data: {
      userId: acmeOwner.id,
      score: 100,
      passed: true,
    },
  });

  await prisma.trainingAssignment.create({
    data: {
      requirementId: trainingReq.id,
      userId: acmeOwner.id,
      status: 'COMPLETED',
      completedAt: new Date(),
      quizResultId: bobQuizResult.id,
    },
  });

  console.log('Created Training Requirements, Quizzes, and Assignments');

  // 5. Initial Audit Logs
  await prisma.auditLog.create({
    data: {
      tenantId: acme.id,
      eventId: 'a63fd9d5-45bb-41a9-b690-3b91a788c42b',
      timestamp: new Date(Date.now() - 3600000 * 2), // 2 hours ago
      userId: acmeOwner.id,
      userEmail: acmeOwner.email,
      userRole: acmeOwner.role,
      action: 'Document.Create',
      objectType: 'Document',
      objectId: doc1.id,
      payload: JSON.stringify({
        title: doc1.title,
        classification: doc1.classification,
        status: doc1.status,
      }),
      status: 'Success',
      sourceIp: '192.168.1.10',
      requestUrl: '/api/v1/documents',
    },
  });

  await prisma.auditLog.create({
    data: {
      tenantId: acme.id,
      eventId: '2be0b8fb-b8c7-43cf-8703-a212260408ab',
      timestamp: new Date(Date.now() - 3600000), // 1 hour ago
      userId: acmeApprover.id,
      userEmail: acmeApprover.email,
      userRole: acmeApprover.role,
      action: 'Document.Approve',
      objectType: 'Document',
      objectId: doc2.id,
      payload: JSON.stringify({
        title: doc2.title,
        version: 1,
        esignMeaning: 'Approval of Document Release',
      }),
      status: 'Success',
      sourceIp: '192.168.1.50',
      requestUrl: `/api/v1/documents/${doc2.id}/approve`,
    },
  });

  console.log('Created Audit Logs');

  // 6. Create mock Change Requests
  const cr = await prisma.changeRequest.create({
    data: {
      title: 'CR-2026-001: Revision of Documentation Control Guidelines',
      reason: 'Update the review cycle parameters from 30 days to 90 days as per current industry QA standards.',
      riskLevel: 'MEDIUM',
      status: 'UNDER_REVIEW',
    }
  });

  await prisma.changeRequestDocument.create({
    data: {
      changeRequestId: cr.id,
      documentId: doc2.id
    }
  });

  console.log('Created Change Requests');

  // 7. Create mock Deviations and CAPAs
  const dev = await prisma.deviation.create({
    data: {
      tenantId: acme.id,
      title: 'DEV-2026-001: Temperature Excursion in Cleanroom B',
      description: 'Cleanroom B experienced a temperature spike up to 24.5C for 45 minutes, exceeding the validated limit of 22.0C.',
      classification: 'MAJOR',
      status: 'UNDER_INVESTIGATION',
      detectedById: acmeEmployee.id,
      investigatorId: acmeApprover.id,
      investigationNotes: 'Spike caused by HVAC unit fan belt failure. Belt replaced immediately. Currently performing impact assessment on active batches in the room.',
    }
  });

  await prisma.cAPA.create({
    data: {
      tenantId: acme.id,
      title: 'CAPA-2026-001: Cleanroom HVAC PM Schedule Revision',
      actionPlan: 'Revise the preventative maintenance (PM) schedule for HVAC fan belts from annually to semi-annually to prevent unexpected runtime failures.',
      status: 'OPEN',
      dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30), // 30 days out
      assignedToId: acmeEmployee.id,
      deviationId: dev.id,
    }
  });

  console.log('Created Deviations & CAPAs');
  console.log('Seeding finished successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
