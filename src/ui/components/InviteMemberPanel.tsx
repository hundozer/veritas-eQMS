'use client';

import { useEffect, useState } from 'react';
import styles from '@/app/page.module.css';
import { inviteMember, type InviteForm } from '@/lib/invitations-client';

type Role = { id: string; name: string; description: string };

const EMPTY: InviteForm = { firstName: '', lastName: '', email: '', department: '', roleId: '' };

// Invite a person into this organisation (DEC-063). They receive a single-use
// link and set their own password; the inviter never sees or chooses it.
export default function InviteMemberPanel({ onInvited }: { onInvited: () => void }) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [form, setForm] = useState<InviteForm>(EMPTY);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/roles')
      .then((response) => (response.ok ? response.json() : { roles: [] }))
      .then((data) => setRoles(data.roles ?? []))
      .catch(() => setRoles([]));
  }, []);

  const field = (key: keyof InviteForm) => ({
    value: form[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [key]: event.target.value }),
  });

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    const result = await inviteMember(form);
    setBusy(false);
    if (result.ok) {
      setMessage({ kind: 'ok', text: `Invitation sent to ${form.email.trim().toLowerCase()}.` });
      setForm(EMPTY);
      onInvited();
    } else {
      setMessage({ kind: 'error', text: result.message });
      onInvited();
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}>Invite a colleague</div>
      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
        They receive an email with a single-use link, valid for 30 minutes, to set their own password.
      </p>
      {message && (
        <p role={message.kind === 'error' ? 'alert' : 'status'} style={{ color: message.kind === 'error' ? '#F87171' : '#10B981', fontSize: '13px' }}>
          {message.text}
        </p>
      )}
      <form onSubmit={onSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', alignItems: 'end' }}>
        <div className={styles.formGroup}><label className={styles.formLabel}>First name</label><input className={styles.input} required {...field('firstName')} /></div>
        <div className={styles.formGroup}><label className={styles.formLabel}>Last name</label><input className={styles.input} required {...field('lastName')} /></div>
        <div className={styles.formGroup}><label className={styles.formLabel}>Work email</label><input className={styles.input} type="email" required {...field('email')} /></div>
        <div className={styles.formGroup}><label className={styles.formLabel}>Department</label><input className={styles.input} required {...field('department')} /></div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Role</label>
          <select className={styles.select} required {...field('roleId')}>
            <option value="">Choose a role…</option>
            {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
          </select>
        </div>
        <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={busy}>{busy ? 'Sending…' : 'Send invitation'}</button>
      </form>
    </div>
  );
}
