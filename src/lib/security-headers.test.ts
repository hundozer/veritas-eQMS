import { describe, expect, it } from 'vitest';
import { getPathMatch } from 'next/dist/shared/lib/router/utils/path-match';
import nextConfig from '../../next.config';

// Same matcher options Next.js uses for config header rules.
async function headersFor(pathname: string) {
  const rules = await nextConfig.headers!();
  const result: Record<string, string> = {};
  for (const rule of rules) {
    if (getPathMatch(rule.source, { strict: true, removeUnnamedParams: true })(pathname)) {
      for (const header of rule.headers) result[header.key] = header.value;
    }
  }
  return result;
}

describe('security headers', () => {
  it('SECHDR-T001 sends the baseline security headers on pages and API routes', async () => {
    for (const pathname of ['/', '/api/documents/doc-1', '/api/trainings']) {
      const headers = await headersFor(pathname);
      expect(headers['Strict-Transport-Security']).toBe('max-age=63072000; includeSubDomains');
      expect(headers['X-Content-Type-Options']).toBe('nosniff');
      expect(headers['X-Frame-Options']).toBe('DENY');
      expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
      expect(headers['Permissions-Policy']).toContain('camera=()');
      expect(headers['Content-Security-Policy']).toContain("frame-ancestors 'none'");
      expect(headers['Content-Security-Policy']).toContain("object-src 'none'");
    }
  });

  it('SECHDR-T002 leaves the PDF viewer its own content security policy', async () => {
    const headers = await headersFor('/api/documents/doc-1/pdf');
    expect(headers['Content-Security-Policy']).toBeUndefined();
  });

  it('SECHDR-T005 lets the PDF viewer embed its own file but keeps other paths unframeable', async () => {
    expect((await headersFor('/api/documents/doc-1/pdf'))['X-Frame-Options']).toBe('SAMEORIGIN');
    for (const pathname of ['/', '/api/documents/doc-1', '/api/documents/doc-1/pdfx', '/api/documents/doc-1/pdf/extra']) {
      expect((await headersFor(pathname))['X-Frame-Options']).toBe('DENY');
    }
  });

  it('SECHDR-T003 only exempts the exact PDF viewer path', async () => {
    for (const pathname of ['/api/documents/doc-1/pdfx', '/api/documents/doc-1/pdf/extra', '/api/documents/pdf']) {
      expect((await headersFor(pathname))['Content-Security-Policy']).toBeDefined();
    }
  });

  it('SECHDR-T004 does not advertise the framework', () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });
});
