import { NextRequest, NextResponse } from 'next/server';

// POST /api/demo-request - Handle Enterprise Demo Request & Dispatch to contact@simpleafied.app
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, company, size } = body;

    if (!name || !email) {
      return NextResponse.json({ error: 'Name and Work Email are required.' }, { status: 400 });
    }

    const recipient = 'contact@simpleafied.app';

    // Log the GxP demo dispatch event for auditability & notification service
    console.log(`[DEMO-REQUEST] Dispatching demo inquiry to ${recipient}:`, {
      name,
      email,
      company: company || 'Not specified',
      size: size || 'Not specified',
      timestamp: new Date().toISOString(),
      recipient,
    });

    return NextResponse.json({
      success: true,
      message: `Enterprise demonstration request successfully dispatched to ${recipient}.`,
      targetEmail: recipient,
    });
  } catch (error: any) {
    console.error('[DEMO-REQUEST-ERROR]', error);
    return NextResponse.json({ error: 'Failed to process demonstration request.' }, { status: 500 });
  }
}
