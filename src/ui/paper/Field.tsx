'use client';
import { useId, type InputHTMLAttributes, type ReactNode, type Ref, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import styles from './paper.module.css';

// Labelled form controls. The label is always visible and tied to the
// control by id; a hint is tied by aria-describedby. Validation messages go
// in the form's FormError, not in red borders alone.

interface FieldShell {
  label: string;
  hint?: ReactNode;
}

function Shell({ id, label, hint, hintId, children }: FieldShell & { id: string; hintId: string; children: ReactNode }) {
  return (
    <div className={styles.fieldGroup}>
      <label htmlFor={id} className={styles.label}>{label}</label>
      {children}
      {hint && <span id={hintId} className={styles.hint}>{hint}</span>}
    </div>
  );
}

export function TextField({ label, hint, inputRef, ...props }: FieldShell & InputHTMLAttributes<HTMLInputElement> & { inputRef?: Ref<HTMLInputElement> }) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <Shell id={id} label={label} hint={hint} hintId={hintId}>
      <input id={id} ref={inputRef} className={styles.field} aria-describedby={hint ? hintId : undefined} {...props} />
    </Shell>
  );
}

export function TextAreaField({ label, hint, textareaRef, ...props }: FieldShell & TextareaHTMLAttributes<HTMLTextAreaElement> & { textareaRef?: Ref<HTMLTextAreaElement> }) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <Shell id={id} label={label} hint={hint} hintId={hintId}>
      <textarea id={id} ref={textareaRef} className={styles.field} rows={3} aria-describedby={hint ? hintId : undefined} {...props} />
    </Shell>
  );
}

export function SelectField({ label, hint, selectRef, children, ...props }: FieldShell & SelectHTMLAttributes<HTMLSelectElement> & { selectRef?: Ref<HTMLSelectElement> }) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <Shell id={id} label={label} hint={hint} hintId={hintId}>
      <select id={id} ref={selectRef} className={styles.field} aria-describedby={hint ? hintId : undefined} {...props}>{children}</select>
    </Shell>
  );
}

// Dates are entered as ISO dates (type="date") and shown as "11 Oct 2026"
// (src/ui/paper/format.ts).
export function DateField(props: FieldShell & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  return <TextField type="date" {...props} />;
}

export function FileField({ label, hint, ...props }: FieldShell & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <Shell id={id} label={label} hint={hint} hintId={hintId}>
      <input id={id} type="file" className={styles.file} aria-describedby={hint ? hintId : undefined} {...props} />
    </Shell>
  );
}

// Two fields side by side, stacking on narrow screens.
export function FieldPair({ children }: { children: ReactNode }) {
  return <div className={styles.pair}>{children}</div>;
}
