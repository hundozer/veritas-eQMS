import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const config = readFileSync(resolve('prisma.config.ts'), 'utf8');

describe('Prisma build configuration contract', () => {
  it('PRISMA-BUILD-T001 does not require a database during config import or client generation', () => {
    expect(config).not.toContain('throw new Error("Database configuration is unavailable")');
    expect(config).toContain('const schemaEngine = databaseUrl');
    expect(config).toContain('...schemaEngine');
  });

  it('PRISMA-BUILD-T002 supplies the classic schema engine only with a non-empty URL', () => {
    expect(config).toContain('process.env.DATABASE_URL?.trim()');
    expect(config).toContain('{ engine: "classic" as const, datasource: { url: databaseUrl } }');
  });
});
