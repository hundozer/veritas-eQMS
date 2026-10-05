import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const seedScript = path.resolve(__dirname, '../../prisma/seed.js');
// Unreachable on purpose: a refused seed must exit before it tries to connect.
const unreachableDatabase = 'postgresql://seed:seed@127.0.0.1:1/seed';

function runSeed(env: Record<string, string>) {
  const result = spawnSync(process.execPath, [seedScript], {
    env: { PATH: process.env.PATH ?? '', NODE_ENV: 'test', DATABASE_URL: unreachableDatabase, ...env },
    encoding: 'utf8',
    timeout: 30_000,
  });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

describe('demo seed guard', () => {
  it('SEED-T001 refuses by default, before touching the database', () => {
    const { status, output } = runSeed({});
    expect(status).toBe(1);
    expect(output).toContain('Refusing to seed: it deletes all data');
    expect(output).not.toContain('Seeding database');
  });

  it('SEED-T002 refuses in production even when unlocked', () => {
    const productionEnvs: Record<string, string>[] = [{ NODE_ENV: 'production' }, { VERCEL_ENV: 'production' }];
    for (const env of productionEnvs) {
      const { status, output } = runSeed({ ...env, VERITAS_ALLOW_DEMO_SEED: 'wipe-this-database' });
      expect(status).toBe(1);
      expect(output).toContain('Refusing to seed: this is a production environment.');
      expect(output).not.toContain('Seeding database');
    }
  });

  it('SEED-T003 refuses a wrong unlock value', () => {
    const { status, output } = runSeed({ VERITAS_ALLOW_DEMO_SEED: 'true' });
    expect(status).toBe(1);
    expect(output).not.toContain('Seeding database');
  });

  it('SEED-T004 proceeds only with the explicit unlock outside production', () => {
    const { output } = runSeed({ VERITAS_ALLOW_DEMO_SEED: 'wipe-this-database', NODE_ENV: 'development' });
    expect(output).toContain('Seeding database');
  });
});
