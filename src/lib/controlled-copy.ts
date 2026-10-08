import 'server-only';

import { degrees, PDFDocument, rgb, StandardFonts, type PDFFont } from 'pdf-lib';

// Controlled copies (DEC-067). Readers get the effective version unless they
// ask for another one. The effective version is served exactly as signed; any
// other version is marked as an uncontrolled copy of its status, so a draft,
// superseded or obsolete text cannot pass for the one in force.

export type CopyCandidate = { versionNumber: number; status: string };

/** The requested version, else the effective one, else the document's current version. */
export function selectCopyVersion<T extends CopyCandidate>(
  versions: readonly T[],
  currentVersionNumber: number,
  requested: string | null,
): T | undefined {
  if (requested !== null) {
    if (!/^[1-9]\d{0,5}$/.test(requested)) return undefined;
    return versions.find((version) => version.versionNumber === Number(requested));
  }
  return versions.find((version) => version.status === 'EFFECTIVE')
    ?? versions.find((version) => version.versionNumber === currentVersionNumber)
    ?? versions[0];
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'DRAFT',
  IN_REVIEW: 'IN REVIEW',
  APPROVED: 'APPROVED, NOT YET EFFECTIVE',
  SUPERSEDED: 'SUPERSEDED',
  OBSOLETE: 'OBSOLETE',
  WITHDRAWN: 'WITHDRAWN',
};

/** Null for the effective version; otherwise the marking every copy of the version carries. */
export function uncontrolledMarking(status: string): string | null {
  if (status === 'EFFECTIVE') return null;
  return `UNCONTROLLED COPY - ${STATUS_LABELS[status] ?? 'NOT EFFECTIVE'} - NOT FOR USE`;
}

export type CopyDetails = {
  marking: string;
  documentNumber: string;
  versionNumber: number;
  printedBy: string;
  printedAt: Date;
};

export class CopyMarkingError extends Error {
  constructor() {
    super('The file could not be marked as an uncontrolled copy');
    this.name = 'CopyMarkingError';
  }
}

function encodable(font: PDFFont, text: string): string {
  const supported = new Set(font.getCharacterSet());
  return Array.from(text, (character) => (supported.has(character.codePointAt(0)!) ? character : '?')).join('');
}

/** Stamps the marking across and along the foot of every page; never returns the file unmarked. */
export async function markPdf(bytes: Uint8Array, details: CopyDetails): Promise<Uint8Array> {
  let pdf: PDFDocument;
  try {
    pdf = await PDFDocument.load(bytes);
  } catch {
    throw new CopyMarkingError();
  }
  const pages = pdf.getPages();
  if (pages.length === 0) throw new CopyMarkingError();
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  const marking = encodable(font, details.marking);
  const footer = encodable(
    font,
    `${details.marking} | ${details.documentNumber} v${details.versionNumber} | printed ${details.printedAt.toISOString()} by ${details.printedBy}`,
  );
  const red = rgb(0.8, 0.07, 0.2);

  for (const page of pages) {
    const { width, height } = page.getSize();
    const diagonal = Math.hypot(width, height);
    const size = Math.max(12, Math.min(48, (diagonal * 0.8) / Math.max(1, font.widthOfTextAtSize(marking, 1))));
    const textWidth = font.widthOfTextAtSize(marking, size);
    const angle = Math.atan2(height, width);
    page.drawText(marking, {
      x: width / 2 - (Math.cos(angle) * textWidth) / 2 + (Math.sin(angle) * size) / 2,
      y: height / 2 - (Math.sin(angle) * textWidth) / 2 - (Math.cos(angle) * size) / 2,
      size,
      font,
      color: red,
      opacity: 0.3,
      rotate: degrees((angle * 180) / Math.PI),
    });
    const footerSize = Math.max(4, Math.min(8, (width - 24) / Math.max(1, font.widthOfTextAtSize(footer, 1))));
    page.drawText(footer, { x: 12, y: 8, size: footerSize, font, color: red });
  }
  pdf.setSubject(details.marking);
  pdf.setKeywords(['Veritas', 'uncontrolled copy']);
  return pdf.save();
}

/** Puts the marking at the top of a plain-text file. */
export function markText(bytes: Uint8Array, details: CopyDetails): Uint8Array {
  const banner = `${details.marking}\n${details.documentNumber} v${details.versionNumber} | printed ${details.printedAt.toISOString()} by ${details.printedBy}\n\n`;
  return new Uint8Array([...new TextEncoder().encode(banner), ...bytes]);
}
