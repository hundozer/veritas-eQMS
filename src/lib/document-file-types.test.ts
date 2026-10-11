import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { ALLOWED_UPLOAD_TYPES } from './controlled-storage';
import { DOCUMENT_FILE_ACCEPT, DOCUMENT_FILE_TYPES, DOCUMENT_FILE_TYPES_TEXT } from './document-file-types';
import { appPageSource } from '../test-support/app-pages';

describe('document file types', () => {
  it('FILETYPE-T001 the pickers offer exactly the types the server stores', () => {
    const accepted = DOCUMENT_FILE_ACCEPT.split(',');
    expect(accepted.filter((entry) => entry.startsWith('.'))).toEqual(['.pdf', '.docx', '.xlsx', '.pptx', '.txt']);
    expect(accepted.filter((entry) => !entry.startsWith('.')).sort()).toEqual([...ALLOWED_UPLOAD_TYPES].sort());
  });

  it('FILETYPE-T002 no picker in the workspace hard-codes its own list', () => {
    const source = appPageSource();
    expect(source).not.toMatch(/accept\s*=\s*["'][^"']*\.(pdf|docx?|png)/);
    expect(source).not.toMatch(/\.accept\s*=\s*['"]/);
  });

  it('FILETYPE-T003 the form names the accepted types in words', () => {
    expect(DOCUMENT_FILE_TYPES).toHaveLength(5);
    expect(DOCUMENT_FILE_TYPES_TEXT).toBe('PDF, Word (.docx), Excel (.xlsx), PowerPoint (.pptx) or plain text (.txt)');
  });
});
