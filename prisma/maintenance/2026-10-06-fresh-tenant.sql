-- One-off production maintenance, approved by the product owner on 2026-10-06.
--
-- Why: the demo seed (prisma/seed.js) ran against production. The owner's real
-- organisation "Simpleafied Operations" was attached to the seed's demo tenant
-- "Acme Biotech", so the owner works inside fictional data, including a signature
-- manifest nobody signed. See docs/ROADMAP.md, Phase 0.
--
-- What: give the owner's organisation a clean tenant. Nothing is deleted.
--   1. Create tenant "Simpleafied Operations".
--   2. Free the owner's e-mail on the old operational user (its id, and so its
--      audit-log attribution, is unchanged) and mark that user INACTIVE.
--   3. Create a new operational user, organisation and ACTIVE membership in the
--      new tenant, with the same IAM role.
--   4. Archive the old organisation, suspend the old membership and revoke its
--      sessions. The demo tenants stay as read-only history.
--   5. Record every step in IamAuditTrail.
--
-- Safety: one statement, so it is atomic. Every precondition is checked first;
-- if production does not look exactly as expected it raises and changes nothing.
-- Running it a second time fails on the "tenant already exists" check.

DO $$
DECLARE
  owner_email   constant text := 'god@simpleafied.app';
  retired_email constant text := 'god+acme-demo-retired@simpleafied.app';
  new_name      constant text := 'Simpleafied Operations';
  reason        constant text := 'Owner organisation moved off the demo seed tenant "Acme Biotech"; approved by the product owner 2026-10-06.';

  iam_user   "IamUser"%ROWTYPE;
  old_member "IamMembership"%ROWTYPE;
  old_org    "IamOrganization"%ROWTYPE;
  old_op     "User"%ROWTYPE;
  old_tenant "Tenant"%ROWTYPE;

  new_tenant_id     text := gen_random_uuid()::text;
  new_op_id         text := gen_random_uuid()::text;
  new_org_id        text := gen_random_uuid()::text;
  new_membership_id text := gen_random_uuid()::text;
  revoked_sessions  integer;
