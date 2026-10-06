// Connection strings for the database test suite. TEST_DATABASE_URL points at a
// disposable database owned by the connecting role; the application role is the
// least-privileged runtime role created by prisma/maintenance/2026-10-06-app-role.sql.
export const APP_ROLE_TEST_PASSWORD = 'db-test-only-password';

export function ownerDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error('TEST_DATABASE_URL must point at a disposable PostgreSQL database owned by the connecting role.');
  }
  return url;
}

export function appDatabaseUrl(): string {
  const url = new URL(ownerDatabaseUrl());
  url.username = 'veritas_app';
  url.password = APP_ROLE_TEST_PASSWORD;
  return url.toString();
}
