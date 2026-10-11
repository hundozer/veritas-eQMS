import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ReasonForm, RoutingForm } from '../app/(app)/app/ActionForm';
import { appPageSource } from '../test-support/app-pages';

const noop = async () => null;
const members = [
  { id: 'u1', fullName: 'Ada Reviewer', email: 'ada@example.test' },
  { id: 'u2', fullName: 'Zoe Approver', email: 'zoe@example.test' },
];

describe('in-page action forms', () => {
  it('ACTION-FORM-T005 routing offers the members by name in labelled lists, not an email prompt', () => {
    const html = renderToStaticMarkup(createElement(RoutingForm, { candidates: members, onSubmit: noop, onCancel: () => {} }));
    expect(html).toMatch(/<label for="[^"]+"[^>]*>Reviewer<\/label><select id="[^"]+"/);
    expect(html).toMatch(/<label for="[^"]+"[^>]*>Approver<\/label><select id="[^"]+"/);
    expect(html.match(/<option value="u1"[^>]*>Ada Reviewer \(ada@example.test\)<\/option>/g)).toHaveLength(2);
    expect(html).toContain('Submit for review');
  });

  it('ACTION-FORM-T006 a new revision asks for the reason and the source file in the page', () => {
    const html = renderToStaticMarkup(createElement(ReasonForm, { kind: 'START_REVISION', subject: 'SOP-001 rev 3', onSubmit: noop, onCancel: () => {} }));
    expect(html).toContain('Reason for the revision');
    const accept = html.match(/<input[^>]*type="file"[^>]*accept="([^"]+)"/)?.[1].split(',');
    expect(accept).toEqual(expect.arrayContaining(['.pdf', '.docx', '.xlsx', '.pptx', '.txt']));
    expect(accept).not.toEqual(expect.arrayContaining(['.doc']));
    expect(accept).not.toEqual(expect.arrayContaining(['.png']));
    expect(html).toContain('SOP-001 rev 3');
  });

  it('ACTION-FORM-T007 return and reset forms ask only for a reason', () => {
    for (const kind of ['RETURN', 'WITHDRAW_REVISION', 'RESET_TWO_STEP'] as const) {
      const html = renderToStaticMarkup(createElement(ReasonForm, { kind, onSubmit: noop, onCancel: () => {} }));
      expect(html).toContain('<textarea');
      expect(html).not.toContain('type="file"');
    }
  });

  it('ACTION-FORM-T008 the workspace uses no browser prompt dialogs', () => {
    expect(appPageSource()).not.toMatch(/window\.(prompt|confirm|alert)\(/);
  });
});
