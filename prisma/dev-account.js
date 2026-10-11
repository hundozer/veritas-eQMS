// Creates a local organisation with three members who can sign in, so the
// workspace can be used on a developer's machine: an author, a reviewer and
// a quality manager (approver and releaser), all with every permission. The
// records are fictional and unaudited; see dev-account-guard.js for where this
// may run. Usage: npm run dev:account
const { devAccountRefusal } = require('./dev-account-guard');

const refusal = devAccountRefusal(process.env);
if (refusal) {
  console.error(refusal);
  process.exit(1);
}

const { randomBytes, randomUUID } = require('node:crypto');
const argon2 = require('argon2');
const { PrismaClient } = require('@prisma/client');

// Same Argon2id profile as src/lib/iam/password.ts.
const ARGON2_OPTIONS = { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 };

const MEMBERS = [
  { label: 'author', firstName: 'Dev', lastName: 'Author' },
  { label: 'reviewer', firstName: 'Dev', lastName: 'Reviewer' },
  { label: 'qm', firstName: 'Dev', lastName: 'Quality Manager' },
];

async function main() {
  const prisma = new PrismaClient();
  try {
    const run = randomUUID().slice(0, 6);
    const password = randomBytes(12).toString('base64url');
    const passwordHash = await argon2.hash(password, ARGON2_OPTIONS);
    const permissions = await prisma.iamPermission.findMany({ select: { id: true } });
    if (permissions.length === 0) throw new Error('No permissions found; run `npx prisma migrate deploy` first.');

    const created = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({ data: { name: `Local development ${run}` } });
      const organization = await tx.iamOrganization.create({
        data: { legalName: 'Local development', companyName: `Local development ${run}`, country: 'DE', industry: 'Pharma', size: '1-10', status: 'ACTIVE', tenantId: tenant.id },
      });
      const role = await tx.iamRole.create({ data: { name: `Local development, all permissions ${run}`, description: 'Every permission; local development only', isSystem: false } });
      await tx.iamRolePermission.createMany({ data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })) });

      const emails = [];
      for (const member of MEMBERS) {
        const email = `${member.label}-${run}@example.test`;
        const user = await tx.user.create({
          data: { email, fullName: `${member.firstName} ${member.lastName}`, firstName: member.firstName, lastName: member.lastName, role: 'QUALITY_MANAGER', department: 'QA', tenantId: tenant.id },
        });
        const iamUser = await tx.iamUser.create({
          data: { email, passwordHash, firstName: member.firstName, lastName: member.lastName, accountStatus: 'ACTIVE' },
        });
        await tx.iamMembership.create({
          data: { userId: iamUser.id, organizationId: organization.id, tenantId: tenant.id, operationalUserId: user.id, roleId: role.id, status: 'ACTIVE' },
        });
        emails.push(email);
      }
      return emails;
    });

    console.log('Local development organisation created. Sign in at http://localhost:3000 with:');
    for (const email of created) console.log(`  ${email}`);
    console.log(`  password: ${password}`);
    console.log('Each member sets up two-step verification at the first sign-in (MFA_ENCRYPTION_KEY must be set).');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
