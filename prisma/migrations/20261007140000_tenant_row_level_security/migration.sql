-- Phase 1: row-level security on tenant-owned tables.
--
-- The application role (veritas_app) sees and writes only rows whose tenantId
-- equals the transaction-local setting app.tenant_id, which src/lib/tenant-db.ts
-- sets at the start of every tenant transaction. With no setting it sees none.
-- The table owner (migrations and reviewed maintenance scripts) is not subject
-- to these policies because they are not FORCEd.
--
-- User, Tenant and the IAM tables are not covered yet: sign-in and session
-- lookup read them before the tenant is known.

ALTER TABLE "Document" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Document_tenant_isolation" ON "Document"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "DocumentVersion" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "DocumentVersion_tenant_isolation" ON "DocumentVersion"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "ApprovalRoute" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ApprovalRoute_tenant_isolation" ON "ApprovalRoute"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "ApprovalRouteStep" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ApprovalRouteStep_tenant_isolation" ON "ApprovalRouteStep"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "SignatureManifest" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "SignatureManifest_tenant_isolation" ON "SignatureManifest"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "TrainingRequirement" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "TrainingRequirement_tenant_isolation" ON "TrainingRequirement"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "TrainingAssignment" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "TrainingAssignment_tenant_isolation" ON "TrainingAssignment"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "QuizResult" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "QuizResult_tenant_isolation" ON "QuizResult"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Notification_tenant_isolation" ON "Notification"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "AuditLog_tenant_isolation" ON "AuditLog"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
