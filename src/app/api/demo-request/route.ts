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

    console.log(`[DEMO-REQUEST-DISPATCH] Processing inquiry for ${name} (${email}) -> ${recipient}`);

    let emailDelivered = false;
    let deliveryMethod = 'none';

    // 1. Dispatch via Resend API (if RESEND_API_KEY is configured)
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
                <p style="font-size: 12px; color: #64748B;">Submitted via Simpleafied Veritas Platform.</p>
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
      } catch (resendErr) {
        console.error('[RESEND-DISPATCH-ERROR]', resendErr);
      }
    }

    // 2. Dispatch via Webhook URL (if DISPATCH_WEBHOOK_URL is configured)
    if (!emailDelivered && process.env.DISPATCH_WEBHOOK_URL) {
      try {
        const webhookRes = await fetch(process.env.DISPATCH_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, company, size, recipient, timestamp }),
        });
        if (webhookRes.ok) {
          emailDelivered = true;
          deliveryMethod = 'Webhook URL';
        }
      } catch (webhookErr) {
        console.error('[WEBHOOK-DISPATCH-ERROR]', webhookErr);
      }
    }

    // 3. Dispatch via FormSubmit Zero-Config Mailer (Fallback requiring zero API keys)
    if (!emailDelivered) {
      try {
        const formSubmitRes = await fetch(`https://formsubmit.co/ajax/${recipient}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            _subject: `[Veritas Demo Request] ${name} - ${company || 'Biotech Enterprise'}`,
            _replyto: email,
            _template: 'table',
            "Full Name": name,
            "Work Email": email,
            "Company / Organization": company || 'Not specified',
            "Team Size": size || 'Not specified',
            "Submitted At": timestamp,
          }),
        });

        if (formSubmitRes.ok) {
          emailDelivered = true;
          deliveryMethod = 'FormSubmit Delivery Engine';
        } else {
          const formErr = await formSubmitRes.text();
          console.error('[FORMSUBMIT-ERROR]', formErr);
        }
      } catch (fsErr) {
        console.error('[FORMSUBMIT-DISPATCH-ERROR]', fsErr);
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
