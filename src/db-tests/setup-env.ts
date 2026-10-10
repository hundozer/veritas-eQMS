import { appDatabaseUrl } from './connections';

// Route handlers read DATABASE_URL when src/lib/db.ts loads, so it must point at
// the least-privileged application role before any route is imported.
process.env.DATABASE_URL = appDatabaseUrl();

// Two-step verification needs its key (DEC-080); a fixed test-only key.
process.env.MFA_ENCRYPTION_KEY = Buffer.alloc(32, 42).toString('base64');
