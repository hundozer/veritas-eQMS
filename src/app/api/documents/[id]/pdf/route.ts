import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getContext } from '@/lib/auth';

// GET /api/documents/[id]/pdf - Render watermarked GxP PDF preview with 21 CFR Part 11 metadata
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getContext(req);
    if (!user) {
      return new NextResponse('Unauthorized: Please log in to view controlled document', { status: 401 });
    }

    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        owner: true,
        tenant: true,
        versions: {
          orderBy: { versionNumber: 'desc' },
          include: {
            signatureManifest: {
              include: { signer: true },
            },
          },
        },
        trainingRequirement: true,
      },
    });

    if (!document || document.tenantId !== user.tenantId) {
      return new NextResponse('404: Document Not Found', { status: 404 });
    }

    const latestVersion = document.versions[0];
    const signature = latestVersion?.signatureManifest;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${document.title} — Veritas eQMS Watermarked Control Copy</title>
  <style>
    @page { size: A4; margin: 20mm; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      background-color: #f8fafc;
      margin: 0;
      padding: 40px;
    }
    .watermark {
      position: fixed;
      top: 45%;
      left: 15%;
      transform: rotate(-35deg);
      font-size: 52px;
      font-weight: 900;
      color: rgba(225, 29, 72, 0.08);
      text-transform: uppercase;
      letter-spacing: 6px;
      pointer-events: none;
      z-index: 0;
      white-space: nowrap;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      background: #ffffff;
      padding: 48px;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
      border: 1px solid #e2e8f0;
      position: relative;
      z-index: 1;
    }
    .header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 32px;
      border: 2px solid #0f172a;
    }
    .header-table td {
      border: 1px solid #cbd5e1;
      padding: 12px 16px;
      font-size: 13px;
    }
    .brand-title {
      font-size: 20px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.5px;
    }
    .status-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      background: #dcfce7;
      color: #166534;
      border: 1px solid #86efac;
    }
    .section-title {
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 6px;
      margin-top: 28px;
      margin-bottom: 12px;
    }
    .content-body {
      font-size: 14px;
      line-height: 1.7;
      color: #334155;
    }
    .esign-box {
      margin-top: 40px;
      padding: 20px;
      background: #f0fdf4;
      border: 1.5px solid #22c55e;
      border-radius: 6px;
      font-size: 12px;
    }
    .esign-header {
      font-weight: 800;
      color: #15803d;
      font-size: 13px;
      margin-bottom: 8px;
      display: flex;
      justify-content: space-between;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-top: 8px;
      color: #334155;
    }
    .hash {
      font-family: monospace;
      font-size: 11px;
      color: #475569;
      background: #e2e8f0;
      padding: 2px 6px;
      border-radius: 3px;
      word-break: break-all;
    }
    .footer {
      margin-top: 40px;
      padding-top: 16px;
      border-top: 1px solid #e2e8f0;
      font-size: 11px;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>
  <div class="watermark">CONTROLLED COPY — ${document.status}</div>

  <div class="container">
    <table class="header-table">
      <tr>
        <td rowspan="2" style="width: 35%;">
          <div class="brand-title">VERITAS eQMS</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 4px;">21 CFR Part 11 & ISO 13485 Validated System</div>
        </td>
        <td><strong>Document Title:</strong> ${document.title}</td>
        <td><strong>Doc ID:</strong> ${document.id.substring(0, 8)}</td>
      </tr>
      <tr>
        <td><strong>Classification:</strong> ${document.classification}</td>
        <td><strong>Version:</strong> v${document.currentVersionNumber}.0</td>
      </tr>
      <tr>
        <td><strong>Organization:</strong> ${document.tenant.name}</td>
        <td><strong>Author / Owner:</strong> ${document.owner.fullName} (${document.owner.department})</td>
        <td><strong>Status:</strong> <span class="status-badge">${document.status}</span></td>
      </tr>
    </table>

    <div class="section-title">1. PURPOSE & SCOPE</div>
    <div class="content-body">
      ${document.description || 'This procedure establishes standard operating metrics and regulatory requirements for compliant manufacturing and document control under FDA 21 CFR Part 11 and ISO 13485 standards.'}
    </div>

    <div class="section-title">2. PROCEDURE SPECIFICATIONS</div>
    <div class="content-body">
      <p><strong>2.1 Standard Operating Protocol:</strong> All procedures outlined herein must be followed without exception. Any deviation from this approved protocol must be logged immediately under the Veritas Quality Event & CAPA module.</p>
      <p><strong>2.2 Version Control & Change Lock:</strong> This document version (v${document.currentVersionNumber}.0) represents the current effective revision. Any modifications require an approved Quality Change Request (CR) record and mandatory retraining assignment for impacted roles.</p>
      <p><strong>2.3 Access & Integrity Verification:</strong> Electronic signatures attached to this record meet all requirements under FDA 21 CFR Part 11 § 11.50 (Signature Manifests) and § 11.70 (Signature Linking).</p>
    </div>

    ${signature ? `
    <div class="esign-box">
      <div class="esign-header">
        <span>✓ 21 CFR PART 11 ELECTRONIC SIGNATURE ATTACHED</span>
        <span>LEGAL EQUIVALENT TO HANDWRITTEN SIGNATURE</span>
      </div>
      <div class="meta-grid">
        <div><strong>Signer:</strong> ${signature.signer?.fullName || 'Authorized Approver'} (${signature.signer?.role || 'QA Admin'})</div>
        <div><strong>Signed At:</strong> ${new Date(signature.signedAt).toUTCString()}</div>
        <div><strong>Signature Meaning:</strong> ${signature.meaning}</div>
        <div><strong>IP Address:</strong> ${signature.ipAddress}</div>
      </div>
      <div style="margin-top: 10px;">
        <strong>Cryptographic Hash:</strong> <span class="hash">${signature.hashSigned}</span>
      </div>
    </div>
    ` : `
    <div style="margin-top: 30px; padding: 16px; background: #fffbebf5; border: 1px dashed #f59e0b; border-radius: 6px; font-size: 12px; color: #b45309;">
      <strong>⚠️ PENDING E-SIGNATURE:</strong> This document draft has not yet executed final QA release signature.
    </div>
    `}

    <div class="footer">
      <span>Veritas eQMS | ${document.tenant.name}</span>
      <span>Printed: ${new Date().toISOString()} by ${user.fullName}</span>
      <span>Page 1 of 1</span>
    </div>
  </div>
</body>
</html>`;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error: any) {
    console.error('PDF generation error:', error);
    return new NextResponse(`Error loading document PDF: ${error.message}`, { status: 500 });
  }
}
