-- One-off production maintenance (DEC-085), requested and approved by the
-- product owner on 11 Oct 2026.
--
-- Why: the owner (admin@simpleafied.app) does not have the current password.
-- Veritas has no reset for active accounts yet (FEATURES: "Password reset
-- links ... Library only, no route or UI"), and invitation email is not live,
-- so the owner cannot help themselves and no other administrator can sign in.
--
-- What: put the account back into the invited state the existing, tested
-- password-setup flow serves (src/lib/iam/password-setup.ts), and issue one
-- PASSWORD_SETUP link for /auth/setup-password:
--   1. replace the password with an unusable value, set accountStatus INVITED
--      and revoke open sessions, so the old password stops working at once;
--   2. close any open credential links and store the SHA-256 of a new token,
--      valid 30 minutes and single-use (the plaintext token is never stored;
--      it is handed to the owner directly);
--   3. record PASSWORD_RESET_ISSUED in IamAuditTrail and AuditLog.
-- When the owner sets a password the flow returns the account to ACTIVE and
-- records PASSWORD_SET. Two-step verification, role and membership are
-- unchanged: sign-in still asks for the authenticator code.
--
-- Safety: one atomic block; refuses unless the account is ACTIVE with exactly
-- one active membership. token_sha256 is filled in at run time.

DO $$
DECLARE
  owner_email constant text := 'admin@simpleafied.app';
  token_sha256 constant text := 'REPLACE_WITH_TOKEN_SHA256';
  reason constant text := 'Owner does not have the current password; no reset for active accounts exists yet. Single-use setup link issued at the owner''s request, 11 Oct 2026.';
  iam "IamUser"%ROWTYPE;
  m "IamMembership"%ROWTYPE;
  r "IamRole"%ROWTYPE;
  revoked integer;
  payload text;
BEGIN
  IF token_sha256 !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Fill in the SHA-256 of the token';
  END IF;
  SELECT * INTO STRICT iam FROM "IamUser" WHERE email = owner_email AND "accountStatus" = 'ACTIVE';
  SELECT * INTO STRICT m FROM "IamMembership" WHERE "userId" = iam.id AND status = 'ACTIVE';
  SELECT * INTO STRICT r FROM "IamRole" WHERE id = m."roleId";

  UPDATE "IamUser" SET "passwordHash" = 'unusable:' || md5(gen_random_uuid()::text), "accountStatus" = 'INVITED', "updatedAt" = now() WHERE id = iam.id;
  UPDATE "IamSession" SET "revokedAt" = now() WHERE "userId" = iam.id AND "revokedAt" IS NULL;
  GET DIAGNOSTICS revoked = ROW_COUNT;
  UPDATE "IamCredentialActionToken" SET "consumedAt" = now() WHERE "userId" = iam.id AND "consumedAt" IS NULL;
  INSERT INTO "IamCredentialActionToken" (id, "userId", "tokenHash", purpose, "expiresAt")
  VALUES (gen_random_uuid()::text, iam.id, token_sha256, 'PASSWORD_SETUP', now() + interval '30 minutes');

  payload := json_build_object(
    'email', owner_email,
    'accountStatus', json_build_object('before', 'ACTIVE', 'after', 'INVITED'),
    'sessionsRevoked', revoked,
    'link', 'single-use PASSWORD_SETUP, 30 minutes',
    'reason', reason,
    'via', 'Neon SQL, owner-approved maintenance'
  )::text;
  INSERT INTO "IamAuditTrail" (id, "organizationId", "userId", "userEmail", "userRole", action, "objectType", "objectId", payload, status, reason)
  VALUES (gen_random_uuid()::text, m."organizationId", iam.id, owner_email, r.name, 'PASSWORD_RESET_ISSUED', 'IamUser', iam.id, payload, 'SUCCESS', reason);
  INSERT INTO "AuditLog" (id, "tenantId", "eventId", "userId", "iamUserId", "membershipId", "roleId", "userEmail", "userRole", action, "objectType", "objectId", payload, status)
  VALUES (gen_random_uuid()::text, m."tenantId", gen_random_uuid()::text, m."operationalUserId", iam.id, m.id, r.id, owner_email, r.name, 'PASSWORD_RESET_ISSUED', 'User', m."operationalUserId", payload, 'Success');
END $$;
