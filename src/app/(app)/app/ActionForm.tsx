import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import styles from './action-form.module.css';
// Relative import so the unit tests can render this form without a path alias.
import {
  checkReason,
  checkRouting,
  REASON_FORMS,
  SOURCE_FILE_TYPES,
  type ReasonFormKind,
  type RoutingMember,
} from '../../../lib/action-forms';

// Resolves null when the action went through, so the form closes, or with
// the reason it was refused, shown in the form.
type Submit<T> = (values: T) => Promise<string | null>;

function FormSheet({ title, subject, note, error, busy, submit, onCancel, onSubmit, children }: {
  title: string;
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
    <form className={styles.form} aria-labelledby={titleId} onSubmit={onSubmit} onKeyDown={onKeyDown} noValidate>
      <div className={styles.head}>
        <h4 id={titleId} className={styles.title}>{title}</h4>
        {subject && <span className={styles.subject}>{subject}</span>}
      </div>
      <p className={styles.note}>{note}</p>
      {children}
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.buttons}>
        <button type="submit" className={styles.primary} disabled={busy}>{busy ? 'Working…' : submit}</button>
        <button type="button" className={styles.outline} onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
    </form>
  );
}

// A reason (and for a new revision, its source file) typed into the page
// instead of a browser prompt.
export function ReasonForm({ kind, subject, onSubmit, onCancel }: {
  kind: ReasonFormKind;
  subject?: string;
  onSubmit: Submit<{ reason: string; file: File | null }>;
  onCancel: () => void;
}) {
  const spec = REASON_FORMS[kind];
  const [reason, setReason] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const reasonId = useId();
  const fileId = useId();
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => reasonRef.current?.focus(), []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const checked = checkReason(kind, reason, file);
    if (!checked.ok) return setError(checked.message);
    setError(null);
    setBusy(true);
    const refused = await onSubmit(checked.value);
    setBusy(false);
    if (refused) setError(refused);
    else onCancel();
  };

  return (
    <FormSheet title={spec.title} subject={subject} note={spec.note} error={error} busy={busy} submit={spec.submit} onCancel={onCancel} onSubmit={handleSubmit}>
      <label htmlFor={reasonId} className={styles.label}>{spec.label}</label>
      <textarea
        id={reasonId}
        ref={reasonRef}
        className={styles.field}
        rows={3}
        value={reason}
        required
        onChange={(event) => setReason(event.target.value)}
      />
      {spec.needsFile && (
        <>
          <label htmlFor={fileId} className={styles.label}>Source file</label>
          <input
            id={fileId}
            type="file"
            className={styles.file}
            accept={SOURCE_FILE_TYPES}
            required
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </>
      )}
    </FormSheet>
  );
}

// The reviewer and approver of a draft, chosen from the organisation's
// members instead of typed as email addresses.
export function RoutingForm({ candidates, subject, onSubmit, onCancel }: {
  candidates: readonly RoutingMember[];
  subject?: string;
  onSubmit: Submit<{ reviewerId: string; approverId: string }>;
  onCancel: () => void;
}) {
  const [reviewerId, setReviewerId] = useState('');
  const [approverId, setApproverId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const reviewerFieldId = useId();
  const approverFieldId = useId();
  const reviewerRef = useRef<HTMLSelectElement>(null);
  useEffect(() => reviewerRef.current?.focus(), []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const checked = checkRouting(reviewerId, approverId, candidates);
    if (!checked.ok) return setError(checked.message);
    setError(null);
    setBusy(true);
    const refused = await onSubmit(checked.value);
    setBusy(false);
    if (refused) setError(refused);
    else onCancel();
  };

  const options = (exclude: string) => candidates.map((member) => (
    <option key={member.id} value={member.id} disabled={member.id === exclude}>
      {member.fullName} ({member.email})
    </option>
  ));

  return (
    <FormSheet
      title="Submit for review"
      subject={subject}
      note="The reviewer signs first, then the approver. They must be different people, and the author cannot approve their own revision."
      error={error}
      busy={busy}
      submit="Submit for review"
      onCancel={onCancel}
      onSubmit={handleSubmit}
    >
      <div className={styles.pair}>
        <div>
          <label htmlFor={reviewerFieldId} className={styles.label}>Reviewer</label>
          <select id={reviewerFieldId} ref={reviewerRef} className={styles.field} value={reviewerId} required onChange={(event) => setReviewerId(event.target.value)}>
            <option value="">Choose a member</option>
            {options(approverId)}
          </select>
        </div>
        <div>
          <label htmlFor={approverFieldId} className={styles.label}>Approver</label>
          <select id={approverFieldId} className={styles.field} value={approverId} required onChange={(event) => setApproverId(event.target.value)}>
            <option value="">Choose a member</option>
            {options(reviewerId)}
          </select>
        </div>
      </div>
      {candidates.length < 2 && (
        <p className={styles.note}>Routing needs two active members besides invitations still pending. Invite a colleague on the People tab first.</p>
      )}
    </FormSheet>
  );
}
