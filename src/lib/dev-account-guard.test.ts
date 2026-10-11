import { describe, expect, it } from 'vitest';
const { devAccountRefusal, UNLOCK_VALUE } = require('../../prisma/dev-account-guard.js');

const local = { VERITAS_ALLOW_DEV_ACCOUNT: UNLOCK_VALUE, DATABASE_URL: 'postgresql://postgres@localhost:5432/veritas_dev' };

describe('local development accounts', () => {
  it('DEVACCT-T001 run only when unlocked against a database on this machine', () => {
    expect(devAccountRefusal(local)).toBeNull();
    expect(devAccountRefusal({ ...local, DATABASE_URL: 'postgresql://postgres@127.0.0.1:55432/veritas_dev' })).toBeNull();
    expect(devAccountRefusal({ ...local, VERITAS_ALLOW_DEV_ACCOUNT: undefined })).toMatch(/Refusing/);
  });

  it('DEVACCT-T002 refuse deployed environments and remote databases', () => {
    expect(devAccountRefusal({ ...local, NODE_ENV: 'production' })).toMatch(/deployed environment/);
    expect(devAccountRefusal({ ...local, VERCEL_ENV: 'preview' })).toMatch(/deployed environment/);
    expect(devAccountRefusal({ ...local, DATABASE_URL: 'postgresql://app@ep-cool-sky.eu-central-1.aws.neon.tech/neondb' })).toMatch(/not a database on this machine/);
    expect(devAccountRefusal({ ...local, DATABASE_URL: undefined })).toMatch(/missing or not a URL/);
  });
});
