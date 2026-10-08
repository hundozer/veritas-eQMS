import { NextRequest } from 'next/server';
import { validateIamSession } from './iam/session';
import { reportServerError } from './server-errors';
import { tenantRead, tenantTransaction } from './tenant-db';

export interface UserContext {
  iamUserId: string;
  membershipId: string;
  roleId: string;
  membershipRole: string;
  permissions: readonly string[];
  id: string;
  email: string;
  fullName: string;
  role: string;
  department: string;
  clearance: string;
  tenantId: string;
  tenantName: string;
}

export async function getContext(req?: NextRequest): Promise<UserContext | null> {
  let iamToken: string | null = null;
  if (req) {
    const cookie = req.cookies.get('iam-access-token');
    if (cookie) iamToken = cookie.value;
  } else {
    try {
      const { cookies } = await import('next/headers');
      const cookieStore = await cookies();
      const cookie = cookieStore.get('iam-access-token');
      if (cookie) iamToken = cookie.value;
    } catch {}
  }

  if (!iamToken) return null;

  const session = await validateIamSession(iamToken);
  if (!session || !session.operationalUserId) return null;

  const user = await tenantRead(session.tenantId, (tx) => tx.user.findFirst({
    where: { id: session.operationalUserId, tenantId: session.tenantId },
    include: { tenant: true },
  }));

  if (
    !user ||
    user.accountStatus !== 'ACTIVE' ||
    (user.expiresAt !== null && user.expiresAt <= new Date()) ||
    user.tenantId !== session.tenantId
  ) {
    return null;
  }

  return {
    iamUserId: session.userId,
    membershipId: session.membershipId,
    roleId: session.roleId,
    membershipRole: session.roleName,
    permissions: session.permissions,
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    department: user.department,
    clearance: user.clearance,
    tenantId: user.tenantId,
    tenantName: user.tenant?.name || 'Simpleafied Biotech',
  };
}

// Audit logger helper
export async function logSecurityEventBestEffort(params: {
  tenantId: string;
  userId: string;
  userEmail: string;
  userRole: string;
  action: string;
  objectType: string;
  objectId?: string;
  payload: any;
  status: 'Success' | 'Failed' | 'Denied';
  sourceIp?: string;
  requestUrl?: string;
}) {
  try {
    const crypto = await import('crypto');
    const eventId = crypto.randomUUID();

    await tenantTransaction(params.tenantId, (tx) => tx.auditLog.create({
      data: {
        tenantId: params.tenantId,
        eventId,
        userId: params.userId,
        userEmail: params.userEmail,
        userRole: params.userRole,
        action: params.action,
        objectType: params.objectType,
        objectId: params.objectId || null,
        payload: JSON.stringify(params.payload),
        status: params.status,
        sourceIp: params.sourceIp || '127.0.0.1',
        requestUrl: params.requestUrl || null,
      },
    }));
  } catch (err) {
    reportServerError('audit.writeFailed');
  }
}

/** @deprecated Use writeMandatoryAudit inside the business transaction for regulated mutations. */
export const logAuditEvent = logSecurityEventBestEffort;
