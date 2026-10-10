import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AppShell } from '../ui/components/layout/AppShell';

describe('workspace shell', () => {
  it('SHELL-T001 shows the wordmark in the sidebar and the phone menu, and every image it loads exists', () => {
    const html = renderToStaticMarkup(createElement(AppShell, { navGroups: [] } as unknown as Parameters<typeof AppShell>[0], 'content'));
    expect(html.match(/VERITAS/g)).toHaveLength(2);
    const images = [...html.matchAll(/<img[^>]*src="([^"]+)"/g)].map((match) => match[1]);
    for (const src of images) {
      expect(src.startsWith('/') && existsSync(resolve('public', src.slice(1))), `missing image ${src}`).toBe(true);
    }
  });
});
