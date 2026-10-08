-- Phase 1, step 1 of 2 (DEC-069): prepare sessions and sign-in for row-level
-- security on the identity tables, without changing what the running
-- application sees. Apply before deploying the code that uses it; step 2
-- (20261008130000_identity_row_level_security) follows that deploy.

-- Sessions carry their membership's tenant, so a session token tells which
-- tenant to act as before any tenant data is read.
ALTER TABLE "IamSession" ADD COLUMN "tenantId" TEXT;
UPDATE "IamSession" s SET "tenantId" = m."tenantId" FROM "IamMembership" m WHERE m."id" = s."membershipId";
CREATE UNIQUE INDEX "IamMembership_id_tenantId_key" ON "IamMembership"("id", "tenantId");

-- Until step 2, code that does not set the column yet gets it filled in.
CREATE FUNCTION veritas_session_tenant_default() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."tenantId" IS NULL THEN
    SELECT m."tenantId" INTO NEW."tenantId" FROM "IamMembership" m WHERE m."id" = NEW."membershipId";
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "IamSession_tenant_default" BEFORE INSERT ON "IamSession"
  FOR EACH ROW EXECUTE FUNCTION veritas_session_tenant_default();

-- The one sign-in lookup that crosses tenants: ids only, for one identity. It
-- runs as its owner so it still sees memberships once row-level security is on.
CREATE FUNCTION veritas_identity_memberships(identity_id TEXT)
RETURNS TABLE (membership_id TEXT, organization_id TEXT, tenant_id TEXT)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT m."id", m."organizationId", m."tenantId"
  FROM "IamMembership" m
  JOIN "IamOrganization" o ON o."id" = m."organizationId" AND o."tenantId" = m."tenantId"
  WHERE m."userId" = identity_id
    AND m."status" = 'ACTIVE'
    AND o."status" IN ('ACTIVE', 'TRIAL')
  ORDER BY m."createdAt", m."id"
$$;
REVOKE ALL ON FUNCTION veritas_identity_memberships(TEXT) FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'veritas_app') THEN
    GRANT EXECUTE ON FUNCTION veritas_identity_memberships(TEXT) TO veritas_app;
  END IF;
END $$;
