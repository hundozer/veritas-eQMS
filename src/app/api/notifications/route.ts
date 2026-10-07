import { NextRequest, NextResponse } from 'next/server';
import { tenantRead } from '@/lib/tenant-db';
import { getContext } from '@/lib/auth';
import { hasPermission } from '../../../lib/rbac';
import { unexpectedErrorResponse } from '../../../lib/server-errors';

// GET /api/notifications - List user notifications
export async function GET(req: NextRequest) {
  try {
    const user = await getContext(req);
    if (!user) {
      return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    }
    if (!hasPermission(user, 'notification.read_own')) {
      return NextResponse.json(
        { error: { code: 'Forbidden', message: 'Notification self-read permission is required' } },
        { status: 403 },
      );
    }

    const notifications = await tenantRead(user.tenantId, (tx) => tx.notification.findMany({
      where: { userId: user.id, tenantId: user.tenantId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }));

    return NextResponse.json({ notifications });
  } catch (error: any) {
    return unexpectedErrorResponse('notification.list');
  }
}
