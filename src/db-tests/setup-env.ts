import { appDatabaseUrl } from './connections';

// Route handlers read DATABASE_URL when src/lib/db.ts loads, so it must point at
// the least-privileged application role before any route is imported.
process.env.DATABASE_URL = appDatabaseUrl();
