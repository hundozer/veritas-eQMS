-- One-off production maintenance (DEC-063, DEC-071), approved by the product owner.
--
-- Why: inviting people needs a holder of users.create. The owner chose a
-- separate administrator account (DEC-023: administration apart from the
-- document lifecycle), signing in as contact@simpleafied.app, which is also the
-- sender of invitation emails. Nobody can invite it from the application
-- because nobody holds users.create yet.
--
-- What: create exactly what inviteMember (src/lib/iam/provisioning.ts) creates
-- for an invitation into "Simpleafied Operations" with the "Organization Owner"
-- role: an INVITED IAM identity with an unusable password, its operational
-- user, an ACTIVE membership, and the USER_INVITED rows in IamAuditTrail and
-- AuditLog, attributed to the owner. The owner then asks for a setup link at
-- /auth/setup-password and sets the password; nobody else ever knows it.
--
-- Safety: one atomic block; every precondition is checked first; a second run
-- is refused because the address is then in use. Run as the database owner.

DO $$
DECLARE
  admin_email constant text := 'contact@simpleafied.app';
  owner_email constant text := 'god@simpleafied.app';
  owner_iam   "IamUser"%ROWTYPE;
  owner_user  "User"%ROWTYPE;
  owner_role  "IamRole"%ROWTYPE;
  org         "IamOrganization"%ROWTYPE;
  admin_role  "IamRole"%ROWTYPE;
  owner_member "IamMembership"%ROWTYPE;
  identity_id text := gen_random_uuid()::text;
  user_id     text := gen_random_uuid()::text;
  member_id   text := gen_random_uuid()::text;
  payload     text;
BEGIN
  SELECT * INTO STRICT org FROM "IamOrganization" WHERE "companyName" = 'Simpleafied Operations' AND status IN ('ACTIVE', 'TRIAL');
  SELECT * INTO STRICT owner_iam FROM "IamUser" WHERE lower(email) = owner_email AND "accountStatus" = 'ACTIVE';
  SELECT * INTO STRICT owner_member FROM "IamMembership"
    WHERE "userId" = owner_iam.id AND "organizationId" = org.id AND status = 'ACTIVE';
  SELECT * INTO STRICT owner_user FROM "User" WHERE id = owner_member."operationalUserId";
  SELECT * INTO STRICT owner_role FROM "IamRole" WHERE id = owner_member."roleId";
  -- Roles are seeded with isSystem = true in production; platform roles are
  -- excluded by name (src/lib/iam/provisioning.ts), so select by name only.
  SELECT * INTO STRICT admin_role FROM "IamRole" WHERE name = 'Organization Owner';

  IF EXISTS (SELECT 1 FROM "IamUser" WHERE lower(email) = admin_email)
     OR EXISTS (SELECT 1 FROM "User" WHERE lower(email) = admin_email) THEN
    RAISE EXCEPTION '% is already in use; nothing to do', admin_email;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "IamRolePermission" rp JOIN "IamPermission" p ON p.id = rp."permissionId"
    WHERE rp."roleId" = admin_role.id AND p.name = 'users.create'
  ) THEN
    RAISE EXCEPTION 'Organization Owner lacks users.create';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "IamRolePermission" rp JOIN "IamPermission" p ON p.id = rp."permissionId"
    WHERE rp."roleId" = admin_role.id AND p.name IN ('documents.approve', 'documents.release', 'documents.review')
  ) THEN
    RAISE EXCEPTION 'Organization Owner holds document-signing permissions; separation (DEC-023) would not hold';
  END IF;

  INSERT INTO "IamUser" (id, email, "passwordHash", "firstName", "lastName", "accountStatus", "updatedAt")
  VALUES (identity_id, admin_email, 'unusable:' || gen_random_uuid()::text, 'Simpleafied', 'Administrator', 'INVITED', now());

  INSERT INTO "User" (id, email, "fullName", "firstName", "lastName", role, department, "tenantId", "accountStatus")
  VALUES (user_id, admin_email, 'Simpleafied Administrator', 'Simpleafied', 'Administrator', 'EMPLOYEE', 'Administration', org."tenantId", 'ACTIVE');

  INSERT INTO "IamMembership" (id, "userId", "organizationId", "tenantId", "operationalUserId", "roleId", status, "createdBy", "approvedBy", "updatedAt")
  VALUES (member_id, identity_id, org.id, org."tenantId", user_id, admin_role.id, 'ACTIVE', owner_iam.id, owner_iam.id, now());

  payload := json_build_object(
    'email', admin_email, 'fullName', 'Simpleafied Administrator', 'department', 'Administration',
    'roleId', admin_role.id, 'roleName', admin_role.name, 'membershipId', member_id,
    'via', 'prisma/maintenance/2026-10-09-administrator-account.sql'
  )::text;

  INSERT INTO "IamAuditTrail" (id, "organizationId", "userId", "userEmail", "userRole", action, "objectType", "objectId", payload, reason)
  VALUES (gen_random_uuid()::text, org.id, owner_iam.id, owner_email, owner_role.name, 'USER_INVITED', 'IamUser', identity_id, payload,
    'Separate administrator account chosen by the owner (DEC-023, DEC-071).');

  INSERT INTO "AuditLog" (id, "tenantId", "eventId", "userId", "iamUserId", "membershipId", "roleId", "userEmail", "userRole", action, "objectType", "objectId", payload, status)
  VALUES (gen_random_uuid()::text, org."tenantId", gen_random_uuid()::text, owner_user.id, owner_iam.id, owner_member.id, owner_role.id,
    owner_email, owner_role.name, 'USER_INVITED', 'User', user_id, payload, 'Success');
END $$;
