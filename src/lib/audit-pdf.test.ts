import { describe, expect, it, vi } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { pdfText } from '../test-support/pdf-text';

vi.mock('server-only', () => ({}));

import { renderAuditPdf } from './audit-pdf';
import type { AuditEntry } from './audit-query';

const entry = (index: number, over: Partial<AuditEntry> = {}): AuditEntry => ({
  id: `log-${index}`, eventId: `event-${index}`, timestamp: new Date(Date.UTC(2026, 9, 10, 8, 0, index)),
  userEmail: 'qa@example.invalid', userRole: 'Quality Manager', action: 'DOCUMENT_APPROVED',
  objectType: 'DocumentVersion', objectId: `version-${index}`, status: 'Success',
  changes: [{ field: 'status', before: 'IN_REVIEW', after: 'APPROVED' }],
  details: [{ field: 'comment', value: 'checked' }],
  ...over,
});

const base = { tenantName: 'Acme GmbH', exportedBy: 'auditor@example.invalid', exportedAt: new Date('2026-10-10T09:00:00.000Z'), truncated: false };

describe('audit review PDF', () => {
  it('AUDPDF-T001 states who exported what and when, then each entry with its changes and details', async () => {
    const bytes = await renderAuditPdf({ ...base, filters: { action: 'DOCUMENT_APPROVED' }, entries: [entry(1)] });
    const text = pdfText(bytes);

    expect(text).toContain('Audit review - Acme GmbH');
    expect(text).toContain('Exported 2026-10-10T09:00:00.000Z by auditor@example.invalid');
    expect(text).toContain('Filters: action DOCUMENT_APPROVED');
    expect(text).toContain('1 entries, newest first');
    expect(text).toContain('2026-10-10T08:00:01.000Z  DOCUMENT_APPROVED  Success');
    expect(text).toContain('By qa@example.invalid (Quality Manager) on DocumentVersion version-1');
    expect(text).toContain('status: IN_REVIEW -> APPROVED');
    expect(text).toContain('comment: checked');
    expect((await PDFDocument.load(bytes)).getTitle()).toBe('Audit review - Acme GmbH');
  });

  it('AUDPDF-T002 many entries flow onto numbered pages; a cut-off export says so', async () => {
    const entries = Array.from({ length: 120 }, (_, index) => entry(index));
    const bytes = await renderAuditPdf({ ...base, filters: {}, entries, truncated: true });
    const pages = (await PDFDocument.load(bytes)).getPageCount();
    const text = pdfText(bytes);

    expect(pages).toBeGreaterThan(3);
    expect(text).toContain(`page ${pages} of ${pages}`);
    expect(text).toContain('limit reached; narrow the filters for older entries');
    expect(text).toContain('Filters: none');
    expect(text).toContain('event-119');
  });

  it('AUDPDF-T003 characters the font cannot draw and very long values do not break the export', async () => {
    const bytes = await renderAuditPdf({
      ...base, filters: {}, entries: [entry(1, { userEmail: 'zoë@example.invalid', details: [{ field: 'note', value: `名前 ${'x'.repeat(400)}` }] })],
    });
    const text = pdfText(bytes);
    expect(text).toContain('zoë@example.invalid');
    expect(text).toContain('note: ??\nxxx');
    expect(text.split('\n').every((line) => line.length < 200)).toBe(true);
    expect(pdfText(await renderAuditPdf({ ...base, filters: {}, entries: [] }))).toContain('No audit entries match these filters.');
  });
});
