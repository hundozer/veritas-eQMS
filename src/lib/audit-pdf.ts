import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib';
import type { AuditEntry, AuditFilters } from './audit-query';
import { encodable } from './controlled-copy';

// PDF of the audit review (DEC-078): who exported what and when, the filters,
// then each entry with its field changes and recorded details, newest first.

export type AuditPdfInput = {
  tenantName: string;
  exportedBy: string;
  exportedAt: Date;
  filters: AuditFilters;
  entries: AuditEntry[];
  truncated: boolean;
};

/** Most entries one export holds; older ones need narrower filters. */
export const AUDIT_EXPORT_LIMIT = 1000;

const PAGE = { width: 595.28, height: 841.89, margin: 40 };

export async function renderAuditPdf(input: AuditPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const writer = new Writer(pdf, regular);

  writer.line(`Audit review - ${input.tenantName}`, { font: bold, size: 14 });
  writer.line(`Exported ${input.exportedAt.toISOString()} by ${input.exportedBy}`);
  writer.line(`Filters: ${describeFilters(input.filters)}`);
  writer.line(`${input.entries.length} entries, newest first${input.truncated ? ' (limit reached; narrow the filters for older entries)' : ''}`);
  writer.gap(10);

  if (input.entries.length === 0) writer.line('No audit entries match these filters.');
  for (const entry of input.entries) {
    writer.line(`${entry.timestamp.toISOString()}  ${entry.action}  ${entry.status}`, { font: bold });
    writer.line(`By ${entry.userEmail ?? 'unknown'}${entry.userRole ? ` (${entry.userRole})` : ''} on ${entry.objectType}${entry.objectId ? ` ${entry.objectId}` : ''}`);
    for (const change of entry.changes) {
      writer.line(`${change.field}: ${change.before || '-'} -> ${change.after || '-'}`, { indent: 12 });
    }
    for (const detail of entry.details) {
      writer.line(`${detail.field}: ${detail.value || '-'}`, { indent: 12, color: rgb(0.35, 0.35, 0.35) });
    }
    writer.line(`Event ${entry.eventId}`, { size: 7, color: rgb(0.5, 0.5, 0.5) });
    writer.gap(6);
  }

  writer.footers(`Audit review - ${input.tenantName} - exported ${input.exportedAt.toISOString()}`);
  pdf.setTitle(`Audit review - ${input.tenantName}`);
  pdf.setCreationDate(input.exportedAt);
  return pdf.save();
}

export function describeFilters(filters: AuditFilters): string {
  const parts = [
    filters.action && `action ${filters.action}`,
    filters.objectType && `object type ${filters.objectType}`,
    filters.objectId && `object ${filters.objectId}`,
    filters.userId && `user ${filters.userId}`,
    filters.startDate && `from ${filters.startDate.toISOString()}`,
    filters.endDate && `to ${filters.endDate.toISOString()}`,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : 'none';
}

class Writer {
  private page: PDFPage;
  private y = PAGE.height - PAGE.margin;
  private readonly pages: PDFPage[] = [];

  constructor(private readonly pdf: PDFDocument, private readonly regular: PDFFont) {
    this.page = this.newPage();
  }

  line(text: string, options: { font?: PDFFont; size?: number; indent?: number; color?: ReturnType<typeof rgb> } = {}) {
    const font = options.font ?? this.regular;
    const size = options.size ?? 9;
    const indent = options.indent ?? 0;
    const width = PAGE.width - 2 * PAGE.margin - indent;
    for (const part of wrap(font, encodable(font, text), size, width)) {
      if (this.y - size < PAGE.margin + 14) {
        this.page = this.newPage();
      }
      this.y -= size + 3;
      this.page.drawText(part, { x: PAGE.margin + indent, y: this.y, size, font, color: options.color ?? rgb(0, 0, 0) });
    }
  }

  gap(points: number) {
    this.y -= points;
  }

  footers(text: string) {
    this.pages.forEach((page, index) => {
      const footer = encodable(this.regular, `${text} - page ${index + 1} of ${this.pages.length}`);
      page.drawText(footer, { x: PAGE.margin, y: PAGE.margin / 2, size: 7, font: this.regular, color: rgb(0.4, 0.4, 0.4) });
    });
  }

  private newPage() {
    const page = this.pdf.addPage([PAGE.width, PAGE.height]);
    this.pages.push(page);
    this.y = PAGE.height - PAGE.margin;
    return page;
  }
}

/** Breaks text into lines that fit the width, splitting long words if needed. */
function wrap(font: PDFFont, text: string, size: number, width: number): string[] {
  const lines: string[] = [];
  let current = '';
  for (const word of text.split(' ')) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= width) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = word;
    while (font.widthOfTextAtSize(current, size) > width) {
      let cut = current.length - 1;
      while (cut > 1 && font.widthOfTextAtSize(current.slice(0, cut), size) > width) cut -= 1;
      lines.push(current.slice(0, cut));
      current = current.slice(cut);
    }
  }
  lines.push(current);
  return lines;
}
