import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  Button,
  FormSheet,
  LifecyclePath,
  Notice,
  RecordHeader,
  SelectField,
  SignatureBoxes,
  SignatureDialog,
  Stamp,
  TextField,
  formatDate,
  shortHash,
  stateLabel,
} from './index';

const html = (element: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(element);
const noop = () => {};

describe('shared paper components', () => {
  it('DS-T010 a button never submits a form unless asked to', () => {
    expect(html(h(Button, { children: 'New draft' }))).toMatch(/^<button type="button" class="[^"]*outline/);
    expect(html(h(Button, { type: 'submit', variant: 'primary', children: 'Sign' }))).toMatch(/^<button type="submit" class="[^"]*primary/);
  });

  it('DS-T011 a stamp names the state in words and carries its state class', () => {
    expect(html(h(Stamp, { state: 'EFFECTIVE' }))).toMatch(/class="[^"]*stampEFFECTIVE[^"]*">EFFECTIVE</);
    expect(html(h(Stamp, { state: 'IN_REVIEW' }))).toContain('>IN REVIEW<');
    expect(stateLabel('PENDING_QA')).toBe('PENDING QA');
  });

  it('DS-T012 the record header spans the title across every identity column and labels each cell', () => {
    const markup = html(h(RecordHeader, {
      titleId: 't', title: 'Cleaning of the filling line', state: 'DRAFT',
      identity: [{ label: 'No.', value: 'SOP-0001', mono: true }, { label: 'Revision', value: 3 }, { label: 'Type', value: 'SOP', span: 2 }],
      details: [[{ label: 'Owner', value: 'Ada', span: 4 }]],
    }));
    expect(markup).toContain('<td colSpan="4"');
    expect(markup).toMatch(/<h3 id="t"[^>]*>Cleaning of the filling line<\/h3>/);
    expect(markup).toMatch(/>No\.<\/span><span class="[^"]*mono[^"]*">SOP-0001</);
    expect(markup).toContain('>DRAFT<');
  });

  it('DS-T013 the lifecycle path marks the current step for assistive technology and words the done steps', () => {
    const markup = html(h(LifecyclePath, { steps: ['Draft', 'In review', 'Approved'], current: 1 }));
    expect(markup).toMatch(/<ol aria-label="Lifecycle"/);
    expect(markup.match(/aria-current="step"/g)).toHaveLength(1);
    expect(markup).toMatch(/aria-current="step"><span[^>]*aria-hidden="true">2<\/span>In review/);
    expect(markup).toContain('Done: </span>Draft');
  });

  it('DS-T014 signature boxes show role, signer and state for every box', () => {
    const markup = html(h(SignatureBoxes, { boxes: [{ role: 'Review', name: 'Rui', state: 'signed' }, { role: 'Approve', name: '', state: 'not signed yet' }] }));
    expect(markup).toContain('--boxes:2');
    expect(markup).toMatch(/Review<\/span><span[^>]*>Rui<\/span><span[^>]*>signed/);
    expect(markup).toContain('not signed yet');
  });

  it('DS-T015 fields have a visible label tied to the control, and a hint tied by aria-describedby', () => {
    const text = html(h(TextField, { label: 'Title', hint: 'Shown in the register.' }));
    const id = text.match(/<label for="([^"]+)"/)?.[1];
    expect(id).toBeTruthy();
    expect(text).toContain(`<input id="${id}"`);
    expect(text).toContain(`aria-describedby="${id}-hint"`);
    expect(text).toContain(`<span id="${id}-hint"`);
    const select = html(h(SelectField, { label: 'Reviewer', children: h('option', { value: '' }, 'Choose a member') }));
    expect(select).toMatch(/<label for="([^"]+)"[^>]*>Reviewer<\/label><select id="\1"/);
    expect(select).not.toContain('aria-describedby');
  });

  it('DS-T016 errors are announced at once, other notices politely', () => {
    expect(html(h(Notice, { tone: 'error', children: 'Refused' }))).toContain('role="alert"');
    expect(html(h(Notice, { tone: 'success', children: 'Signed' }))).toContain('role="status"');
  });

  it('DS-T017 an in-page form shows the refusal as an alert and a busy state on its submit button', () => {
    const markup = html(h(FormSheet, {
      title: 'Return for changes', subject: 'SOP-0001 rev 3', note: 'Goes back to the author.', error: 'Document state changed',
      busy: true, submit: 'Return', onCancel: noop, onSubmit: noop, children: null,
    }));
    expect(markup).toMatch(/<form[^>]*aria-labelledby="([^"]+)"[^>]*>.*<h4 id="\1"/);
    expect(markup).toMatch(/<p class="[^"]*" role="alert">Document state changed<\/p>/);
    expect(markup).toMatch(/<button type="submit"[^>]*disabled="">Working…<\/button>/);
  });

  it('DS-T018 the signing dialog states record, version and meaning before asking for the password', () => {
    const markup = html(h(SignatureDialog, {
      title: 'Sign release', record: 'SOP-0001 Cleaning', version: 'Revision 3', meaning: 'Released',
      consequence: 'Makes this version effective.', reasonRequired: true, reason: '', onReasonChange: noop,
      password: '', onPasswordChange: noop, submit: 'Sign and make effective', onSubmit: noop, onCancel: noop,
    }));
    const manifest = markup.indexOf('<dl');
    const password = markup.indexOf('type="password"');
    expect(manifest).toBeGreaterThan(-1);
    expect(password).toBeGreaterThan(manifest);
    expect(markup).toMatch(/<dt>Record<\/dt><dd>SOP-0001 Cleaning<\/dd>/);
    expect(markup).toMatch(/<dt>Meaning<\/dt><dd[^>]*>Released<\/dd>/);
    expect(markup).toMatch(/type="password"[^>]*autocomplete="current-password"|autocomplete="current-password"[^>]*type="password"/i);
    expect(markup).toMatch(/Reason \(required\)<\/label><input[^>]*required=""/);
    expect(markup).toContain('aria-modal="true"');
  });

  it('DS-T019 dates show day first with the month abbreviated; hashes are shortened in tables', () => {
    expect(formatDate('2026-10-11T12:00:00Z')).toBe('11 Oct 2026');
    expect(shortHash('9f86d081884c7d659a2feaa0c55ad015')).toBe('9f86d081884c…');
  });
});
