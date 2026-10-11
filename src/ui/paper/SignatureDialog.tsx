'use client';
import type { FormEvent, ReactNode } from 'react';
import styles from './paper.module.css';
import { Dialog } from './Dialog';
import { TextField } from './Field';

// The one way a person signs in Veritas (docs/design-system/patterns.md,
// "Electronic signature"). It shows what is signed and what the signature
// means before asking for the reason and the signer's own password. The
// server re-verifies the password and records the signature in the same
// transaction as the state change (src/lib/signatures.ts); this dialog never
// decides anything itself. The password is cleared by the caller after each
// attempt.
export function SignatureDialog({
  title,
  record,
  version,
  meaning,
  consequence,
  reasonRequired,
  reasonPlaceholder,
  reason,
  onReasonChange,
  password,
  onPasswordChange,
  error,
  busy,
  submit,
  onSubmit,
  onCancel,
}: {
  title: string;
  // What is signed, e.g. "SOP-0001 Cleaning of the filling line".
  record: ReactNode;
  // The exact version signed, e.g. "Revision 3".
  version: ReactNode;
  // The signature meaning as recorded, e.g. "Released".
  meaning: string;
  // What happens when the signature is accepted.
  consequence: ReactNode;
  reasonRequired: boolean;
  reasonPlaceholder?: string;
  reason: string;
  onReasonChange: (value: string) => void;
  password: string;
  onPasswordChange: (value: string) => void;
  error?: string | null;
  busy?: boolean;
  submit: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  return (
    <Dialog title={title} error={error} busy={busy} submit={submit} onSubmit={onSubmit} onCancel={onCancel}>
      <dl className={styles.manifest}>
        <dt>Record</dt>
        <dd>{record}</dd>
        <dt>Version</dt>
        <dd className={styles.mono}>{version}</dd>
        <dt>Meaning</dt>
        <dd className={styles.meaning}>{meaning}</dd>
      </dl>
      <p className={styles.note}>
        {consequence} Your signature records your name, role, the time and the SHA-256 of the signed content.
      </p>
      <TextField
        label={reasonRequired ? 'Reason (required)' : 'Comment (optional)'}
        placeholder={reasonPlaceholder}
        required={reasonRequired}
        value={reason}
        onChange={(event) => onReasonChange(event.target.value)}
        autoFocus
      />
      <TextField
        label="Your password"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(event) => onPasswordChange(event.target.value)}
      />
    </Dialog>
  );
}
