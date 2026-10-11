// EXAMPLE (type-checked, not shipped): creating a record in a Dialog with
// shared fields. Validate on submit, show the refusal in the dialog, keep it
// open on failure, close and refresh on success.
'use client';
import { useState, type FormEvent } from 'react';
import { Dialog, SelectField, TextAreaField, TextField } from '@/ui/paper';

export default function NewChangeDialog({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [title, setTitle] = useState('');
  const [reason, setReason] = useState('');
  const [riskLevel, setRiskLevel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !reason.trim() || !riskLevel) return setError('Title, reason and risk level are required.');
    setBusy(true);
    const res = await fetch('/api/change-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, reason, riskLevel }),
    });
    setBusy(false);
    if (!res.ok) return setError((await res.json()).error?.message ?? 'The change control was not created.');
    onCreated();
  };

  return (
    <Dialog title="New change control" error={error} busy={busy} submit="Create change control" onSubmit={submit} onCancel={onCancel}>
      <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
      <TextAreaField label="Reason for the change" value={reason} onChange={(e) => setReason(e.target.value)} required />
      <SelectField label="Risk level" value={riskLevel} onChange={(e) => setRiskLevel(e.target.value)} required>
        <option value="">Choose a level</option>
        <option value="LOW">Low</option>
        <option value="MEDIUM">Medium</option>
        <option value="HIGH">High</option>
      </SelectField>
    </Dialog>
  );
}
