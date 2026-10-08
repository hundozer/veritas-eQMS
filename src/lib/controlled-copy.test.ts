import { describe, expect, it, vi } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { PDFParse } from 'pdf-parse';

vi.mock('server-only', () => ({}));

import { CopyMarkingError, markPdf, markText, selectCopyVersion, uncontrolledMarking } from './controlled-copy';

const versions = [
  { versionNumber: 3, status: 'DRAFT' },
  { versionNumber: 2, status: 'EFFECTIVE' },
  { versionNumber: 1, status: 'SUPERSEDED' },
];

const details = {
  marking: 'UNCONTROLLED COPY - SUPERSEDED - NOT FOR USE',
  documentNumber: 'SOP-0001',
  versionNumber: 1,
  printedBy: 'Gábor Kőváry',
  printedAt: new Date('2026-10-07T12:00:00Z'),
};

async function pdfWithPages(count: number) {
  const pdf = await PDFDocument.create();
  for (let index = 0; index < count; index += 1) pdf.addPage([595, 842]);
  return pdf.save();
}

async function textOf(bytes: Uint8Array) {
  const parser = new PDFParse({ data: bytes });
  try {
    return (await parser.getText()).text;
  } finally {
    await parser.destroy();
  }
}

describe('controlled copies', () => {
  it('COPY-T001 a reader gets the effective version unless they ask for another', () => {
    expect(selectCopyVersion(versions, 3, null)?.versionNumber).toBe(2);
    expect(selectCopyVersion(versions, 3, '1')?.versionNumber).toBe(1);
    expect(selectCopyVersion(versions, 3, '9')).toBeUndefined();
    for (const malformed of ['', '0', '-1', '1.5', '1e0', ' 1', 'abc']) {
      expect(selectCopyVersion(versions, 3, malformed)).toBeUndefined();
    }
  });

  it('COPY-T002 without an effective version the current version is chosen', () => {
    const retired = [{ versionNumber: 2, status: 'WITHDRAWN' }, { versionNumber: 1, status: 'OBSOLETE' }];
    expect(selectCopyVersion(retired, 1, null)?.versionNumber).toBe(1);
    expect(selectCopyVersion([{ versionNumber: 1, status: 'DRAFT' }], 1, null)?.versionNumber).toBe(1);
  });

  it('COPY-T003 only the effective version is unmarked', () => {
    expect(uncontrolledMarking('EFFECTIVE')).toBeNull();
    for (const status of ['DRAFT', 'IN_REVIEW', 'APPROVED', 'SUPERSEDED', 'OBSOLETE', 'WITHDRAWN', 'SOMETHING_NEW']) {
      expect(uncontrolledMarking(status)).toMatch(/^UNCONTROLLED COPY - .+ - NOT FOR USE$/);
    }
    expect(uncontrolledMarking('SUPERSEDED')).toContain('SUPERSEDED');
  });

  it('COPY-T004 every page of a PDF carries the marking, the version and who printed it', async () => {
    const marked = await markPdf(await pdfWithPages(2), details);
    const pdf = await PDFDocument.load(marked);

    expect(pdf.getPageCount()).toBe(2);
    expect(pdf.getSubject()).toBe(details.marking);
    const text = await textOf(marked);
    expect(text.match(/UNCONTROLLED COPY - SUPERSEDED - NOT FOR USE/g)?.length).toBeGreaterThanOrEqual(4);
    expect(text).toContain('SOP-0001 v1');
    // Characters the standard font cannot draw are replaced rather than failing the copy.
    expect(text).toContain('printed 2026-10-07T12:00:00.000Z by Gábor K?váry');
  });

  it('COPY-T005 a file that cannot be marked is refused, never passed through', async () => {
    await expect(markPdf(new TextEncoder().encode('not a pdf'), details)).rejects.toBeInstanceOf(CopyMarkingError);
  });

  it('COPY-T006 a text file starts with the marking', () => {
    const marked = new TextDecoder().decode(markText(new TextEncoder().encode('Step 1'), details));
    expect(marked.startsWith(`${details.marking}\nSOP-0001 v1`)).toBe(true);
    expect(marked.endsWith('\n\nStep 1')).toBe(true);
  });
});
