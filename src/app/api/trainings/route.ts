import { NextRequest, NextResponse } from 'next/server';
import { tenantRead } from '@/lib/tenant-db';
import { getContext } from '@/lib/auth';
import { hasPermission } from '../../../lib/rbac';
import { unexpectedErrorResponse } from '../../../lib/server-errors';


// GET /api/trainings - Get training assignments (either user-specific or complete tenant matrix)
export async function GET(req: NextRequest) {
  try {
    const user = await getContext(req);
    if (!user) {
      return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    }

    const canReadAll = hasPermission(user, 'training.read_all');
    if (!canReadAll && !hasPermission(user, 'training.read_own')) {
      return NextResponse.json({ error: { code: 'Forbidden', message: 'Insufficient permission' } }, { status: 403 });
    }

    if (canReadAll) {
      // 1. Get entire training matrix for the tenant
      const assignments = await tenantRead(user.tenantId, (tx) => tx.trainingAssignment.findMany({
        where: {
          user: { tenantId: user.tenantId },
        },
        select: {
          id: true,
          requirementId: true,
          userId: true,
          status: true,
          assignedAt: true,
          completedAt: true,
          documentVersion: { select: { versionNumber: true } },
          user: { select: { id: true, fullName: true, department: true } },
          requirement: {
            select: {
              id: true,
              requiredForRoles: true,
              requiresQuiz: true,
              document: { select: { id: true, documentNumber: true, title: true, description: true, status: true, currentVersionNumber: true } },
            },
          },
          quizResult: { select: { id: true, score: true, passed: true, createdAt: true } },
        },
        orderBy: { assignedAt: 'desc' },
      }));

      return NextResponse.json({ assignments, isMatrix: true }, { headers: { 'Cache-Control': 'no-store' } });
    } else {
      // 2. Get assignments only for the current user
      const assignments = await tenantRead(user.tenantId, (tx) => tx.trainingAssignment.findMany({
        where: {
          userId: user.id,
          user: { tenantId: user.tenantId },
        },
        select: {
          id: true,
          requirementId: true,
          userId: true,
          status: true,
          assignedAt: true,
          completedAt: true,
          documentVersion: { select: { versionNumber: true } },
          requirement: {
            select: {
              id: true,
              requiredForRoles: true,
              requiresQuiz: true,
              document: { select: { id: true, documentNumber: true, title: true, description: true, status: true, currentVersionNumber: true } },
            },
          },
          quizResult: { select: { id: true, score: true, passed: true, createdAt: true } },
        },
        orderBy: { status: 'asc' }, // ASSIGNED first, then COMPLETED
      }));

      return NextResponse.json({ assignments, isMatrix: false }, { headers: { 'Cache-Control': 'no-store' } });
    }
  } catch (error: any) {
    return unexpectedErrorResponse('training.list');
  }
}

// Training is completed by signing it: POST /api/trainings/[id]/sign (DEC-075).