BEGIN
  -- Preconditions -----------------------------------------------------------
  SELECT * INTO STRICT iam_user FROM "IamUser" WHERE lower(email) = owner_email;
  SELECT * INTO STRICT old_member FROM "IamMembership" WHERE "userId" = iam_user.id AND status = 'ACTIVE';
  SELECT * INTO STRICT old_org FROM "IamOrganization" WHERE id = old_member."organizationId";
  SELECT * INTO STRICT old_tenant FROM "Tenant" WHERE id = old_org."tenantId";
  SELECT * INTO STRICT old_op FROM "User" WHERE id = old_member."operationalUserId";

  IF old_org."companyName" <> new_name THEN
    RAISE EXCEPTION 'Unexpected organisation %', old_org."companyName";
  END IF;
  IF old_tenant.name <> 'Acme Biotech' THEN
    RAISE EXCEPTION 'Organisation is linked to tenant %, not the demo tenant', old_tenant.name;
  END IF;
  IF lower(old_op.email) <> owner_email OR old_op."tenantId" <> old_tenant.id THEN
    RAISE EXCEPTION 'Unexpected operational user %', old_op.email;
  END IF;
  IF EXISTS (SELECT 1 FROM "Tenant" WHERE name = new_name) THEN
    RAISE EXCEPTION 'Tenant % already exists; this script has already run', new_name;
  END IF;
  IF EXISTS (SELECT 1 FROM "User" WHERE lower(email) = retired_email) THEN
    RAISE EXCEPTION 'E-mail % is already taken', retired_email;
  END IF;

  -- 1. Clean tenant -----------------------------------------------------------
  INSERT INTO "Tenant" (id, name) VALUES (new_tenant_id, new_name);

  -- 2. Free the e-mail on the old operational user ----------------------------
  UPDATE "User" SET email = retired_email, "accountStatus" = 'INACTIVE' WHERE id = old_op.id;

  -- 3. New operational user, organisation and membership ----------------------
  INSERT INTO "User" (id, email, "fullName", "firstName", "lastName", role, department, clearance, "tenantId", "accountStatus")
  VALUES (new_op_id, owner_email, old_op."fullName", old_op."firstName", old_op."lastName", old_op.role, old_op.department, old_op.clearance, new_tenant_id, 'ACTIVE');

  INSERT INTO "IamOrganization" (id, "legalName", "companyName", country, industry, size, "subscriptionPlan", status, "tenantId", "updatedAt")
  VALUES (new_org_id, old_org."legalName", old_org."companyName", old_org.country, old_org.industry, old_org.size, old_org."subscriptionPlan", old_org.status, new_tenant_id, now());

  INSERT INTO "IamMembership" (id, "userId", "organizationId", "tenantId", "operationalUserId", "roleId", status, "createdBy", "approvedBy", "updatedAt")
  VALUES (new_membership_id, iam_user.id, new_org_id, new_tenant_id, new_op_id, old_member."roleId", 'ACTIVE', 'maintenance:2026-10-06-fresh-tenant', 'product-owner', now());

  -- 4. Retire the old link ----------------------------------------------------
  UPDATE "IamOrganization" SET status = 'ARCHIVED', "updatedAt" = now() WHERE id = old_org.id;
  UPDATE "IamMembership" SET status = 'SUSPENDED', "updatedAt" = now() WHERE id = old_member.id;
  UPDATE "IamSession" SET "revokedAt" = now() WHERE "membershipId" = old_member.id AND "revokedAt" IS NULL;
  GET DIAGNOSTICS revoked_sessions = ROW_COUNT;

  -- 5. Audit trail ------------------------------------------------------------
  INSERT INTO "IamAuditTrail" (id, "organizationId", "userId", "userEmail", action, "objectType", "objectId", payload, reason) VALUES
    (gen_random_uuid()::text, new_org_id, iam_user.id, owner_email, 'TENANT_CREATED', 'Tenant', new_tenant_id,
      json_build_object('name', new_name)::text, reason),
    (gen_random_uuid()::text, old_org.id, iam_user.id, owner_email, 'OPERATIONAL_USER_RETIRED', 'User', old_op.id,
      json_build_object('before', json_build_object('email', old_op.email, 'accountStatus', old_op."accountStatus"),
                        'after', json_build_object('email', retired_email, 'accountStatus', 'INACTIVE'))::text, reason),
    (gen_random_uuid()::text, new_org_id, iam_user.id, owner_email, 'OPERATIONAL_USER_CREATED', 'User', new_op_id,
      json_build_object('email', owner_email, 'tenantId', new_tenant_id)::text, reason),
    (gen_random_uuid()::text, new_org_id, iam_user.id, owner_email, 'ORGANIZATION_CREATED', 'IamOrganization', new_org_id,
      json_build_object('companyName', old_org."companyName", 'tenantId', new_tenant_id, 'replaces', old_org.id)::text, reason),
    (gen_random_uuid()::text, new_org_id, iam_user.id, owner_email, 'MEMBERSHIP_CREATED', 'IamMembership', new_membership_id,
      json_build_object('roleId', old_member."roleId", 'status', 'ACTIVE')::text, reason),
    (gen_random_uuid()::text, old_org.id, iam_user.id, owner_email, 'ORGANIZATION_ARCHIVED', 'IamOrganization', old_org.id,
      json_build_object('before', old_org.status, 'after', 'ARCHIVED', 'tenant', old_tenant.name)::text, reason),
    (gen_random_uuid()::text, old_org.id, iam_user.id, owner_email, 'MEMBERSHIP_SUSPENDED', 'IamMembership', old_member.id,
      json_build_object('before', old_member.status, 'after', 'SUSPENDED', 'sessionsRevoked', revoked_sessions)::text, reason);
END $$;
