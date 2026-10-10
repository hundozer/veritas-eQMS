-- One-off production maintenance (DEC-083), approved by the product owner and
-- applied on 10 Oct 2026 through the Neon console connection as the owner.
--
-- Why: god@simpleafied.app carried mfaEnabled = true with a 31-character
-- placeholder secret written before two-step verification existed (DEC-080).
-- The new sign-in cannot read it and asks for an administrator reset, and no
-- other administrator can sign in yet.
--
-- What: switch two-step verification off and clear the placeholder, recorded
-- as MFA_RESET in IamAuditTrail and AuditLog. The owner sets up an
-- authenticator at the next sign-in. Refuses unless the secret is not one this
-- application wrote (v1: prefix).

DO $$
DECLARE
  owner_email constant text := 'god@simpleafied.app';
  reason constant text := 'Placeholder secret from before DEC-080; owner cannot complete sign-in. Reset at the owner''s request, 10 Oct 2026.';
  owner_iam "IamUser"%ROWTYPE;
  m "IamMembership"%ROWTYPE;
  r "IamRole"%ROWTYPE;
  payload text;
BEGIN
  SELECT * INTO STRICT owner_iam FROM "IamUser" WHERE email = owner_email AND "mfaEnabled" = true AND "mfaSecret" NOT LIKE 'v1:%';
  SELECT * INTO STRICT m FROM "IamMembership" WHERE "userId" = owner_iam.id AND status = 'ACTIVE';
  SELECT * INTO STRICT r FROM "IamRole" WHERE id = m."roleId";
  UPDATE "IamUser" SET "mfaEnabled" = false, "mfaSecret" = NULL, "updatedAt" = now() WHERE id = owner_iam.id;
  payload := json_build_object('email', owner_email, 'mfaEnabled', json_build_object('before', true, 'after', false), 'reason', reason, 'via', 'Neon SQL, owner-approved maintenance')::text;
  INSERT INTO "IamAuditTrail" (id, "organizationId", "userId", "userEmail", "userRole", action, "objectType", "objectId", payload, status, reason)
  VALUES (gen_random_uuid()::text, m."organizationId", owner_iam.id, owner_email, r.name, 'MFA_RESET', 'IamUser', owner_iam.id, payload, 'SUCCESS', reason);
  INSERT INTO "AuditLog" (id, "tenantId", "eventId", "userId", "iamUserId", "membershipId", "roleId", "userEmail", "userRole", action, "objectType", "objectId", payload, status)
  VALUES (gen_random_uuid()::text, m."tenantId", gen_random_uuid()::text, m."operationalUserId", owner_iam.id, m.id, r.id, owner_email, r.name, 'MFA_RESET', 'User', m."operationalUserId", payload, 'Success');
END $$;
