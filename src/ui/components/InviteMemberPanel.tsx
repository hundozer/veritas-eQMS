'use client';

import { useEffect, useState } from 'react';
import styles from './InviteMemberPanel.module.css';
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
    <section aria-labelledby="invite-title" className={styles.panel}>
      <div className={styles.head}>
        <h3 id="invite-title" className={styles.kind}>Invite a colleague</h3>
        <span className={styles.note}>They receive an email with a single-use link, valid for 30 minutes, to set their own password.</span>
      </div>
      {message && (
        <p role={message.kind === 'error' ? 'alert' : 'status'} className={message.kind === 'error' ? styles.error : styles.ok}>
          {message.text}
        </p>
      )}
      <form onSubmit={onSubmit} className={styles.form}>
        <label className={styles.field}><span className={styles.label}>First name</span><input className={styles.input} required {...field('firstName')} /></label>
        <label className={styles.field}><span className={styles.label}>Last name</span><input className={styles.input} required {...field('lastName')} /></label>
        <label className={styles.field}><span className={styles.label}>Work email</span><input className={styles.input} type="email" required {...field('email')} /></label>
        <label className={styles.field}><span className={styles.label}>Department</span><input className={styles.input} required {...field('department')} /></label>
        <label className={styles.field}>
          <span className={styles.label}>Role</span>
          <select className={styles.input} required {...field('roleId')}>
            <option value="">Choose a role…</option>
            {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
          </select>
        </label>
        <button type="submit" className={styles.submit} disabled={busy}>{busy ? 'Sending…' : 'Send invitation'}</button>
      </form>
    </section>
  );
}
