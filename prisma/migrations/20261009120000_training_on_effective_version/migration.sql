-- Phase 2: training assigned per effective version (DEC-073).
--
-- When a version becomes effective, the members of the document's training
-- departments are assigned that version; open assignments on earlier versions
-- are closed as SUPERSEDED. An assignment names the version it trains on,
-- within the same tenant. Existing rows keep a null version and are untouched.
-- Additive only: one nullable column, two indexes, one foreign key.

ALTER TABLE "TrainingAssignment" ADD COLUMN "documentVersionId" TEXT;

CREATE INDEX "TrainingAssignment_tenantId_userId_idx" ON "TrainingAssignment"("tenantId", "userId");

CREATE UNIQUE INDEX "TrainingAssignment_documentVersionId_userId_key" ON "TrainingAssignment"("documentVersionId", "userId");

ALTER TABLE "TrainingAssignment" ADD CONSTRAINT "TrainingAssignment_documentVersionId_tenantId_fkey"
  FOREIGN KEY ("documentVersionId", "tenantId") REFERENCES "DocumentVersion"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
