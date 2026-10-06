-- Least-privileged runtime role for the application (Phase 0, DEC-057).
--
-- Run once per database as the database owner, with psql:
--   psql "$OWNER_DATABASE_URL" -v ON_ERROR_STOP=1 -v app_password="$APP_PASSWORD" \
--        -f prisma/maintenance/2026-10-06-app-role.sql
-- Then point the application's DATABASE_URL at veritas_app. Migrations keep
-- running as the owner.
--
-- veritas_app can read and write application data. It cannot create, alter,
-- drop or truncate tables, cannot read the migration ledger, and has no UPDATE
-- or DELETE on the audit tables (the append-only triggers also stop the owner).
-- It is created with plain SQL, not the Neon console, so it is not a member of
-- neon_superuser.

CREATE ROLE veritas_app LOGIN NOINHERIT PASSWORD :'app_password';

DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO veritas_app', current_database());
END $$;

GRANT USAGE ON SCHEMA public TO veritas_app;
REVOKE CREATE ON SCHEMA public FROM veritas_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO veritas_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO veritas_app;

REVOKE UPDATE, DELETE ON "AuditLog", "IamAuditTrail" FROM veritas_app;
REVOKE ALL ON "_prisma_migrations" FROM veritas_app;

-- Tables added by future migrations (run as the owner) get the same data grants.
-- Audit-style tables added later must revoke UPDATE/DELETE in their own migration.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO veritas_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO veritas_app;
