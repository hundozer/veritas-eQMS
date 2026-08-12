-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "phone" TEXT,
    "profilePicture" TEXT,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "accountStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "role" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "businessUnit" TEXT,
    "site" TEXT NOT NULL DEFAULT 'Main Facility',
    "location" TEXT,
    "country" TEXT DEFAULT 'Germany',
    "employmentType" TEXT NOT NULL DEFAULT 'EMPLOYEE',
    "trainingStatus" TEXT NOT NULL DEFAULT 'QUALIFIED',
    "digitalSignatureEnabled" BOOLEAN NOT NULL DEFAULT true,
    "signatureAuthorityLevel" TEXT NOT NULL DEFAULT 'LEVEL_1',
    "approvalAuthorityLevel" TEXT NOT NULL DEFAULT 'LEVEL_1',
    "clearance" TEXT NOT NULL DEFAULT 'INTERNAL',
    "expiresAt" TIMESTAMP(3),
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "classification" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "currentVersionNumber" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentVersion" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileData" TEXT,
    "hash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRoute" (
    "id" TEXT NOT NULL,
    "documentVersionId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRouteStep" (
    "id" TEXT NOT NULL,
    "approvalRouteId" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3),
    "comment" TEXT,

    CONSTRAINT "ApprovalRouteStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignatureManifest" (
    "id" TEXT NOT NULL,
    "documentVersionId" TEXT NOT NULL,
    "signedBy" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meaning" TEXT NOT NULL,
    "hashSigned" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,

    CONSTRAINT "SignatureManifest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingRequirement" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "requiredForRoles" TEXT NOT NULL,
    "requiresQuiz" BOOLEAN NOT NULL DEFAULT false,
    "quizQuestions" TEXT,

    CONSTRAINT "TrainingRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingAssignment" (
    "id" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "quizResultId" TEXT,

    CONSTRAINT "TrainingAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizResult" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeRequest" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeRequestDocument" (
    "changeRequestId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,

    CONSTRAINT "ChangeRequestDocument_pkey" PRIMARY KEY ("changeRequestId","documentId")
);

-- CreateTable
CREATE TABLE "Deviation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "classification" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "detectedById" TEXT NOT NULL,
    "investigatorId" TEXT,
    "investigationNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "equipmentId" TEXT,

    CONSTRAINT "Deviation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CAPA" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "actionPlan" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "assignedToId" TEXT NOT NULL,
    "deviationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CAPA_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "userEmail" TEXT,
    "userRole" TEXT,
    "action" TEXT NOT NULL,
    "objectType" TEXT NOT NULL,
    "objectId" TEXT,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "sourceIp" TEXT,
    "requestUrl" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equipment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "modelNumber" TEXT,
    "serialNumber" TEXT,
    "location" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "calibrationIntervalDays" INTEGER NOT NULL,
    "lastCalibratedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextCalibrationDueDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceLog" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "performedById" TEXT NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activityType" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "esignSignatureId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "riskClassification" TEXT NOT NULL,
    "qualificationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reEvaluationDueDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierAttachment" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileData" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierAudit" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "auditorId" TEXT NOT NULL,
    "auditDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "auditType" TEXT NOT NULL,
    "findings" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "esignSignatureId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialReceipt" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "materialName" TEXT NOT NULL,
    "lotNumber" TEXT NOT NULL,
    "quantityReceived" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "inspectionStatus" TEXT NOT NULL,
    "inspectedById" TEXT NOT NULL,
    "notes" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditPlan" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "auditType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "completedDate" TIMESTAMP(3),
    "leadAuditorId" TEXT NOT NULL,
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditFinding" (
    "id" TEXT NOT NULL,
    "auditPlanId" TEXT NOT NULL,
    "classification" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "capaId" TEXT,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "link" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Regulation" (
    "id" TEXT NOT NULL,
    "regulationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "authority" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Regulation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegulationVersion" (
    "id" TEXT NOT NULL,
    "regulationId" TEXT NOT NULL,
    "versionNumber" TEXT NOT NULL,
    "publicationDate" TIMESTAMP(3) NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "previousVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegulationVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceDocument" (
    "id" TEXT NOT NULL,
    "regulationVersionId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "contentHash" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chapter" (
    "id" TEXT NOT NULL,
    "regulationVersionId" TEXT NOT NULL,
    "chapterNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chapter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Section" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "sectionNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Requirement" (
    "id" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "paragraphReference" TEXT NOT NULL,
    "originalWording" TEXT NOT NULL,
    "pageNumber" INTEGER,
    "riskClassification" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "keywords" TEXT NOT NULL,
    "qualityArea" TEXT NOT NULL,
    "importDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parserVersion" TEXT NOT NULL DEFAULT '1.0',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Requirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantRequirementAssessment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "applicability" TEXT NOT NULL DEFAULT 'NOT_ASSESSED',
    "justification" TEXT,
    "implementationStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "interpretation" TEXT,
    "aiInterpretation" TEXT,
    "ownerId" TEXT,
    "reviewDate" TIMESTAMP(3),
    "comments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantRequirementAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantRequirementMapping" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetTitle" TEXT NOT NULL,
    "mappingType" TEXT NOT NULL DEFAULT 'SATISFIES',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantRequirementMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IamUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mfaSecret" TEXT,
    "accountStatus" TEXT NOT NULL DEFAULT 'INVITED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLogin" TIMESTAMP(3),
    "lastPasswordChange" TIMESTAMP(3),

    CONSTRAINT "IamUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IamOrganization" (
    "id" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "subscriptionPlan" TEXT NOT NULL DEFAULT 'TRIAL',
    "status" TEXT NOT NULL DEFAULT 'TRIAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IamOrganization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IamMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdBy" TEXT,
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IamMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IamProductSubscription" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'INACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IamProductSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IamRole" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "IamRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IamPermission" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "IamPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IamRolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "IamRolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "IamSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "location" TEXT DEFAULT 'Unknown',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IamSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IamAuditTrail" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "userId" TEXT,
    "userEmail" TEXT NOT NULL,
    "userRole" TEXT,
    "action" TEXT NOT NULL,
    "objectType" TEXT NOT NULL,
    "objectId" TEXT,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "ipAddress" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IamAuditTrail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "SignatureManifest_documentVersionId_key" ON "SignatureManifest"("documentVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingRequirement_documentId_key" ON "TrainingRequirement"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingAssignment_quizResultId_key" ON "TrainingAssignment"("quizResultId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditLog_eventId_key" ON "AuditLog"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "Regulation_regulationId_key" ON "Regulation"("regulationId");

-- CreateIndex
CREATE UNIQUE INDEX "RegulationVersion_previousVersionId_key" ON "RegulationVersion"("previousVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "Requirement_requirementId_key" ON "Requirement"("requirementId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantRequirementAssessment_tenantId_requirementId_key" ON "TenantRequirementAssessment"("tenantId", "requirementId");

-- CreateIndex
CREATE UNIQUE INDEX "IamUser_email_key" ON "IamUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "IamMembership_userId_organizationId_key" ON "IamMembership"("userId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "IamProductSubscription_organizationId_productName_key" ON "IamProductSubscription"("organizationId", "productName");

-- CreateIndex
CREATE UNIQUE INDEX "IamRole_name_key" ON "IamRole"("name");

-- CreateIndex
CREATE UNIQUE INDEX "IamPermission_name_key" ON "IamPermission"("name");

-- CreateIndex
CREATE UNIQUE INDEX "IamSession_refreshToken_key" ON "IamSession"("refreshToken");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRoute" ADD CONSTRAINT "ApprovalRoute_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "DocumentVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRouteStep" ADD CONSTRAINT "ApprovalRouteStep_approvalRouteId_fkey" FOREIGN KEY ("approvalRouteId") REFERENCES "ApprovalRoute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRouteStep" ADD CONSTRAINT "ApprovalRouteStep_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureManifest" ADD CONSTRAINT "SignatureManifest_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "DocumentVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureManifest" ADD CONSTRAINT "SignatureManifest_signedBy_fkey" FOREIGN KEY ("signedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingRequirement" ADD CONSTRAINT "TrainingRequirement_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingAssignment" ADD CONSTRAINT "TrainingAssignment_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "TrainingRequirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingAssignment" ADD CONSTRAINT "TrainingAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingAssignment" ADD CONSTRAINT "TrainingAssignment_quizResultId_fkey" FOREIGN KEY ("quizResultId") REFERENCES "QuizResult"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizResult" ADD CONSTRAINT "QuizResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeRequestDocument" ADD CONSTRAINT "ChangeRequestDocument_changeRequestId_fkey" FOREIGN KEY ("changeRequestId") REFERENCES "ChangeRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeRequestDocument" ADD CONSTRAINT "ChangeRequestDocument_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deviation" ADD CONSTRAINT "Deviation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deviation" ADD CONSTRAINT "Deviation_detectedById_fkey" FOREIGN KEY ("detectedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deviation" ADD CONSTRAINT "Deviation_investigatorId_fkey" FOREIGN KEY ("investigatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deviation" ADD CONSTRAINT "Deviation_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CAPA" ADD CONSTRAINT "CAPA_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CAPA" ADD CONSTRAINT "CAPA_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CAPA" ADD CONSTRAINT "CAPA_deviationId_fkey" FOREIGN KEY ("deviationId") REFERENCES "Deviation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceLog" ADD CONSTRAINT "MaintenanceLog_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceLog" ADD CONSTRAINT "MaintenanceLog_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierAttachment" ADD CONSTRAINT "SupplierAttachment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierAudit" ADD CONSTRAINT "SupplierAudit_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierAudit" ADD CONSTRAINT "SupplierAudit_auditorId_fkey" FOREIGN KEY ("auditorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialReceipt" ADD CONSTRAINT "MaterialReceipt_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialReceipt" ADD CONSTRAINT "MaterialReceipt_inspectedById_fkey" FOREIGN KEY ("inspectedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditPlan" ADD CONSTRAINT "AuditPlan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditPlan" ADD CONSTRAINT "AuditPlan_leadAuditorId_fkey" FOREIGN KEY ("leadAuditorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditFinding" ADD CONSTRAINT "AuditFinding_auditPlanId_fkey" FOREIGN KEY ("auditPlanId") REFERENCES "AuditPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditFinding" ADD CONSTRAINT "AuditFinding_capaId_fkey" FOREIGN KEY ("capaId") REFERENCES "CAPA"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegulationVersion" ADD CONSTRAINT "RegulationVersion_regulationId_fkey" FOREIGN KEY ("regulationId") REFERENCES "Regulation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegulationVersion" ADD CONSTRAINT "RegulationVersion_previousVersionId_fkey" FOREIGN KEY ("previousVersionId") REFERENCES "RegulationVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceDocument" ADD CONSTRAINT "SourceDocument_regulationVersionId_fkey" FOREIGN KEY ("regulationVersionId") REFERENCES "RegulationVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chapter" ADD CONSTRAINT "Chapter_regulationVersionId_fkey" FOREIGN KEY ("regulationVersionId") REFERENCES "RegulationVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requirement" ADD CONSTRAINT "Requirement_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantRequirementAssessment" ADD CONSTRAINT "TenantRequirementAssessment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantRequirementAssessment" ADD CONSTRAINT "TenantRequirementAssessment_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantRequirementAssessment" ADD CONSTRAINT "TenantRequirementAssessment_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantRequirementMapping" ADD CONSTRAINT "TenantRequirementMapping_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "TenantRequirementAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IamMembership" ADD CONSTRAINT "IamMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "IamUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IamMembership" ADD CONSTRAINT "IamMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "IamOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IamMembership" ADD CONSTRAINT "IamMembership_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "IamRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IamProductSubscription" ADD CONSTRAINT "IamProductSubscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "IamOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IamRolePermission" ADD CONSTRAINT "IamRolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "IamRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IamRolePermission" ADD CONSTRAINT "IamRolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "IamPermission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IamSession" ADD CONSTRAINT "IamSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "IamUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IamAuditTrail" ADD CONSTRAINT "IamAuditTrail_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "IamOrganization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IamAuditTrail" ADD CONSTRAINT "IamAuditTrail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "IamUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
