-- One-off production maintenance (DEC-058), approved by the product owner.
--
-- Why: under the approved role policy (DEC-023) "Organization Owner" is the
-- tenant-admin family (users, document read, audit) and only "Quality Manager"
-- holds the document and training lifecycle. The owner is the organisation's only
-- member, so nobody could create a controlled document. User-administration
-- writes are disabled during recovery, so the owner loses nothing usable by
-- holding Quality Manager instead.
--
-- What: switch the owner's single ACTIVE membership in "Simpleafied Operations"
-- from "Organization Owner" to "Quality Manager", revoke its open sessions so the
-- new permissions apply at the next sign-in, and record the change in
-- IamAuditTrail. No role definition or permission assignment changes.
--
-- Safety: one atomic statement; every precondition is checked first; a second
-- run is refused because the membership no longer holds "Organization Owner".

DO $$
DECLARE
  owner_email constant text := 'god@simpleafied.app';
  reason      constant text := 'Owner needs the document lifecycle; Quality Manager is the approved role family for it (DEC-023, DEC-058).';
  iam_user    "IamUser"%ROWTYPE;
  member      "IamMembership"%ROWTYPE;
  org         "IamOrganization"%ROWTYPE;
  from_role   "IamRole"%ROWTYPE;
  to_role     "IamRole"%ROWTYPE;
  revoked     integer;
BEGIN
  SELECT * INTO STRICT iam_user FROM "IamUser" WHERE lower(email) = owner_email;
  SELECT * INTO STRICT member FROM "IamMembership" WHERE "userId" = iam_user.id AND status = 'ACTIVE';
  SELECT * INTO STRICT org FROM "IamOrganization" WHERE id = member."organizationId";
  SELECT * INTO STRICT from_role FROM "IamRole" WHERE id = member."roleId";
  SELECT * INTO STRICT to_role FROM "IamRole" WHERE name = 'Quality Manager';

  IF org."companyName" <> 'Simpleafied Operations' THEN
    RAISE EXCEPTION 'Unexpected organisation %', org."companyName";
  END IF;
  IF from_role.name <> 'Organization Owner' THEN
    RAISE EXCEPTION 'Membership holds %, not Organization Owner; nothing to do', from_role.name;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "IamRolePermission" rp JOIN "IamPermission" p ON p.id = rp."permissionId"
    WHERE rp."roleId" = to_role.id AND p.name = 'documents.create'
  ) THEN
    RAISE EXCEPTION 'Quality Manager lacks documents.create';
  END IF;

  UPDATE "IamMembership" SET "roleId" = to_role.id, "updatedAt" = now() WHERE id = member.id;
  UPDATE "IamSession" SET "revokedAt" = now() WHERE "membershipId" = member.id AND "revokedAt" IS NULL;
  GET DIAGNOSTICS revoked = ROW_COUNT;

  INSERT INTO "IamAuditTrail" (id, "organizationId", "userId", "userEmail", action, "objectType", "objectId", payload, reason)
  VALUES (gen_random_uuid()::text, org.id, iam_user.id, owner_email, 'MEMBERSHIP_ROLE_CHANGED', 'IamMembership', member.id,
    json_build_object('before', from_role.name, 'after', to_role.name, 'sessionsRevoked', revoked)::text, reason);
END $$;
