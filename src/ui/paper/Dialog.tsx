'use client';
import { useEffect, useId, useRef, type FormEvent, type ReactNode } from 'react';
import styles from './paper.module.css';
import { Button } from './Button';
import { FormError } from './Notice';

// A modal form on a native <dialog>: the browser traps focus, Escape and the
// close button cancel, and focus returns to the opener when it closes. Use it
// for creating a record and for signing; an action on an open record uses an
// in-page FormSheet instead. Render it only while it is open.
export function Dialog({ title, error, busy = false, submit, onSubmit, onCancel, children }: {
  title: string;
  error?: string | null;
  busy?: boolean;
  submit: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const opener = document.activeElement as HTMLElement | null;
    if (!dialog.open) dialog.showModal?.();
    return () => {
      if (dialog.open) dialog.close();
      opener?.focus?.();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={titleId}
      aria-modal="true"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <form className={styles.dialogForm} onSubmit={onSubmit}>
        <div className={styles.dialogHead}>
          <h3 id={titleId} className={styles.formSheetTitle}>{title}</h3>
          <button type="button" className={styles.close} onClick={onCancel} disabled={busy} aria-label="Close">×</button>
        </div>
        {children}
        {error && <FormError>{error}</FormError>}
        <div className={styles.formButtons}>
          <Button type="submit" variant="primary" disabled={busy}>{busy ? 'Working…' : submit}</Button>
          <Button variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
        </div>
      </form>
    </dialog>
  );
}
