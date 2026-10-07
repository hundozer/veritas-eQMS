'use client';

import Link from 'next/link';
import { useState } from 'react';
import styles from '../../page.module.css';
import { passwordSetupProblem, submitPasswordSetup } from '@/lib/password-setup-form';

export default function SetupPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!token) {
    return <p role="alert">This link is incomplete. Open the link from your invitation email again.</p>;
  }
  if (done) {
    return (
      <p>
        Your password is set. <Link href="/">Sign in to Veritas</Link> with your email address and this password.
      </p>
    );
  }

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const problem = passwordSetupProblem(password, confirmation);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    const result = await submitPasswordSetup(token, password);
    setBusy(false);
    setPassword('');
    setConfirmation('');
    if (result.ok) setDone(true);
    else setError(result.message);
  };

  return (
    <form onSubmit={onSubmit}>
      {error && <p role="alert" style={{ color: '#F87171' }}>{error}</p>}
      <div className={styles.formGroup}>
        <label className={styles.formLabel} htmlFor="new-password">New password (at least 12 characters)</label>
        <input id="new-password" className={styles.input} type="password" autoComplete="new-password" required
          value={password} onChange={(event) => setPassword(event.target.value)} />
      </div>
      <div className={styles.formGroup}>
        <label className={styles.formLabel} htmlFor="confirm-password">Repeat the password</label>
        <input id="confirm-password" className={styles.input} type="password" autoComplete="new-password" required
          value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
      </div>
      <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={busy}>
        {busy ? 'Setting password…' : 'Set password'}
      </button>
    </form>
  );
}
