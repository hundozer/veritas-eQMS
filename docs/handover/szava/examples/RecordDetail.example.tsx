// EXAMPLE (type-checked, not shipped): a record detail with header,
// lifecycle, signature boxes, permission-aware actions and the signing
// dialog. Pattern: src/app/(app)/app/Documents.tsx.
'use client';
import { useState, type FormEvent } from 'react';
import { Button, ButtonRow, LifecyclePath, Note, RecordHeader, RecordSheet, SectionTitle, SignatureBoxes, SignatureDialog } from '@/ui/paper';
import { changeActionsFor } from './change-actions.example';

interface Change { id: string; number: string; title: string; status: string; riskLevel: string; ownerId: string; ownerName: string }

const STEPS = ['DRAFT', 'UNDER_REVIEW', 'APPROVED', 'CLOSED'];
const STEP_LABEL = ['Draft', 'Under review', 'Approved', 'Closed'];

export default function ChangeRecord({ change, userId, permissions, onChanged }: {
  change: Change;
  userId: string;
  permissions: readonly string[];
  onChanged: () => void;
}) {
  const actions = changeActionsFor(change, userId, permissions);
  const [signing, setSigning] = useState(false);
  const [reason, setReason] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sign = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    // Illustrative endpoint: signing a change control needs the generalised
    // signature contract (handover chapter 9) before it exists.
    const res = await fetch(`/api/change-requests/${change.id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment: reason.trim(), password }),
    });
    setPassword('');
    setBusy(false);
    if (!res.ok) return setError((await res.json()).error?.message ?? 'Signing failed');
    setSigning(false);
    onChanged();
  };

  return (
    <RecordSheet labelledBy="change-title">
      <RecordHeader
        titleId="change-title"
        title={change.title}
        state={change.status}
        identity={[{ label: 'No.', value: change.number, mono: true }, { label: 'Risk', value: change.riskLevel }, { label: 'Owner', value: change.ownerName }]}
      />
      <section aria-label="Lifecycle">
        <LifecyclePath steps={STEP_LABEL} current={STEPS.indexOf(change.status)} attached />
        <SignatureBoxes boxes={[{ role: 'Owner', name: change.ownerName, state: 'raised' }, { role: 'QA approval', name: '', state: 'not signed yet' }]} />
      </section>
      <section aria-labelledby="change-actions">
        <SectionTitle id="change-actions">What you can do</SectionTitle>
        {actions.length === 0 ? <Note>No action on this change control is open to you.</Note> : (
          <ButtonRow>
            {actions.includes('SIGN_APPROVAL') && <Button variant="primary" onClick={() => setSigning(true)}>Sign approval</Button>}
          </ButtonRow>
        )}
      </section>
      {signing && (
        <SignatureDialog
          title="Sign approval"
          record={`${change.number} ${change.title}`}
          version="Current record"
          meaning="Change approved"
          consequence="Approval allows implementation to start; it does not close the change."
          reasonRequired={false}
          reason={reason}
          onReasonChange={setReason}
          password={password}
          onPasswordChange={setPassword}
          error={error}
          busy={busy}
          submit="Sign as approved"
          onSubmit={sign}
          onCancel={() => { setSigning(false); setError(null); setPassword(''); }}
        />
      )}
    </RecordSheet>
  );
}
