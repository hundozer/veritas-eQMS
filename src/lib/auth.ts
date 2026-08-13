import { NextRequest } from 'next/server';
import prisma from './db';
import { validateIamSession } from './iam/session';

export interface UserContext {
  iamUserId: string;
  membershipId: string;
  roleId: string;
  id: string;
  email: string;
  fullName: string;
  role: string;
  department: string;
  clearance: string;
  tenantId: string;
  tenantName: string;
}

// Helpers for Simpleafied Platform Admin & God Mode
export function isPlatformAdminEmail(email: string): boolean {
  if (!email) return false;
  const lower = email.toLowerCase();
  return lower.endsWith('@simpleafied.app') || 
         lower.endsWith('@simpleafied.eu') || 
         lower.endsWith('@simpleafied.de');
}

export function isGodModeUser(email: string): boolean {
  if (!email) return false;
  const lower = email.toLowerCase();
  return lower === 'god@simpleafied.app' || 
         lower === 'god@simpleafied.eu' || 
         lower === 'god@simpleafied.de';
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

  const user = await prisma.user.findUnique({
    where: { id: session.operationalUserId },
    include: { tenant: true },
  });

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

// Simple ABAC checker function
export function checkAbac(
  user: UserContext,
  resource: { classification: string; ownerId: string },
  action: 'view' | 'create' | 'edit' | 'delete' | 'approve' | 'download'
): boolean {
  // QA_ADMIN bypasses all except tenant bounds (which is handled by database query scope)
  if (user.role === 'ADMIN') return true;

  // Auditor has view-only access
  if (user.role === 'AUDITOR') {
    return action === 'view';
  }

  // Classification check: RESTRICTED clearance needed for RESTRICTED docs
  if (resource.classification === 'RESTRICTED' && user.clearance !== 'RESTRICTED') {
    return false;
  }

  // Edit / Delete check: Only owner or admin
  if ((action === 'edit' || action === 'delete') && resource.ownerId !== user.id) {
    return false;
  }

  // Approver check
  if (action === 'approve' && user.role !== 'APPROVER' && user.role !== 'ADMIN') {
    return false;
  }

  return true;
}

// Audit logger helper
export async function logAuditEvent(params: {
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

    await prisma.auditLog.create({
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
    });
  } catch (err) {
    console.error('Failed to log audit event:', err);
  }
}
