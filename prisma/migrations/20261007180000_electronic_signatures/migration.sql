-- Phase 1: electronic signatures with password re-entry (DEC-062).
--
-- A document version may carry several signatures (a review and an approval,
-- and a fresh one after changes). Each signature records who signed, as they
-- were at signing time, and the SHA-256 of the content they signed. Signatures
-- are append-only for every role. Rows from before this migration keep null
-- signer details and are left untouched.

DROP INDEX "SignatureManifest_documentVersionId_key";
DROP INDEX "SignatureManifest_documentVersionId_tenantId_key";

ALTER TABLE "SignatureManifest"
  ADD COLUMN "iamUserId" TEXT,
  ADD COLUMN "membershipId" TEXT,
  ADD COLUMN "signerName" TEXT,
  ADD COLUMN "signerRole" TEXT,
  ADD COLUMN "comment" TEXT;

CREATE INDEX "SignatureManifest_documentVersionId_idx" ON "SignatureManifest"("documentVersionId");
CREATE UNIQUE INDEX "SignatureManifest_documentVersionId_signedBy_meaning_hashSi_key"
  ON "SignatureManifest"("documentVersionId", "signedBy", "meaning", "hashSigned");

CREATE OR REPLACE FUNCTION veritas_reject_signature_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Signature records are append-only: % is not allowed', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER "SignatureManifest_append_only"
  BEFORE UPDATE OR DELETE ON "SignatureManifest"
  FOR EACH ROW EXECUTE FUNCTION veritas_reject_signature_change();

CREATE TRIGGER "SignatureManifest_no_truncate"
  BEFORE TRUNCATE ON "SignatureManifest"
  FOR EACH STATEMENT EXECUTE FUNCTION veritas_reject_signature_change();
