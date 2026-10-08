import { NextRequest, NextResponse } from 'next/server';
import { getContext } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { createUploadKey, DirectUploadRefused, presignDirectUpload } from '@/lib/controlled-storage';
import { unexpectedErrorResponse } from '../../../../lib/server-errors';

// POST /api/documents/uploads - direct browser uploads to private storage (DEC-068).
// `{ type: 'veritas.reserve-upload' }` returns a fresh upload key in the caller's
// tenant; the Blob client then asks this route to presign a PUT for that key.
export async function POST(req: NextRequest) {
  try {
    const user = await getContext(req);
    if (!user) return NextResponse.json({ error: { code: 'Unauthorized', message: 'Authentication required' } }, { status: 401 });
    if (!hasPermission(user, 'documents.create') && !hasPermission(user, 'documents.update_draft')) {
      return NextResponse.json({ error: { code: 'Forbidden', message: 'Insufficient permission' } }, { status: 403 });
    }
    const body = await req.json().catch(() => null);
    const noStore = { 'Cache-Control': 'no-store' };
    if (body?.type === 'veritas.reserve-upload') {
      return NextResponse.json({ uploadKey: createUploadKey(user.tenantId) }, { headers: noStore });
    }
    try {
      return NextResponse.json(await presignDirectUpload(user.tenantId, req, body), { headers: noStore });
    } catch (error) {
      if (error instanceof DirectUploadRefused) {
        return NextResponse.json({ error: { code: 'ValidationFailed', message: 'This upload request is not allowed' } }, { status: 400 });
      }
      throw error;
    }
  } catch {
    return unexpectedErrorResponse('document.upload');
  }
}
