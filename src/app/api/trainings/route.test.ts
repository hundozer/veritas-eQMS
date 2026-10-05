import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { getContext, findMany, update, quizCreate, transaction } = vi.hoisted(() => ({
  getContext: vi.fn(),
  findMany: vi.fn(),
  update: vi.fn(),
  quizCreate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getContext }));
vi.mock('@/lib/db', () => ({
  default: {
    trainingAssignment: { findMany, update },
    quizResult: { create: quizCreate },
    $transaction: transaction,
  },
}));

import { GET, POST } from './route';

const context = {
  id: 'user-1',
  tenantId: 'tenant-1',
  membershipRole: 'EMPLOYEE',
  permissions: ['training.read_own'],
};

function request() {
  return new NextRequest('http://localhost/api/trainings');
}

const assignmentProjection = {
  id: true,
  requirementId: true,
  userId: true,
  status: true,
  assignedAt: true,
  completedAt: true,
  requirement: {
    select: {
      id: true,
      requiredForRoles: true,
      requiresQuiz: true,
      document: { select: { id: true, documentNumber: true, title: true, description: true, status: true, currentVersionNumber: true } },
    },
  },
  quizResult: { select: { id: true, score: true, passed: true, createdAt: true } },
};

describe('training containment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TRAINING-T001 rejects reads without identity or either persisted read permission', async () => {
    getContext.mockResolvedValue(null);
    expect((await GET(request())).status).toBe(401);
    getContext.mockResolvedValue({ ...context, permissions: [] });
    expect((await GET(request())).status).toBe(403);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('TRAINING-T002 scopes and minimizes own assignments without answer keys', async () => {
    getContext.mockResolvedValue(context);
    findMany.mockResolvedValue([]);

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', user: { tenantId: 'tenant-1' } },
      select: assignmentProjection,
      orderBy: { status: 'asc' },
    });
    await expect(response.json()).resolves.toEqual({ assignments: [], isMatrix: false });
  });

  it('TRAINING-T003 scopes and minimizes a permitted tenant matrix', async () => {
    getContext.mockResolvedValue({ ...context, permissions: ['training.read_all'] });
    findMany.mockResolvedValue([]);

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(findMany).toHaveBeenCalledWith({
      where: { user: { tenantId: 'tenant-1' } },
      select: {
        ...assignmentProjection,
        user: { select: { id: true, fullName: true, role: true, department: true } },
      },
      orderBy: { assignedAt: 'desc' },
    });
    await expect(response.json()).resolves.toEqual({ assignments: [], isMatrix: true });
  });

  it('TRAINING-T004 disables completion without identity or data processing', async () => {
    const response = await POST();

    expect(POST).toHaveLength(0);
    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('Retry-After')).toBe('86400');
    expect(getContext).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(quizCreate).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });
});
