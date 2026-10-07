-- Phase 1: every document and training row carries its tenant, and every link
-- between tenant-owned rows includes tenantId, so the database itself rejects a
-- row that points into another tenant.
--
-- Backfill derives each tenantId from the parent row. ON UPDATE RESTRICT stops a
-- tenant change on a parent from silently moving its children to another tenant.

-- 1. New columns, nullable until backfilled ----------------------------------
ALTER TABLE "DocumentVersion"     ADD COLUMN "tenantId" TEXT;
ALTER TABLE "ApprovalRoute"       ADD COLUMN "tenantId" TEXT;
ALTER TABLE "ApprovalRouteStep"   ADD COLUMN "tenantId" TEXT;
ALTER TABLE "SignatureManifest"   ADD COLUMN "tenantId" TEXT;
ALTER TABLE "TrainingRequirement" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "TrainingAssignment"  ADD COLUMN "tenantId" TEXT;
ALTER TABLE "QuizResult"          ADD COLUMN "tenantId" TEXT;

-- 2. Backfill from parents ----------------------------------------------------
UPDATE "DocumentVersion" v SET "tenantId" = d."tenantId" FROM "Document" d WHERE d.id = v."documentId";
UPDATE "ApprovalRoute" r SET "tenantId" = v."tenantId" FROM "DocumentVersion" v WHERE v.id = r."documentVersionId";
UPDATE "ApprovalRouteStep" s SET "tenantId" = r."tenantId" FROM "ApprovalRoute" r WHERE r.id = s."approvalRouteId";
UPDATE "SignatureManifest" m SET "tenantId" = v."tenantId" FROM "DocumentVersion" v WHERE v.id = m."documentVersionId";
UPDATE "TrainingRequirement" t SET "tenantId" = d."tenantId" FROM "Document" d WHERE d.id = t."documentId";
UPDATE "TrainingAssignment" a SET "tenantId" = t."tenantId" FROM "TrainingRequirement" t WHERE t.id = a."requirementId";
UPDATE "QuizResult" q SET "tenantId" = u."tenantId" FROM "User" u WHERE u.id = q."userId";

-- 3. Required from now on -----------------------------------------------------
ALTER TABLE "DocumentVersion"     ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "ApprovalRoute"       ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "ApprovalRouteStep"   ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "SignatureManifest"   ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "TrainingRequirement" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "TrainingAssignment"  ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "QuizResult"          ALTER COLUMN "tenantId" SET NOT NULL;

-- 4. Composite keys that tenant-scoped foreign keys reference -----------------
CREATE UNIQUE INDEX "Document_id_tenantId_key" ON "Document"("id", "tenantId");
CREATE UNIQUE INDEX "DocumentVersion_id_tenantId_key" ON "DocumentVersion"("id", "tenantId");
CREATE UNIQUE INDEX "ApprovalRoute_id_tenantId_key" ON "ApprovalRoute"("id", "tenantId");
CREATE UNIQUE INDEX "SignatureManifest_documentVersionId_tenantId_key" ON "SignatureManifest"("documentVersionId", "tenantId");
CREATE UNIQUE INDEX "TrainingRequirement_id_tenantId_key" ON "TrainingRequirement"("id", "tenantId");
CREATE UNIQUE INDEX "TrainingRequirement_documentId_tenantId_key" ON "TrainingRequirement"("documentId", "tenantId");
CREATE UNIQUE INDEX "TrainingAssignment_quizResultId_tenantId_key" ON "TrainingAssignment"("quizResultId", "tenantId");
CREATE UNIQUE INDEX "QuizResult_id_tenantId_key" ON "QuizResult"("id", "tenantId");

