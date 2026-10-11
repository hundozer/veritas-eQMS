import { useEffect, useRef, useState, type FormEvent } from 'react';
// Relative imports so the unit tests can render this form without a path alias.
import { FieldPair, FileField, FormSheet, Note, SelectField, TextAreaField } from '../../../ui/paper';
import {
  checkReason,
  checkRoleChange,
  checkRouting,
  REASON_FORMS,
  type AssignableRole,
  type ReasonFormKind,
  type RoutingMember,
} from '../../../lib/action-forms';
import { DOCUMENT_FILE_ACCEPT } from '../../../lib/document-file-types';

// Resolves null when the action went through, so the form closes, or with
// the reason it was refused, shown in the form.
type Submit<T> = (values: T) => Promise<string | null>;

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
      <TextAreaField
        label={spec.label}
        textareaRef={reasonRef}
        value={reason}
        required
        onChange={(event) => setReason(event.target.value)}
      />
      {spec.needsFile && (
        <FileField
          label="Source file"
          accept={DOCUMENT_FILE_ACCEPT}
          required
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
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
      <FieldPair>
        <SelectField label="Reviewer" selectRef={reviewerRef} value={reviewerId} required onChange={(event) => setReviewerId(event.target.value)}>
          <option value="">Choose a member</option>
          {options(approverId)}
        </SelectField>
        <SelectField label="Approver" value={approverId} required onChange={(event) => setApproverId(event.target.value)}>
          <option value="">Choose a member</option>
          {options(reviewerId)}
        </SelectField>
      </FieldPair>
      {candidates.length < 2 && (
        <Note>Routing needs two active members besides invitations still pending. Invite a colleague on the People tab first.</Note>
      )}
    </FormSheet>
  );
}

// A member's new organisation role and the reason for the change.
export function RoleForm({ roles, currentRoleName, subject, onSubmit, onCancel }: {
  roles: readonly AssignableRole[];
  currentRoleName?: string | null;
  subject?: string;
  onSubmit: Submit<{ roleId: string; reason: string }>;
  onCancel: () => void;
}) {
  const [roleId, setRoleId] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const roleFieldId = useId();
  const reasonId = useId();
  const roleRef = useRef<HTMLSelectElement>(null);
  useEffect(() => roleRef.current?.focus(), []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const checked = checkRoleChange(roleId, reason, currentRoleName, roles);
    if (!checked.ok) return setError(checked.message);
    setError(null);
    setBusy(true);
    const refused = await onSubmit(checked.value);
    setBusy(false);
    if (refused) setError(refused);
    else onCancel();
  };

  return (
    <FormSheet
      title="Change role"
      subject={subject}
      note="The member's permissions change at their next action; they stay signed in. The reason is kept in the audit trail."
      error={error}
      busy={busy}
      submit="Change role"
      onCancel={onCancel}
      onSubmit={handleSubmit}
    >
      <label htmlFor={roleFieldId} className={styles.label}>New role</label>
      <select id={roleFieldId} ref={roleRef} className={styles.field} value={roleId} required onChange={(event) => setRoleId(event.target.value)}>
        <option value="">Choose a role</option>
        {roles.map((role) => (
          <option key={role.id} value={role.id} disabled={role.name === currentRoleName}>{role.name}</option>
        ))}
      </select>
      <label htmlFor={reasonId} className={styles.label}>Reason for the change</label>
      <textarea id={reasonId} className={styles.field} rows={3} value={reason} required onChange={(event) => setReason(event.target.value)} />
    </FormSheet>
  );
}
