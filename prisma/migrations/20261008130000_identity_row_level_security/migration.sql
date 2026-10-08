-- Phase 1, step 2 of 2 (DEC-069): row-level security on the tenant-owned
-- identity tables. Apply only after the code from the same pull request is
-- deployed: earlier code reads these tables without a tenant and would see
-- nothing.
--
-- "Tenant", "User", "IamOrganization" and "IamMembership" get the same policy
-- as the document tables (DEC-060): the application role sees and writes only
-- the rows of the tenant set by src/lib/tenant-db.ts, and none without one.
-- What is read before the tenant is known stays outside the policy:
--   * "IamSession", found by the hash of its secret token; it names its tenant.
--   * veritas_identity_memberships (step 1): the ids and tenant of one
--     identity's active memberships, for sign-in.
-- "IamUser", "IamSession", "IamCredentialActionToken" and "IamAuditTrail"
-- belong to a person's identity, which can span organisations, and the role
-- catalogue ("IamRole", "IamPermission", "IamRolePermission") is shared; none
-- of them holds tenant data.

-- Every session now names its tenant, and it must be its membership's.
DROP TRIGGER "IamSession_tenant_default" ON "IamSession";
DROP FUNCTION veritas_session_tenant_default();
ALTER TABLE "IamSession" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "IamSession" DROP CONSTRAINT "IamSession_membershipId_fkey";
ALTER TABLE "IamSession" ADD CONSTRAINT "IamSession_membershipId_tenantId_fkey"
  FOREIGN KEY ("membershipId", "tenantId") REFERENCES "IamMembership"("id", "tenantId") ON DELETE CASCADE ON UPDATE RESTRICT;

ALTER TABLE "Tenant" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant_tenant_isolation" ON "Tenant"
  USING ("id" = current_setting('app.tenant_id', true))
  WITH CHECK ("id" = current_setting('app.tenant_id', true));

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User_tenant_isolation" ON "User"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "IamOrganization" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "IamOrganization_tenant_isolation" ON "IamOrganization"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "IamMembership" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "IamMembership_tenant_isolation" ON "IamMembership"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
