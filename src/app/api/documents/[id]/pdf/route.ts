import { NextRequest, NextResponse } from 'next/server';
import { tenantRead } from '@/lib/tenant-db';
import { getContext } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { sanitizeDisplayFileName, sha256, vercelBlobStorage, verifyControlledObject } from '@/lib/controlled-storage';
import { CopyMarkingError, markPdf, markText, selectCopyVersion, uncontrolledMarking } from '../../../../../lib/controlled-copy';
import { reportServerError, unexpectedErrorResponse } from '../../../../../lib/server-errors';

function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// GET /api/documents/[id]/pdf - Render an authorized controlled-copy viewer
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getContext(req);
    if (!user) {
      return new NextResponse('Unauthorized: Please log in to view controlled document', { status: 401 });
    }
    if (!hasPermission(user, 'documents.read')) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    const document = await tenantRead(user.tenantId, (tx) => tx.document.findFirst({
      where: { id, tenantId: user.tenantId },
      select: {
        id: true,
        title: true,
        documentNumber: true,
        classification: true,
        status: true,
        currentVersionNumber: true,
        owner: { select: { fullName: true, department: true } },
        tenant: { select: { name: true } },
        versions: {
          orderBy: { versionNumber: 'desc' },
          select: {
            versionNumber: true,
            status: true,
            mimeType: true,
            storageKey: true,
            hash: true,
            fileData: true,
            originalFileName: true,
            signatures: {
              orderBy: { signedAt: 'asc' },
              select: {
                signedAt: true,
                meaning: true,
                ipAddress: true,
                hashSigned: true,
                iamUserId: true,
                signerName: true,
                signerRole: true,
                signer: { select: { fullName: true, role: true } },
              },
            },
          },
        },
      },
    }));

    if (!document) {
      return new NextResponse('404: Document Not Found', { status: 404 });
    }

    // Readers get the effective version unless they ask for another (DEC-067).
    const latestVersion = selectCopyVersion(document.versions, document.currentVersionNumber, req.nextUrl.searchParams.get('version'));
    if (!latestVersion) return new NextResponse('404: Document Version Not Found', { status: 404 });
    const signatures = latestVersion.signatures;
    const marking = uncontrolledMarking(latestVersion.status);
    const isRaw = req.nextUrl.searchParams.get('raw') === 'true';

    // Resolve storage identity only from authorized database metadata. Client-supplied
    // Blob URLs or keys are never accepted by this route.
    if (isRaw && latestVersion) {
      let bytes: Uint8Array;
      let contentType = latestVersion.mimeType || 'application/pdf';
      try {
        if (latestVersion.storageKey) {
          const object = await verifyControlledObject(vercelBlobStorage, latestVersion.storageKey, latestVersion.hash);
          bytes = object.bytes;
          contentType = latestVersion.mimeType || object.contentType;
        } else if (latestVersion.fileData) {
          bytes = new Uint8Array(Buffer.from(latestVersion.fileData, 'base64'));
          if (sha256(bytes) !== latestVersion.hash) {
            return new NextResponse('Controlled document integrity verification failed', { status: 409 });
          }
        } else {
          return new NextResponse('Controlled document content is unavailable', { status: 404 });
        }
      } catch (error) {
        reportServerError('document.retrieveControlledObject');
        return new NextResponse('Controlled document content could not be verified', { status: 409 });
      }

      // The effective version is served exactly as signed; any other version
      // carries its marking, or is named as uncontrolled where the format
      // cannot be stamped.
      let displayName = sanitizeDisplayFileName(latestVersion.originalFileName || `${document.title}-v${latestVersion.versionNumber}.pdf`);
      if (marking) {
        const details = {
          marking,
          documentNumber: document.documentNumber || document.id.substring(0, 8),
          versionNumber: latestVersion.versionNumber,
          printedBy: user.fullName,
          printedAt: new Date(),
        };
        if (contentType === 'application/pdf') {
          try {
            bytes = await markPdf(bytes, details);
          } catch (error) {
            if (!(error instanceof CopyMarkingError)) throw error;
            return new NextResponse('This version could not be marked as an uncontrolled copy, so it is not served', { status: 409 });
          }
        } else if (contentType === 'text/plain') {
          bytes = markText(bytes, details);
        }
        displayName = sanitizeDisplayFileName(`UNCONTROLLED-${latestVersion.status}-${displayName}`);
      }

      const disposition = contentType === 'application/pdf' ? 'inline' : 'attachment';
      return new NextResponse(Buffer.from(bytes), {
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `${disposition}; filename="${displayName}"`,
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
          'X-Veritas-Copy': marking ? 'uncontrolled' : 'effective',
        },
      });
    }

    // Always through the raw route, which marks non-effective versions; never an inline data URL.
    const rawUrl = `/api/documents/${document.id}/pdf?raw=true&version=${latestVersion.versionNumber}`;
    const pdfSource = latestVersion.storageKey || latestVersion.fileData ? rawUrl : null;
    const isPdf = (latestVersion.mimeType || 'application/pdf') === 'application/pdf';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(document.title)} — Veritas eQMS Watermarked Control Copy</title>
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
      <span style="font-size: 12px; color: #94a3b8; font-weight: 400;">| Controlled Document Copy</span>
    </div>
    <div style="display: flex; align-items: center; gap: 16px;">
      <span class="badge"${marking ? ' style="background: #e11d48; color: #ffffff;"' : ''}>v${escapeHtml(latestVersion.versionNumber)} ${escapeHtml(latestVersion.status)}</span>
      ${pdfSource ? `<a href="${escapeHtml(rawUrl)}" target="_blank" class="btn-download">📥 Open / Download File</a>` : ''}
    </div>
  </div>

  <div class="container">
    ${marking ? `<div class="watermark-banner" style="font-size: 16px; background: rgba(225, 29, 72, 0.15);">
      ⚠ ${escapeHtml(marking)}
    </div>` : `<div class="watermark-banner" style="color: #047857; border-color: rgba(4, 120, 87, 0.4); background: rgba(16, 185, 129, 0.08);">
      EFFECTIVE VERSION — VERIFY CURRENT STATUS BEFORE USE — DO NOT ALTER
    </div>`}

    <table class="header-table">
      <tr>
        <td rowspan="2" style="width: 30%;">
          <div style="font-size: 16px; font-weight: 800; color: #0f172a;">VERITAS eQMS</div>
          <div style="font-size: 10px; color: #64748b;">Veritas controlled-document metadata</div>
        </td>
        <td><strong>Title:</strong> ${escapeHtml(document.title)}</td>
        <td><strong>Doc No.:</strong> ${escapeHtml(document.documentNumber || document.id.substring(0, 8))}</td>
      </tr>
      <tr>
        <td><strong>Classification:</strong> ${escapeHtml(document.classification)}</td>
        <td><strong>Version:</strong> v${escapeHtml(latestVersion.versionNumber)} (${escapeHtml(latestVersion.status)})</td>
      </tr>
      <tr>
        <td><strong>Tenant:</strong> ${escapeHtml(document.tenant.name)}</td>
        <td><strong>Owner:</strong> ${escapeHtml(document.owner.fullName)} (${escapeHtml(document.owner.department)})</td>
        <td><strong>Document status:</strong> ${escapeHtml(document.status)}</td>
      </tr>
    </table>

    ${signatures.length > 0 ? signatures.map((signature) => {
      // Rows without iamUserId predate password re-entry signing (DEC-062).
      const verifiedSigner = Boolean(signature.iamUserId);
      const name = signature.signerName || signature.signer?.fullName || 'Unknown signer';
      const role = signature.signerRole || signature.signer?.role || 'Unknown role';
      const matchesContent = signature.hashSigned === latestVersion.hash;
      return `
    <div class="esign-box">
      <div class="esign-header">
        <span>${verifiedSigner ? 'ELECTRONIC SIGNATURE' : 'LEGACY SIGNATURE METADATA'}</span>
        <span>${verifiedSigner ? (matchesContent ? 'SIGNED CONTENT MATCHES THIS VERSION' : 'SIGNED AN EARLIER DRAFT OF THIS VERSION') : 'SIGNER NOT VERIFIED BY PASSWORD'}</span>
      </div>
      <div class="meta-grid">
        <div><strong>Signer:</strong> ${escapeHtml(name)} (${escapeHtml(role)})</div>
        <div><strong>Timestamp (UTC):</strong> ${escapeHtml(new Date(signature.signedAt).toUTCString())}</div>
        <div><strong>Signature Meaning:</strong> ${escapeHtml(signature.meaning)}</div>
        <div><strong>IP Address:</strong> ${escapeHtml(signature.ipAddress)}</div>
      </div>
      <div style="margin-top: 6px;">
        <strong>SHA-256 Hash:</strong> <span class="hash">${escapeHtml(signature.hashSigned)}</span>
      </div>
    </div>`;
    }).join('') : `
    <div style="margin-bottom: 20px; padding: 12px; background: #fffbebf5; border: 1px dashed #f59e0b; border-radius: 6px; font-size: 12px; color: #b45309;">
      <strong>WORKFLOW STATUS:</strong> No signature has been recorded for this document version.
    </div>
    `}

    <div style="margin-bottom: 12px; font-weight: 700; font-size: 13px; color: #334155;">
      📄 UPLOADED PHYSICAL SOP ATTACHMENT PREVIEW:
    </div>

    ${pdfSource && isPdf ? `
      <object data="${escapeHtml(pdfSource)}" type="application/pdf" class="pdf-frame">
        <embed src="${escapeHtml(pdfSource)}" type="application/pdf" class="pdf-frame" />
        <div style="padding: 24px; text-align: center; color: #64748b;">
          PDF Preview unavailable in this browser engine. <a href="${escapeHtml(rawUrl)}" target="_blank" style="color: #0284c7; font-weight: 600;">Click here to open the file directly.</a>
        </div>
      </object>
    ` : `
      <div style="padding: 40px; background: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 6px; text-align: center; color: #64748b; font-size: 14px;">
        ${pdfSource ? 'This file is not a PDF and cannot be previewed here; use Open / Download File.' : 'No file is attached to this version.'}
      </div>
    `}

    <div class="footer">
      <span>Veritas eQMS | ${escapeHtml(document.tenant.name)}</span>
      <span>Printed: ${escapeHtml(new Date().toISOString())} by ${escapeHtml(user.fullName)}</span>
      <span>Page 1 of 1</span>
    </div>
  </div>
</body>
</html>`;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; object-src 'self'; frame-src 'self'; img-src data:; base-uri 'none'; form-action 'none'",
      },
    });
  } catch (error: any) {
    return unexpectedErrorResponse('document.pdf');
  }
}
