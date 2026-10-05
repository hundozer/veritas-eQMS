-- Preserve inherited filesystem/Base64 fields while making private object storage
-- authoritative for newly created controlled document versions.
ALTER TABLE "DocumentVersion"
ADD COLUMN "storageKey" TEXT,
ADD COLUMN "originalFileName" TEXT,
ADD COLUMN "mimeType" TEXT,
ADD COLUMN "sizeBytes" INTEGER;

CREATE UNIQUE INDEX "DocumentVersion_storageKey_key" ON "DocumentVersion"("storageKey");
CREATE UNIQUE INDEX "DocumentVersion_documentId_versionNumber_key" ON "DocumentVersion"("documentId", "versionNumber");

-- Regulated evidence must not disappear through parent hard deletion.
ALTER TABLE "DocumentVersion" DROP CONSTRAINT "DocumentVersion_documentId_fkey";
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_documentId_fkey"
FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ApprovalRoute" DROP CONSTRAINT "ApprovalRoute_documentVersionId_fkey";
ALTER TABLE "ApprovalRoute" ADD CONSTRAINT "ApprovalRoute_documentVersionId_fkey"
FOREIGN KEY ("documentVersionId") REFERENCES "DocumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ApprovalRouteStep" DROP CONSTRAINT "ApprovalRouteStep_approvalRouteId_fkey";
ALTER TABLE "ApprovalRouteStep" ADD CONSTRAINT "ApprovalRouteStep_approvalRouteId_fkey"
FOREIGN KEY ("approvalRouteId") REFERENCES "ApprovalRoute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SignatureManifest" DROP CONSTRAINT "SignatureManifest_documentVersionId_fkey";
ALTER TABLE "SignatureManifest" ADD CONSTRAINT "SignatureManifest_documentVersionId_fkey"
FOREIGN KEY ("documentVersionId") REFERENCES "DocumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TrainingRequirement" DROP CONSTRAINT "TrainingRequirement_documentId_fkey";
ALTER TABLE "TrainingRequirement" ADD CONSTRAINT "TrainingRequirement_documentId_fkey"
FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TrainingAssignment" DROP CONSTRAINT "TrainingAssignment_requirementId_fkey";
ALTER TABLE "TrainingAssignment" ADD CONSTRAINT "TrainingAssignment_requirementId_fkey"
FOREIGN KEY ("requirementId") REFERENCES "TrainingRequirement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TrainingAssignment" DROP CONSTRAINT "TrainingAssignment_userId_fkey";
ALTER TABLE "TrainingAssignment" ADD CONSTRAINT "TrainingAssignment_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "QuizResult" DROP CONSTRAINT "QuizResult_userId_fkey";
ALTER TABLE "QuizResult" ADD CONSTRAINT "QuizResult_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ChangeRequestDocument" DROP CONSTRAINT "ChangeRequestDocument_documentId_fkey";
ALTER TABLE "ChangeRequestDocument" ADD CONSTRAINT "ChangeRequestDocument_documentId_fkey"
FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CAPA" DROP CONSTRAINT "CAPA_deviationId_fkey";
ALTER TABLE "CAPA" ADD CONSTRAINT "CAPA_deviationId_fkey"
FOREIGN KEY ("deviationId") REFERENCES "Deviation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MaintenanceLog" DROP CONSTRAINT "MaintenanceLog_equipmentId_fkey";
ALTER TABLE "MaintenanceLog" ADD CONSTRAINT "MaintenanceLog_equipmentId_fkey"
FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SupplierAudit" DROP CONSTRAINT "SupplierAudit_supplierId_fkey";
ALTER TABLE "SupplierAudit" ADD CONSTRAINT "SupplierAudit_supplierId_fkey"
FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MaterialReceipt" DROP CONSTRAINT "MaterialReceipt_supplierId_fkey";
ALTER TABLE "MaterialReceipt" ADD CONSTRAINT "MaterialReceipt_supplierId_fkey"
FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AuditFinding" DROP CONSTRAINT "AuditFinding_auditPlanId_fkey";
ALTER TABLE "AuditFinding" ADD CONSTRAINT "AuditFinding_auditPlanId_fkey"
FOREIGN KEY ("auditPlanId") REFERENCES "AuditPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