-- 5. Replace single-column foreign keys with tenant-scoped ones ----------------
ALTER TABLE "Document" DROP CONSTRAINT "Document_ownerId_fkey";
ALTER TABLE "Document" ADD CONSTRAINT "Document_ownerId_tenantId_fkey" FOREIGN KEY ("ownerId", "tenantId") REFERENCES "User"("id", "tenantId") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "DocumentVersion" DROP CONSTRAINT "DocumentVersion_documentId_fkey";
ALTER TABLE "DocumentVersion" DROP CONSTRAINT "DocumentVersion_authoredById_fkey";
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_documentId_tenantId_fkey" FOREIGN KEY ("documentId", "tenantId") REFERENCES "Document"("id", "tenantId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_authoredById_tenantId_fkey" FOREIGN KEY ("authoredById", "tenantId") REFERENCES "User"("id", "tenantId") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "ApprovalRoute" DROP CONSTRAINT "ApprovalRoute_documentVersionId_fkey";
ALTER TABLE "ApprovalRoute" ADD CONSTRAINT "ApprovalRoute_documentVersionId_tenantId_fkey" FOREIGN KEY ("documentVersionId", "tenantId") REFERENCES "DocumentVersion"("id", "tenantId") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "ApprovalRouteStep" DROP CONSTRAINT "ApprovalRouteStep_approvalRouteId_fkey";
ALTER TABLE "ApprovalRouteStep" DROP CONSTRAINT "ApprovalRouteStep_approverId_fkey";
ALTER TABLE "ApprovalRouteStep" ADD CONSTRAINT "ApprovalRouteStep_approvalRouteId_tenantId_fkey" FOREIGN KEY ("approvalRouteId", "tenantId") REFERENCES "ApprovalRoute"("id", "tenantId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "ApprovalRouteStep" ADD CONSTRAINT "ApprovalRouteStep_approverId_tenantId_fkey" FOREIGN KEY ("approverId", "tenantId") REFERENCES "User"("id", "tenantId") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "SignatureManifest" DROP CONSTRAINT "SignatureManifest_documentVersionId_fkey";
ALTER TABLE "SignatureManifest" DROP CONSTRAINT "SignatureManifest_signedBy_fkey";
ALTER TABLE "SignatureManifest" ADD CONSTRAINT "SignatureManifest_documentVersionId_tenantId_fkey" FOREIGN KEY ("documentVersionId", "tenantId") REFERENCES "DocumentVersion"("id", "tenantId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "SignatureManifest" ADD CONSTRAINT "SignatureManifest_signedBy_tenantId_fkey" FOREIGN KEY ("signedBy", "tenantId") REFERENCES "User"("id", "tenantId") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "TrainingRequirement" DROP CONSTRAINT "TrainingRequirement_documentId_fkey";
ALTER TABLE "TrainingRequirement" ADD CONSTRAINT "TrainingRequirement_documentId_tenantId_fkey" FOREIGN KEY ("documentId", "tenantId") REFERENCES "Document"("id", "tenantId") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "TrainingAssignment" DROP CONSTRAINT "TrainingAssignment_requirementId_fkey";
ALTER TABLE "TrainingAssignment" DROP CONSTRAINT "TrainingAssignment_userId_fkey";
ALTER TABLE "TrainingAssignment" DROP CONSTRAINT "TrainingAssignment_quizResultId_fkey";
ALTER TABLE "TrainingAssignment" ADD CONSTRAINT "TrainingAssignment_requirementId_tenantId_fkey" FOREIGN KEY ("requirementId", "tenantId") REFERENCES "TrainingRequirement"("id", "tenantId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "TrainingAssignment" ADD CONSTRAINT "TrainingAssignment_userId_tenantId_fkey" FOREIGN KEY ("userId", "tenantId") REFERENCES "User"("id", "tenantId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "TrainingAssignment" ADD CONSTRAINT "TrainingAssignment_quizResultId_tenantId_fkey" FOREIGN KEY ("quizResultId", "tenantId") REFERENCES "QuizResult"("id", "tenantId") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "QuizResult" DROP CONSTRAINT "QuizResult_userId_fkey";
ALTER TABLE "QuizResult" ADD CONSTRAINT "QuizResult_userId_tenantId_fkey" FOREIGN KEY ("userId", "tenantId") REFERENCES "User"("id", "tenantId") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "Notification" DROP CONSTRAINT "Notification_userId_fkey";
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_tenantId_fkey" FOREIGN KEY ("userId", "tenantId") REFERENCES "User"("id", "tenantId") ON DELETE CASCADE ON UPDATE RESTRICT;
