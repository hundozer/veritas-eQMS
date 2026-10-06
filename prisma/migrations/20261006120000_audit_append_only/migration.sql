-- Audit tables are append-only. Rows can be inserted and read, never changed or
-- removed, by any role: the application, migrations and console sessions alike.
-- Foreign keys that would rewrite audit rows (ON UPDATE CASCADE, ON DELETE SET NULL
-- from IamUser / IamOrganization) are therefore rejected too, so identities and
-- organisations with audit history must be retired, not deleted.

CREATE OR REPLACE FUNCTION veritas_reject_audit_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Audit table % is append-only: % is not allowed', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER "AuditLog_append_only"
  BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION veritas_reject_audit_change();

CREATE TRIGGER "AuditLog_no_truncate"
  BEFORE TRUNCATE ON "AuditLog"
  FOR EACH STATEMENT EXECUTE FUNCTION veritas_reject_audit_change();

CREATE TRIGGER "IamAuditTrail_append_only"
  BEFORE UPDATE OR DELETE ON "IamAuditTrail"
  FOR EACH ROW EXECUTE FUNCTION veritas_reject_audit_change();

CREATE TRIGGER "IamAuditTrail_no_truncate"
  BEFORE TRUNCATE ON "IamAuditTrail"
  FOR EACH STATEMENT EXECUTE FUNCTION veritas_reject_audit_change();
