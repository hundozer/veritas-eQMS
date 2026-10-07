// Unit-test stand-in for src/lib/tenant-db.ts: tenant reads run against the
// mocked database client and tenant transactions go through its $transaction
// mock, so route tests keep asserting on the same mocks. Database tests
// (npm run test:db) exercise the real helpers under row-level security.
type Work = (tx: unknown) => unknown;
type MockClient = { $transaction?: (work: Work) => unknown };

export async function tenantDbDouble() {
  const { default: db } = (await import('@/lib/db')) as unknown as { default: MockClient };
  return {
    tenantRead: (_tenantId: string, work: Work) => work(db),
    tenantTransaction: (_tenantId: string, work: Work) => db.$transaction!(work),
  };
}
