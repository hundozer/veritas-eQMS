-- One-off production maintenance (DEC-084), requested and approved by the
-- product owner on 11 Oct 2026.
--
-- Why: the owner account god@simpleafied.app showed as "God Mode
-- Administrator" on the People tab, in signature boxes, routing lists and
-- audit entries. The name dates from before the containment programme
-- (DEC-038) and suggests powers the account does not have; access comes only
-- from its role.
--
-- What, in one transaction:
-- 1. Free admin@simpleafied.app: it belongs to "ADMIN Operator", an
--    operational user of the read-only demo tenant "Acme Biotech" (DEC-056)
--    with no sign-in identity, membership, audit rows, documents or
--    signatures. Its address becomes admin+acme-demo-retired@simpleafied.app
--    (the same pattern as the 6 Oct move off the demo tenant), recorded as
--    USER_DETAILS_CORRECTED in that tenant's AuditLog.
-- 2. The owner account becomes "Veritas Administrator", signing in as
--    admin@simpleafied.app. Changed on the operational user (User.email,
-- fullName, firstName, lastName) and the IAM identity (IamUser.email,
-- firstName, lastName); recorded as USER_DETAILS_CORRECTED in IamAuditTrail
-- and AuditLog. The password, two-step verification, role and membership are
-- unchanged. Existing audit entries and signatures keep the name and address
-- they were made under.
--
-- Safety: one atomic block. Refuses unless the demo record is exactly as
-- described, the old address exists with the old name and exactly one active
-- membership, and, once the demo record is moved, the new address is unused
-- by any identity or operational user. A second run is refused because
-- the old address is gone. Run as the database owner.

DO $$
DECLARE
  old_email constant text := 'god@simpleafied.app';
  new_email constant text := 'admin@simpleafied.app';
  old_name constant text := 'God Mode Administrator';
  new_first constant text := 'Veritas';
  new_last constant text := 'Administrator';
  new_name constant text := new_first || ' ' || new_last;
  retired_email constant text := 'admin+acme-demo-retired@simpleafied.app';
  demo_reason constant text := 'Address freed for the owner account; demo record of the read-only Acme Biotech tenant (DEC-056), owner-approved 11 Oct 2026.';
  demo "User"%ROWTYPE;
  reason constant text := 'Owner account renamed at the owner''s request, 11 Oct 2026: "God Mode Administrator" (god@simpleafied.app) becomes "Veritas Administrator" (admin@simpleafied.app).';
  iam "IamUser"%ROWTYPE;
  op "User"%ROWTYPE;
  m "IamMembership"%ROWTYPE;
  r "IamRole"%ROWTYPE;
  payload text;
BEGIN
  -- 1. The demo record holding the new address.
  SELECT u.* INTO STRICT demo FROM "User" u JOIN "Tenant" t ON t.id = u."tenantId"
    WHERE lower(u.email) = new_email AND u."fullName" = 'ADMIN Operator' AND t.name = 'Acme Biotech';
  IF EXISTS (SELECT 1 FROM "IamMembership" WHERE "operationalUserId" = demo.id)
     OR EXISTS (SELECT 1 FROM "IamUser" WHERE lower(email) IN (new_email, retired_email))
     OR EXISTS (SELECT 1 FROM "User" WHERE lower(email) = retired_email) THEN
    RAISE EXCEPTION 'The demo record or the retired address is not as expected';
  END IF;
  UPDATE "User" SET email = retired_email WHERE id = demo.id;
  INSERT INTO "AuditLog" (id, "tenantId", "eventId", "userId", "userEmail", "userRole", action, "objectType", "objectId", payload, status)
  VALUES (gen_random_uuid()::text, demo."tenantId", gen_random_uuid()::text, demo.id, retired_email, demo.role, 'USER_DETAILS_CORRECTED', 'User', demo.id,
    json_build_object('email', json_build_object('before', demo.email, 'after', retired_email), 'reason', demo_reason, 'via', 'Neon SQL, owner-approved maintenance')::text, 'Success');

  -- 2. The owner account.
  IF EXISTS (SELECT 1 FROM "IamUser" WHERE lower(email) = new_email) OR EXISTS (SELECT 1 FROM "User" WHERE lower(email) = new_email) THEN
    RAISE EXCEPTION 'The address % is already in use', new_email;
  END IF;
  SELECT * INTO STRICT iam FROM "IamUser" WHERE email = old_email;
  SELECT * INTO STRICT m FROM "IamMembership" WHERE "userId" = iam.id AND status = 'ACTIVE';
  SELECT * INTO STRICT op FROM "User" WHERE id = m."operationalUserId" AND email = old_email AND "fullName" = old_name;
  SELECT * INTO STRICT r FROM "IamRole" WHERE id = m."roleId";

  UPDATE "User" SET email = new_email, "fullName" = new_name, "firstName" = new_first, "lastName" = new_last WHERE id = op.id;
  UPDATE "IamUser" SET email = new_email, "firstName" = new_first, "lastName" = new_last, "updatedAt" = now() WHERE id = iam.id;

  payload := json_build_object(
    'email', json_build_object('before', old_email, 'after', new_email),
    'fullName', json_build_object('before', op."fullName", 'after', new_name),
    'iamName', json_build_object('before', iam."firstName" || ' ' || iam."lastName", 'after', new_name),
    'reason', reason,
    'via', 'Neon SQL, owner-approved maintenance'
  )::text;
  INSERT INTO "IamAuditTrail" (id, "organizationId", "userId", "userEmail", "userRole", action, "objectType", "objectId", payload, status, reason)
  VALUES (gen_random_uuid()::text, m."organizationId", iam.id, new_email, r.name, 'USER_DETAILS_CORRECTED', 'IamUser', iam.id, payload, 'SUCCESS', reason);
  INSERT INTO "AuditLog" (id, "tenantId", "eventId", "userId", "iamUserId", "membershipId", "roleId", "userEmail", "userRole", action, "objectType", "objectId", payload, status)
  VALUES (gen_random_uuid()::text, m."tenantId", gen_random_uuid()::text, op.id, iam.id, m.id, r.id, new_email, r.name, 'USER_DETAILS_CORRECTED', 'User', op.id, payload, 'Success');
END $$;
