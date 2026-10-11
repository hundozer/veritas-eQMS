'use client';
import { useId, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import styles from './paper.module.css';
import { Button } from './Button';
import { FormError } from './Notice';

// An in-page form for an action that needs more than a click (a reason, a
// routing, a file), opened inside the record it acts on. Escape cancels;
// the submit button shows "Working…" while the request runs; a refusal from
// the server is shown in the form, which stays open.
export function FormSheet({ title, subject, note, error, busy, submit, onCancel, onSubmit, children }: {
  title: string;
  // The record acted on, e.g. "SOP-0001 rev 3".
  subject?: string;
  note: string;
  error: string | null;
  busy: boolean;
  submit: string;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
}) {
  const titleId = useId();
  const onKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key === 'Escape' && !busy) onCancel();
  };
  return (
    <form className={styles.formSheet} aria-labelledby={titleId} onSubmit={onSubmit} onKeyDown={onKeyDown} noValidate>
      <div className={styles.formSheetHead}>
        <h4 id={titleId} className={styles.formSheetTitle}>{title}</h4>
        {subject && <span className={styles.subject}>{subject}</span>}
      </div>
      <p className={styles.note}>{note}</p>
      {children}
      {error && <FormError>{error}</FormError>}
      <div className={styles.formButtons}>
        <Button type="submit" variant="primary" disabled={busy}>{busy ? 'Working…' : submit}</Button>
        <Button variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
      </div>
    </form>
  );
}
