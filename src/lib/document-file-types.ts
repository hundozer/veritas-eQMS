// The source-file types a controlled document may have. The server accepts
// exactly these MIME types (controlled-storage.ts), and every file picker
// offers exactly these, so nobody can choose a file that will be refused.
// Office files are the Open XML formats only; legacy .doc/.xls/.ppt are not
// accepted.

export const DOCUMENT_FILE_TYPES = [
  { extension: '.pdf', mimeType: 'application/pdf', label: 'PDF' },
  { extension: '.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', label: 'Word' },
  { extension: '.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', label: 'Excel' },
  { extension: '.pptx', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', label: 'PowerPoint' },
  { extension: '.txt', mimeType: 'text/plain', label: 'plain text' },
] as const;

export const DOCUMENT_MIME_TYPES: readonly string[] = DOCUMENT_FILE_TYPES.map((type) => type.mimeType);

// For <input type="file" accept>: extensions and MIME types both, as browsers
// match either.
export const DOCUMENT_FILE_ACCEPT = DOCUMENT_FILE_TYPES.flatMap((type) => [type.extension, type.mimeType]).join(',');

// "PDF, Word (.docx), Excel (.xlsx), PowerPoint (.pptx) or plain text (.txt)"
export const DOCUMENT_FILE_TYPES_TEXT = DOCUMENT_FILE_TYPES
  .map((type) => (type.extension === '.pdf' ? type.label : `${type.label} (${type.extension})`))
  .join(', ')
  .replace(/, ([^,]+)$/, ' or $1');
