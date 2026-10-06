import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { APP_ROLE_TEST_PASSWORD, ownerDatabaseUrl } from './connections';

// Splits a psql script into single statements, keeping $$ bodies intact.
export function sqlStatements(script: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inDollarBody = false;
  for (const line of script.split('\n')) {
    if (!inDollarBody && line.trim().startsWith('--')) continue;
    current += `${line}\n`;
    if ((line.match(/\$\$/g) ?? []).length % 2 === 1) inDollarBody = !inDollarBody;
    if (!inDollarBody && line.trim().endsWith(';')) {
      statements.push(current.trim());
      current = '';
    }
  }
  if (current.trim()) statements.push(current.trim());
  return statements;
}

export default async function setup() {
  const ownerUrl = ownerDatabaseUrl();
  const root = path.resolve(__dirname, '../..');
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: ownerUrl },
    stdio: 'pipe',
  });

  const owner = new PrismaClient({ datasourceUrl: ownerUrl });
  try {
    // Roles are cluster-wide but grants are per database: create the role once,
    // then always apply the script's grants to this database.
    const existing = await owner.$queryRaw<{ n: bigint }[]>`select count(*) as n from pg_roles where rolname = 'veritas_app'`;
    const roleExists = Number(existing[0].n) > 0;
    const script = readFileSync(path.join(root, 'prisma/maintenance/2026-10-06-app-role.sql'), 'utf8')
      .replace(":'app_password'", `'${APP_ROLE_TEST_PASSWORD}'`);
    for (const statement of sqlStatements(script)) {
      if (roleExists && statement.startsWith('CREATE ROLE')) continue;
      await owner.$executeRawUnsafe(statement);
    }
  } finally {
    await owner.$disconnect();
  }
}
