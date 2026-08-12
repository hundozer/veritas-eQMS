import { NextRequest } from 'next/server';
import prisma from './db';

export interface UserContext {
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

import jwt from 'jsonwebtoken';

function getJwtSecret(): string {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) throw new Error('JWT verification is unavailable');
  return jwtSecret;
}

export async function getContext(req?: NextRequest): Promise<UserContext | null> {
  let email: string | null = null;
  let tenantIdFromToken: string | null = null;
  let roleFromToken: string | null = null;

  // 1. Try to read and verify the cryptographic Simpleafied IAM access token
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

  if (iamToken) {
    try {
      const decoded = jwt.verify(iamToken, getJwtSecret()) as any;
      if (decoded && decoded.email) {
        email = decoded.email;
        if (decoded.organizationId) {
          tenantIdFromToken = decoded.organizationId;
        }
        if (decoded.roleName) {
          roleFromToken = decoded.roleName;
        }
      }
    } catch (err) {
      console.warn('Failed to verify cryptographic IAM token, falling back to legacy checks:', err);
    }
  }

  // 2. Fallback to legacy cookie and header checks if IAM token is not present
  if (!email && req) {
    // Check custom header
    email = req.headers.get('x-user-email');
    
    // Check cookie if header not present
    if (!email) {
      const cookie = req.cookies.get('user-email');
      if (cookie) email = cookie.value;
    }
  } else if (!email) {
    try {
      const { cookies } = await import('next/headers');
      const cookieStore = await cookies();
      const cookie = cookieStore.get('user-email');
      if (cookie) email = cookie.value;
    } catch {}
  }

  if (!email) {
    email = 'admin@simpleafied.app';
  }

  let user = await prisma.user.findUnique({
    where: { email },
    include: { tenant: true },
  });

  // 3. Auto-provision user if they exist in IAM (token present) but not yet locally
  if (!user && email && tenantIdFromToken) {
    let tenant = await prisma.tenant.findUnique({ where: { id: tenantIdFromToken } });
    if (!tenant) {
      // Create local copy of the tenant workspace
      tenant = await prisma.tenant.create({
        data: {
          id: tenantIdFromToken,
          name: 'Corporate Tenant Workspace',
        },
      });
    }

    user = await prisma.user.create({
      data: {
        email,
        fullName: email.split('@')[0].toUpperCase() + ' Operator',
        role: roleFromToken || 'EMPLOYEE',
        department: 'QA',
        clearance: 'RESTRICTED',
        tenantId: tenant.id,
      },
      include: { tenant: true },
    });
  }

  // If email is a platform admin email but not found in the DB, auto-provision them!
  if (!user && isPlatformAdminEmail(email)) {
    let defaultTenant = await prisma.tenant.findFirst();
    if (!defaultTenant) {
      defaultTenant = await prisma.tenant.create({
        data: { name: 'Simpleafied Biotech' },
      });
    }

    const isGod = isGodModeUser(email);
    user = await prisma.user.create({
      data: {
        email,
        fullName: isGod ? 'God Mode Administrator' : email.split('@')[0].toUpperCase() + ' Operator',
        role: 'ADMIN',
        department: 'REGULATORY',
        clearance: 'RESTRICTED',
        tenantId: defaultTenant.id,
      },
      include: { tenant: true },
    });
  }

  // Fallback to first available user in database if specified email does not exist
  if (!user) {
    user = await prisma.user.findFirst({
      include: { tenant: true },
    });
  }

  // Auto-provision default tenant and admin user if database is unseeded
  if (!user) {
    let defaultTenant = await prisma.tenant.findFirst();
    if (!defaultTenant) {
      defaultTenant = await prisma.tenant.create({
        data: { name: 'Simpleafied Biotech' },
      });
    }

    user = await prisma.user.create({
      data: {
        email: email || 'admin@simpleafied.app',
        fullName: 'Dr. Eleanor Vance',
        role: 'ADMIN',
        department: 'QA',
        clearance: 'RESTRICTED',
        tenantId: defaultTenant.id,
      },
      include: { tenant: true },
    });
  }

  return {
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
