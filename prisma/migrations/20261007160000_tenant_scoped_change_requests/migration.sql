-- Phase 1: change requests carry their tenant like every other tenant-owned row
-- (DEC-061). Change control itself stays disabled until Phase 3.
--
-- Backfill: a change request takes the tenant of the documents it is linked to.
-- The migration stops if a change request has no linked document or links
-- documents of more than one tenant; production had one, linked to one tenant.

ALTER TABLE "ChangeRequest"         ADD COLUMN "tenantId" TEXT;
ALTER TABLE "ChangeRequestDocument" ADD COLUMN "tenantId" TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "ChangeRequest" cr
    LEFT JOIN "ChangeRequestDocument" crd ON crd."changeRequestId" = cr.id
    LEFT JOIN "Document" d ON d.id = crd."documentId"
    GROUP BY cr.id
    HAVING count(DISTINCT d."tenantId") <> 1
  ) THEN
    RAISE EXCEPTION 'A change request has no linked document or spans several tenants; resolve it before this migration';
  END IF;
END $$;

UPDATE "ChangeRequest" cr SET "tenantId" = (
  SELECT min(d."tenantId") FROM "ChangeRequestDocument" crd JOIN "Document" d ON d.id = crd."documentId"
  WHERE crd."changeRequestId" = cr.id
);
UPDATE "ChangeRequestDocument" crd SET "tenantId" = cr."tenantId" FROM "ChangeRequest" cr WHERE cr.id = crd."changeRequestId";

ALTER TABLE "ChangeRequest"         ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "ChangeRequestDocument" ALTER COLUMN "tenantId" SET NOT NULL;

CREATE UNIQUE INDEX "ChangeRequest_id_tenantId_key" ON "ChangeRequest"("id", "tenantId");

ALTER TABLE "ChangeRequest" ADD CONSTRAINT "ChangeRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "ChangeRequestDocument" DROP CONSTRAINT "ChangeRequestDocument_changeRequestId_fkey";
ALTER TABLE "ChangeRequestDocument" DROP CONSTRAINT "ChangeRequestDocument_documentId_fkey";
ALTER TABLE "ChangeRequestDocument" ADD CONSTRAINT "ChangeRequestDocument_changeRequestId_tenantId_fkey" FOREIGN KEY ("changeRequestId", "tenantId") REFERENCES "ChangeRequest"("id", "tenantId") ON DELETE CASCADE ON UPDATE RESTRICT;
ALTER TABLE "ChangeRequestDocument" ADD CONSTRAINT "ChangeRequestDocument_documentId_tenantId_fkey" FOREIGN KEY ("documentId", "tenantId") REFERENCES "Document"("id", "tenantId") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "ChangeRequest" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ChangeRequest_tenant_isolation" ON "ChangeRequest"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "ChangeRequestDocument" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ChangeRequestDocument_tenant_isolation" ON "ChangeRequestDocument"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
