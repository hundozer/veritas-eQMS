import { NextRequest, NextResponse } from 'next/server';
import { getContext, logAuditEvent } from '@/lib/auth';
import { calculateTenantComplianceHealth } from '@/lib/veritas-intelligence';

// GET /api/intelligence - Returns real-time compliance health score and regulatory recommendations
export async function GET(req: NextRequest) {
  try {
    const user = await getContext(req);
    if (!user) {
      return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    }

    const health = await calculateTenantComplianceHealth(user.tenantId);

    await logAuditEvent({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'Intelligence.CalculateHealth',
      objectType: 'ComplianceScore',
      payload: { score: health.overallScore, grade: health.grade },
      status: 'Success',
      requestUrl: req.nextUrl.pathname,
    });

    return NextResponse.json({ health });
  } catch (error: any) {
    console.error('Veritas Intelligence calculation error:', error);
    return NextResponse.json({ error: { code: 'InternalError', message: error.message } }, { status: 500 });
  }
}
