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
    const timestamp = new Date().toISOString();

    // 1. Log event on server stdout for auditability
    console.log(`[DEMO-REQUEST-DISPATCH] Sending inquiry for ${name} (${email}) to ${recipient}`);

    let emailDelivered = false;
    let deliveryMethod = 'console-log (no email provider key configured)';

    // 2. Real Email Dispatch via Resend (if RESEND_API_KEY is configured in Vercel)
    if (process.env.RESEND_API_KEY) {
      try {
        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM || 'Veritas Demo Requests <onboarding@resend.dev>',
            to: [recipient],
            reply_to: email,
            subject: `[Veritas Demo Request] ${name} (${company || 'Biotech Enterprise'})`,
            html: `
              <div style="font-family: Arial, sans-serif; padding: 20px; color: #0A0E17;">
                <h2 style="color: #047857;">New Simpleafied Veritas Demo Request</h2>
                <hr style="border: 0; border-top: 1px solid #E2E8F0;" />
                <p><strong>Full Name:</strong> ${name}</p>
                <p><strong>Work Email:</strong> <a href="mailto:${email}">${email}</a></p>
                <p><strong>Company / Organization:</strong> ${company || 'Not provided'}</p>
                <p><strong>Team Size:</strong> ${size || 'Not provided'}</p>
                <p><strong>Timestamp:</strong> ${timestamp}</p>
                <hr style="border: 0; border-top: 1px solid #E2E8F0;" />
                <p style="font-size: 12px; color: #64748B;">This inquiry was submitted via the Simpleafied Veritas Enterprise Platform.</p>
              </div>
            `,
          }),
        });

        if (resendRes.ok) {
          emailDelivered = true;
          deliveryMethod = 'Resend API';
        } else {
          const errData = await resendRes.json();
          console.error('[RESEND-API-ERROR]', errData);
        }
      } catch (emailErr) {
        console.error('[EMAIL-DISPATCH-ERROR]', emailErr);
      }
    }

    // 3. Webhook Dispatch (if DISPATCH_WEBHOOK_URL is configured in Vercel)
    if (!emailDelivered && process.env.DISPATCH_WEBHOOK_URL) {
      try {
        await fetch(process.env.DISPATCH_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, company, size, recipient, timestamp }),
        });
        emailDelivered = true;
        deliveryMethod = 'Webhook URL';
      } catch (webhookErr) {
        console.error('[WEBHOOK-DISPATCH-ERROR]', webhookErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Enterprise demonstration request dispatched to ${recipient}.`,
      targetEmail: recipient,
      emailDelivered,
      deliveryMethod,
    });
  } catch (error: any) {
    console.error('[DEMO-REQUEST-ERROR]', error);
    return NextResponse.json({ error: 'Failed to process demonstration request.' }, { status: 500 });
  }
}
