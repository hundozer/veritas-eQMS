import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getContext } from '@/lib/auth';

// GET /api/documents/[id]/pdf - Render watermarked GxP PDF viewer with exact uploaded file content + 21 CFR Part 11 metadata
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
    const isRaw = req.nextUrl.searchParams.get('raw') === 'true';

    // If raw binary PDF requested and fileData exists, return raw PDF stream
    if (isRaw && latestVersion?.fileData) {
      const buffer = Buffer.from(latestVersion.fileData, 'base64');
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${document.title.replace(/[^a-z0-9]/gi, '_')}-v${latestVersion.versionNumber}.pdf"`,
        },
      });
    }

    const pdfDataUri = latestVersion?.fileData
      ? `data:application/pdf;base64,${latestVersion.fileData}`
      : null;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${document.title} — Veritas eQMS Watermarked Control Copy</title>
  <style>
    @page { size: A4; margin: 10mm; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background-color: #0f172a;
      margin: 0;
      padding: 24px;
    }
    .top-control-bar {
      max-width: 1000px;
      margin: 0 auto 20px auto;
      background: #1e293b;
      border: 1px solid #334155;
      padding: 16px 24px;
      border-radius: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: #f8fafc;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }
    .brand {
      font-size: 18px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #38bdf8;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      background: #10b981;
      color: #022c22;
    }
    .btn-download {
      background: #0284c7;
      color: #ffffff;
      padding: 8px 16px;
      border-radius: 6px;
      text-decoration: none;
      font-weight: 600;
      font-size: 13px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: background 0.2s;
    }
    .btn-download:hover {
      background: #0369a1;
    }
    .container {
      max-width: 1000px;
      margin: 0 auto;
      background: #ffffff;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
      position: relative;
    }
    .watermark-banner {
      background: rgba(225, 29, 72, 0.08);
      border: 1px solid rgba(225, 29, 72, 0.3);
      color: #e11d48;
      text-align: center;
      padding: 10px;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 2px;
      text-transform: uppercase;
      border-radius: 6px;
      margin-bottom: 24px;
    }
    .header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
      border: 2px solid #0f172a;
    }
    .header-table td {
      border: 1px solid #cbd5e1;
      padding: 10px 14px;
      font-size: 12px;
    }
    .esign-box {
      margin-bottom: 24px;
      padding: 16px 20px;
      background: #f0fdf4;
      border: 1.5px solid #22c55e;
      border-radius: 6px;
      font-size: 12px;
    }
    .esign-header {
      font-weight: 800;
      color: #15803d;
      font-size: 12px;
      margin-bottom: 6px;
      display: flex;
      justify-content: space-between;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
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
    .pdf-frame {
      width: 100%;
      height: 900px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      background: #525659;
    }
    .footer {
      margin-top: 24px;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
      font-size: 11px;
      color: #64748b;
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>

  <div class="top-control-bar">
    <div class="brand">
      <span>🛡️ VERITAS eQMS</span>
      <span style="font-size: 12px; color: #94a3b8; font-weight: 400;">| 21 CFR Part 11 Controlled Record</span>
    </div>
    <div style="display: flex; align-items: center; gap: 16px;">
      <span class="badge">${document.status}</span>
      ${pdfDataUri ? `<a href="/api/documents/${document.id}/pdf?raw=true" target="_blank" class="btn-download">📥 Open / Download Raw Uploaded PDF</a>` : ''}
    </div>
  </div>

  <div class="container">
    <div class="watermark-banner">
      ⚠ CONTROLLED GxP RECORD — 21 CFR PART 11 VALIDATED SYSTEM — DO NOT ALTER
    </div>

    <table class="header-table">
      <tr>
        <td rowspan="2" style="width: 30%;">
          <div style="font-size: 16px; font-weight: 800; color: #0f172a;">VERITAS eQMS</div>
          <div style="font-size: 10px; color: #64748b;">FDA 21 CFR Part 11 / ISO 13485</div>
        </td>
        <td><strong>Title:</strong> ${document.title}</td>
        <td><strong>Doc ID:</strong> ${document.id.substring(0, 8)}</td>
      </tr>
      <tr>
        <td><strong>Classification:</strong> ${document.classification}</td>
        <td><strong>Revision:</strong> v${document.currentVersionNumber}.0</td>
      </tr>
      <tr>
        <td><strong>Tenant:</strong> ${document.tenant.name}</td>
        <td><strong>Owner:</strong> ${document.owner.fullName} (${document.owner.department})</td>
        <td><strong>Status:</strong> ${document.status}</td>
      </tr>
    </table>

    ${signature ? `
    <div class="esign-box">
      <div class="esign-header">
        <span>✓ 21 CFR PART 11 ELECTRONIC SIGNATURE VALIDATED</span>
        <span>LEGAL EQUIVALENT TO HANDWRITTEN SIGNATURE</span>
      </div>
      <div class="meta-grid">
        <div><strong>Signer:</strong> ${signature.signer?.fullName || 'Authorized Approver'} (${signature.signer?.role || 'QA Admin'})</div>
        <div><strong>Timestamp (UTC):</strong> ${new Date(signature.signedAt).toUTCString()}</div>
        <div><strong>Signature Meaning:</strong> ${signature.meaning}</div>
        <div><strong>IP Address:</strong> ${signature.ipAddress}</div>
      </div>
      <div style="margin-top: 6px;">
        <strong>SHA-256 Hash:</strong> <span class="hash">${signature.hashSigned}</span>
      </div>
    </div>
    ` : `
    <div style="margin-bottom: 20px; padding: 12px; background: #fffbebf5; border: 1px dashed #f59e0b; border-radius: 6px; font-size: 12px; color: #b45309;">
      <strong>⚠️ PENDING E-SIGNATURE:</strong> This document draft is awaiting final QA release approval.
    </div>
    `}

    <div style="margin-bottom: 12px; font-weight: 700; font-size: 13px; color: #334155;">
      📄 UPLOADED PHYSICAL SOP ATTACHMENT PREVIEW:
    </div>

    ${pdfDataUri ? `
      <object data="${pdfDataUri}" type="application/pdf" class="pdf-frame">
        <embed src="${pdfDataUri}" type="application/pdf" class="pdf-frame" />
        <div style="padding: 24px; text-align: center; color: #64748b;">
          PDF Preview unavailable in this browser engine. <a href="/api/documents/${document.id}/pdf?raw=true" target="_blank" style="color: #0284c7; font-weight: 600;">Click here to open raw PDF file directly.</a>
        </div>
      </object>
    ` : `
      <div style="padding: 40px; background: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 6px; text-align: center; color: #64748b; font-size: 14px;">
        No physical PDF file was attached during document draft creation.
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
