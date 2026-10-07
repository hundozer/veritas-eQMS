'use client';

import Link from 'next/link';
import { useState } from 'react';
import styles from '../../page.module.css';
import { passwordSetupProblem, requestNewSetupLink, submitPasswordSetup } from '@/lib/password-setup-form';

function RequestLinkForm() {
  const [email, setEmail] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setAnswer(await requestNewSetupLink(email));
  };

  return (
    <form onSubmit={onSubmit} style={{ marginTop: '20px' }}>
      <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
        Need a new link? Enter the email address you were invited with.
      </p>
      {answer && <p role="status" style={{ color: '#10B981', fontSize: '13px' }}>{answer}</p>}
      <div className={styles.formGroup}>
        <label className={styles.formLabel} htmlFor="invite-email">Email address</label>
        <input id="invite-email" className={styles.input} type="email" autoComplete="email" required
          value={email} onChange={(event) => setEmail(event.target.value)} />
      </div>
      <button type="submit" className={`${styles.btn} ${styles.btnSecondary}`}>Send a new link</button>
    </form>
  );
}

export default function SetupPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!token) {
    return <RequestLinkForm />;
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
    <>
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
    {error && <RequestLinkForm />}
    </>
  );
}
