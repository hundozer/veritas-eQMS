import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LoginErrorNotice } from '../ui/components/LoginErrorNotice';

describe('sign-in error notice', () => {
  it('LOGINUI-T001 announces a refused sign-in inside the dialog', () => {
    const html = renderToStaticMarkup(createElement(LoginErrorNotice, { message: 'Invalid email or password' }));
    expect(html).toContain('role="alert"');
    expect(html).toContain('Invalid email or password');
  });

  it('LOGINUI-T002 renders nothing when there is no error', () => {
    expect(renderToStaticMarkup(createElement(LoginErrorNotice, { message: null }))).toBe('');
  });
});
