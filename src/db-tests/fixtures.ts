import { randomUUID } from 'node:crypto';
import { PrismaClient, type Prisma } from '@prisma/client';
import { NextRequest } from 'next/server';
import { createIamSession } from '@/lib/iam/session';
import { hashPassword } from '@/lib/iam/password';

// Password of members added with addMember, used to sign.
export const MEMBER_PASSWORD = 'db-test-signing-password';

export type SeededTenant = {
  label: string;
  tenantId: string;
  operationalUserId: string;
  colleagueId: string;
  email: string;
  documentId: string;
  documentTitle: string;
  auditEventId: string;
  assignmentId: string;
  notificationId: string;
  sessionToken: string;
  organizationId: string;
  roleId: string;
};

// A role holding every persisted permission, so isolation failures cannot hide
// behind a missing permission.
export async function createFullAccessRole(owner: PrismaClient): Promise<string> {
  const role = await owner.iamRole.create({
    data: { name: `DB test full access ${randomUUID()}`, description: 'Database test role', isSystem: false },
  });
  const permissions = await owner.iamPermission.findMany({ select: { id: true } });
  await owner.iamRolePermission.createMany({
    data: permissions.map((permission) => ({ roleId: role.id, permissionId: permission.id })),
  });
  return role.id;
}

// Seeds one organisation with a signed-in user, a colleague, a draft document with
// a training assignment, a notification and an audit row. Every identifier is
// unique per run, so the suite can run repeatedly against the same database.
export async function seedTenant(owner: PrismaClient, label: string, roleId: string): Promise<SeededTenant> {
  const run = randomUUID().slice(0, 8);
  const email = `${label.toLowerCase()}-${run}@example.invalid`;

  const tenant = await owner.tenant.create({ data: { name: `Tenant ${label} ${run}` } });
  const user = await owner.user.create({
    data: { email, fullName: `${label} Quality Manager`, role: 'QUALITY_MANAGER', department: 'QA', tenantId: tenant.id },
  });
  const colleague = await owner.user.create({
    data: { email: `${label.toLowerCase()}-colleague-${run}@example.invalid`, fullName: `${label} Colleague`, role: 'EMPLOYEE', department: 'QA', tenantId: tenant.id },
  });
  const iamUser = await owner.iamUser.create({
    data: { email, passwordHash: 'not-used-by-these-tests', firstName: label, lastName: 'Manager', accountStatus: 'ACTIVE' },
  });
  const organization = await owner.iamOrganization.create({
    data: { legalName: `${label} GmbH`, companyName: `${label} ${run}`, country: 'DE', industry: 'Pharma', size: '1-10', status: 'ACTIVE', tenantId: tenant.id },
  });
  const membership = await owner.iamMembership.create({
    data: { userId: iamUser.id, organizationId: organization.id, tenantId: tenant.id, operationalUserId: user.id, roleId, status: 'ACTIVE' },
  });

  const documentTitle = `${label} confidential SOP ${run}`;
  const document = await owner.document.create({
    data: {
      title: documentTitle,
      description: `${label} only`,
      classification: 'CONTROLLED',
      status: 'DRAFT',
      ownerId: user.id,
      tenantId: tenant.id,
      versions: { create: { versionNumber: 1, status: 'DRAFT', filePath: '', hash: 'a'.repeat(64), createdBy: user.fullName } },
    },
  });
  const requirement = await owner.trainingRequirement.create({
    data: { documentId: document.id, tenantId: tenant.id, requiredForRoles: 'QA' },
  });
  const assignment = await owner.trainingAssignment.create({
    data: { requirementId: requirement.id, tenantId: tenant.id, userId: user.id, status: 'ASSIGNED' },
  });
  const notification = await owner.notification.create({
    data: { tenantId: tenant.id, userId: user.id, title: `${label} notice ${run}`, message: `${label} only`, type: 'DOCUMENT_REVIEW' },
  });
  const auditEventId = randomUUID();
  await owner.auditLog.create({
    data: { tenantId: tenant.id, eventId: auditEventId, userId: user.id, action: 'DOCUMENT_CREATED', objectType: 'Document', objectId: document.id, payload: '{}', status: 'SUCCESS' },
  });

  // Sessions go through the application's own session code and database role.
  const session = await createIamSession({ userId: iamUser.id, membershipId: membership.id, tenantId: membership.tenantId });

  return {
    label,
    tenantId: tenant.id,
    operationalUserId: user.id,
    colleagueId: colleague.id,
    email,
    documentId: document.id,
    documentTitle,
    auditEventId,
    assignmentId: assignment.id,
    notificationId: notification.id,
    sessionToken: session.sessionToken,
    organizationId: organization.id,
    roleId,
  };
}

// Adds another signed-in member to a seeded tenant, e.g. a reviewer or approver.
// Their password is MEMBER_PASSWORD.
export async function addMember(
  owner: PrismaClient,
  tenant: SeededTenant,
  label: string,
  roleId: string = tenant.roleId,
): Promise<{ userId: string; sessionToken: string }> {
  const run = randomUUID().slice(0, 8);
  const email = `${tenant.label.toLowerCase()}-${label.toLowerCase()}-${run}@example.invalid`;
  const user = await owner.user.create({
    data: { email, fullName: `${tenant.label} ${label}`, role: 'QUALITY_MANAGER', department: 'QA', tenantId: tenant.tenantId },
  });
  const iamUser = await owner.iamUser.create({
    data: { email, passwordHash: await hashPassword(MEMBER_PASSWORD), firstName: tenant.label, lastName: label, accountStatus: 'ACTIVE' },
  });
  const membership = await owner.iamMembership.create({
    data: { userId: iamUser.id, organizationId: tenant.organizationId, tenantId: tenant.tenantId, operationalUserId: user.id, roleId, status: 'ACTIVE' },
  });
  const session = await createIamSession({ userId: iamUser.id, membershipId: membership.id, tenantId: membership.tenantId });
  return { userId: user.id, sessionToken: session.sessionToken };
}

export function requestAs(
  tenant: SeededTenant,
  path: string,
  init: { method?: string; body?: unknown } = {},
): NextRequest {
  return new NextRequest(`https://veritas.test${path}`, {
    method: init.method ?? 'GET',
    headers: { cookie: `iam-access-token=${tenant.sessionToken}`, 'content-type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

// Everything that identifies a tenant's records in an API response.
export function markers(tenant: SeededTenant): string[] {
  return [
    tenant.tenantId, tenant.operationalUserId, tenant.colleagueId, tenant.email,
    tenant.documentId, tenant.documentTitle, tenant.auditEventId, tenant.assignmentId, tenant.notificationId,
  ];
}

// Runs work in one transaction as the given tenant, the way src/lib/tenant-db.ts
// does, so row-level security applies to the application role.
export function asTenant<T>(
  client: PrismaClient,
  tenantId: string,
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return client.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
    return work(tx);
  });
}
