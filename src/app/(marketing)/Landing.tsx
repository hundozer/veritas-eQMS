'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../page.module.css';
import { LoginErrorNotice } from '@/ui/components/LoginErrorNotice';
import { hasActiveSession } from '@/lib/session-client';
import { submitCode, submitPassword, type SignInChallenge } from '@/lib/sign-in-client';

// Public landing page and member sign-in. The workspace lives at /app and is
// only rendered for a valid session (src/app/(app)/layout.tsx).
export default function Landing() {
  const router = useRouter();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showDemoRequestModal, setShowDemoRequestModal] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Second sign-in step: the authenticator code (DEC-080).
  const [challenge, setChallenge] = useState<SignInChallenge | null>(null);
  const [code, setCode] = useState('');

  useEffect(() => {
    hasActiveSession().then((signedIn) => { if (signedIn) router.replace('/app'); });
  }, [router]);

  const enterWorkspace = () => {
    setLoginPassword('');
    setCode('');
    setChallenge(null);
    router.replace('/app');
    router.refresh();
  };

  const handleLogin = async (email: string, password: string) => {
    setErrorMessage(null);
    const step = await submitPassword(email, password);
    if (step.kind === 'code') {
      setLoginPassword('');
      setChallenge(step.challenge);
    } else if (step.kind === 'done') {
      enterWorkspace();
    } else {
      setErrorMessage(step.message);
    }
  };

  const handleCode = async () => {
    setErrorMessage(null);
    const step = await submitCode(code);
    if (step.kind === 'done') return enterWorkspace();
    if (step.kind === 'error') {
      setErrorMessage(step.message);
      setCode('');
      if (step.restart) setChallenge(null);
    }
  };

  return (
    <div className={styles.luxuryCanvas} style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* HEADER */}
      <header className={styles.luxuryHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span className={styles.luxuryWordmark}>Simpleafied Veritas</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className={styles.btnLuxurySecondary} onClick={() => setShowLoginModal(true)}>
            Member Sign In
          </button>
          <button className={styles.btnLuxuryPrimary} onClick={() => setShowDemoRequestModal(true)}>
            Ask for a walkthrough →
          </button>
        </div>
      </header>

      {/* WHAT IT IS */}
      <section className={styles.luxuryViewport}>
        <h1 className={styles.luxuryHeadline}>
          Document and training control for small EU GMP teams.
        </h1>
        <p className={styles.luxurySubhead}>
          Draft, review, approve and release your SOPs. Every step is a signature that records its meaning, every stored file is checked against its SHA-256 when it is read, and the people who must read a new version are assigned it the moment it takes effect.
        </p>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button className={styles.btnLuxuryPrimary} onClick={() => setShowDemoRequestModal(true)}>
            Ask for a walkthrough →
          </button>
          <button className={styles.btnLuxurySecondary} onClick={() => setShowLoginModal(true)}>
            Member Sign In
          </button>
        </div>
      </section>

      {/* 01 DOCUMENT LIFECYCLE */}
      <section className={styles.luxuryViewport} style={{ borderTop: '1px solid rgba(10, 14, 23, 0.08)' }}>
        <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#047857', marginBottom: '20px', fontFamily: 'monospace' }}>
          01 / Document lifecycle
        </div>
        <h2 className={styles.luxuryHeadline} style={{ fontSize: '48px' }}>
          A document moves one signed step at a time.
        </h2>
        <p className={styles.luxurySubhead} style={{ fontSize: '18px', maxWidth: '680px' }}>
          Draft, in review, approved, effective. The author cannot approve or release their own revision. Releasing a new revision supersedes the previous one in the same step, and any copy that is not the effective version is marked as uncontrolled.
        </p>

        <div className={styles.precisionFrame} style={{ padding: 0, overflow: 'hidden' }}>
          <div className={styles.gxpCardHeader}>
            <div style={{ fontWeight: '700', color: '#0A0E17' }}>Example record</div>
            <div style={{ color: '#475569' }}>Sample data, not a customer document</div>
          </div>
          <div style={{ padding: '32px 36px' }}>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#047857', fontFamily: 'monospace', marginBottom: '4px' }}>SOP-QC-014 · revision 04</div>
            <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#0A0E17', margin: '0 0 24px' }}>HPLC system suitability testing</h3>
            {[
              { meaning: 'REVIEWED', who: 'Tomasz Wójcik, QC Analyst', when: '8 Oct 2026, 14:20 UTC' },
              { meaning: 'APPROVED', who: 'Ines Albrecht, Head of Quality Control', when: '9 Oct 2026, 09:12 UTC' },
              { meaning: 'RELEASED', who: 'Katrin Vogel, Quality Manager', when: '10 Oct 2026, 10:02 UTC' },
            ].map((signature) => (
              <div key={signature.meaning} style={{ display: 'grid', gridTemplateColumns: 'minmax(110px, 1fr) 2fr minmax(160px, 1fr)', gap: '16px', padding: '14px 0', borderTop: '1px solid rgba(10, 14, 23, 0.08)', fontSize: '13px' }}>
                <div style={{ fontFamily: 'monospace', fontWeight: '700', color: '#0A0E17' }}>{signature.meaning}</div>
                <div style={{ color: '#0A0E17' }}>{signature.who}</div>
                <div style={{ fontFamily: 'monospace', color: '#64748B' }}>{signature.when}</div>
              </div>
            ))}
            <div style={{ borderTop: '1px solid rgba(10, 14, 23, 0.12)', paddingTop: '14px', fontSize: '12px', color: '#64748B', fontFamily: 'monospace', wordBreak: 'break-all' }}>
              Each signature: password re-entered, printed name and role at that moment, server time, and the SHA-256 of the signed file.
            </div>
          </div>
        </div>
      </section>

      {/* 02 TRAINING */}
      <section className={styles.luxuryViewport} style={{ borderTop: '1px solid rgba(10, 14, 23, 0.08)' }}>
        <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#047857', marginBottom: '20px', fontFamily: 'monospace' }}>
          02 / Training
        </div>
        <h2 className={styles.luxuryHeadline} style={{ fontSize: '48px' }}>
          Training follows the release, not a spreadsheet.
        </h2>
        <p className={styles.luxurySubhead} style={{ fontSize: '18px', maxWidth: '680px' }}>
          When a revision takes effect, everyone in its training departments is assigned that version, and open assignments on the old one are closed. Each person signs &ldquo;read and understood&rdquo; against the effective file, and the training matrix shows who is trained on what.
        </p>
      </section>

      {/* 03 AUDIT TRAIL */}
      <section className={styles.luxuryViewport} style={{ borderTop: '1px solid rgba(10, 14, 23, 0.08)' }}>
        <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#047857', marginBottom: '20px', fontFamily: 'monospace' }}>
          03 / Audit trail
        </div>
        <h2 className={styles.luxuryHeadline} style={{ fontSize: '48px' }}>
          An audit trail that can only grow.
        </h2>
        <p className={styles.luxurySubhead} style={{ fontSize: '18px', maxWidth: '680px' }}>
          Every regulated change writes its audit entry in the same database transaction, or not at all. The database rejects changes and deletions of audit entries for every account. Filter the trail, read what changed from before to after, and export it as a numbered PDF.
        </p>
      </section>

      {/* 04 WHAT IT DOES NOT DO YET */}
      <section className={styles.luxuryViewport} style={{ borderTop: '1px solid rgba(10, 14, 23, 0.08)' }}>
        <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#047857', marginBottom: '20px', fontFamily: 'monospace' }}>
          04 / Scope
        </div>
        <h2 className={styles.luxuryHeadline} style={{ fontSize: '48px' }}>
          What Veritas does not do yet.
        </h2>
        <p className={styles.luxurySubhead} style={{ fontSize: '18px', maxWidth: '680px' }}>
          Veritas controls documents and the training that follows them. Change control, deviations and CAPA, and single sign-on are on the roadmap; until then, keep your current tools for them. Validation stays your responsibility, for your intended use and procedures.
        </p>
      </section>

      {/* WALKTHROUGH */}
      <section className={styles.luxuryViewport} style={{ borderTop: '1px solid rgba(10, 14, 23, 0.08)', paddingBottom: '32px' }}>
        <div className={styles.precisionFrame} style={{ textAlign: 'center', padding: '64px 48px', background: '#FFFFFF', maxWidth: '880px' }}>
          <h2 className={styles.luxuryHeadline} style={{ fontSize: '48px', marginBottom: '20px' }}>
            See it on your own documents.
          </h2>
          <p className={styles.luxurySubhead} style={{ fontSize: '18px', maxWidth: '600px', margin: '0 auto 36px' }}>
            Write to the product team for a walkthrough. Bring one of your SOPs and see it go from draft to trained.
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              className={styles.btnLuxuryPrimary}
              style={{ padding: '18px 44px', fontSize: '13px', letterSpacing: '0.05em' }}
              onClick={() => setShowDemoRequestModal(true)}
            >
              Ask for a walkthrough →
            </button>
            <button
              className={styles.btnLuxurySecondary}
              style={{ padding: '18px 32px', fontSize: '13px', letterSpacing: '0.05em' }}
              onClick={() => setShowLoginModal(true)}
            >
              Member Sign In
            </button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ padding: '48px 64px 32px', borderTop: '1px solid rgba(10, 14, 23, 0.08)', background: '#FBFBFA', fontSize: '12px', color: '#64748B', fontFamily: 'monospace' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ fontWeight: '800', color: '#0A0E17', fontSize: '13px' }}>Simpleafied Veritas</div>
            <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>© {new Date().getFullYear()} Simpleafied Solutions. All rights reserved.</div>
          </div>
          <div style={{ display: 'flex', gap: '24px' }}>
            <button type="button" style={{ background: 'none', border: 0, padding: 0, font: 'inherit', color: 'inherit', cursor: 'pointer' }} onClick={() => setShowLoginModal(true)}>Member Sign In</button>
            <button type="button" style={{ background: 'none', border: 0, padding: 0, font: 'inherit', color: 'inherit', cursor: 'pointer' }} onClick={() => setShowDemoRequestModal(true)}>Ask for a walkthrough</button>
          </div>
        </div>
      </footer>

      {/* WALKTHROUGH CONTACT MODAL */}
      {showDemoRequestModal && (
        <div className={styles.modalOverlay} style={{ background: 'rgba(10, 14, 23, 0.75)', backdropFilter: 'blur(12px)' }}>
          <div className={styles.modalContent} style={{ maxWidth: '540px', background: '#FFFFFF', border: '1px solid rgba(10, 14, 23, 0.2)', borderRadius: '0px', padding: '40px', boxShadow: '0 30px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(10, 14, 23, 0.12)', paddingBottom: '20px', marginBottom: '24px' }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.12em', color: '#047857', textTransform: 'uppercase', fontFamily: 'monospace', marginBottom: '4px' }}>
                  PRODUCT WALKTHROUGH
                </div>
                <h3 style={{ fontSize: '22px', fontWeight: '800', color: '#0A0E17', margin: 0, letterSpacing: '-0.02em' }}>
                  Contact Simpleafied Veritas
                </h3>
              </div>
              <button
                aria-label="Close walkthrough contact"
                style={{ background: 'transparent', border: '1px solid rgba(10, 14, 23, 0.2)', color: '#0A0E17', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: '700', cursor: 'pointer', borderRadius: '0px' }}
                onClick={() => setShowDemoRequestModal(false)}
              >
                ×
              </button>
            </div>
            <p style={{ fontSize: '14px', color: '#475569', lineHeight: '1.6', marginBottom: '16px' }}>
              Write to the product team from your own email application, and we will arrange a time.
            </p>
            <p style={{ fontSize: '12px', color: '#64748B', lineHeight: '1.6', marginBottom: '24px' }}>
              The link below opens your email application; no contact details are submitted through Veritas.
            </p>
            <a
              href="mailto:contact@simpleafied.app?subject=Veritas%20Product%20Walkthrough"
              className={styles.btnLuxuryPrimary}
              style={{ display: 'block', width: '100%', padding: '16px', fontSize: '13px', letterSpacing: '0.05em', textAlign: 'center', textDecoration: 'none' }}
            >
              Email the product team →
            </a>
          </div>
        </div>
      )}

      {/* Registration & Login Modals */}
      {showLoginModal && (
        <div className={styles.modalOverlay} style={{ background: 'rgba(10, 14, 23, 0.75)', backdropFilter: 'blur(12px)' }}>
          <div className={styles.modalContent} style={{ maxWidth: '540px', background: '#FFFFFF', border: '1px solid rgba(10, 14, 23, 0.2)', borderRadius: '0px', padding: '40px', boxShadow: '0 30px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(10, 14, 23, 0.12)', paddingBottom: '20px', marginBottom: '24px' }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.12em', color: '#047857', textTransform: 'uppercase', fontFamily: 'monospace', marginBottom: '4px' }}>
                  Members
                </div>
                <h3 style={{ fontSize: '22px', fontWeight: '800', color: '#0A0E17', margin: 0, letterSpacing: '-0.02em' }}>
                  Sign in to Veritas
                </h3>
              </div>
              <button
                style={{ background: 'transparent', border: '1px solid rgba(10, 14, 23, 0.2)', color: '#0A0E17', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: '700', cursor: 'pointer', borderRadius: '0px' }}
                onClick={() => setShowLoginModal(false)}
              >
                ×
              </button>
            </div>

            <div>
              <p style={{ margin: '0 0 24px', color: '#64748B', fontSize: '13px', lineHeight: '1.6' }}>
                Sign in with your work email and password. Single sign-on is not available yet.
              </p>

              <LoginErrorNotice message={errorMessage} />

              {challenge && (
                <form onSubmit={async (e) => { e.preventDefault(); if (code) await handleCode(); }}>
                  {challenge.mfa === 'ENROLL' ? (
                    <div style={{ marginBottom: '18px', fontSize: '13px', color: '#334155', lineHeight: '1.6' }}>
                      <p style={{ margin: '0 0 12px' }}>
                        Set up two-step verification: scan this code with an authenticator app, or on this device{' '}
                        <a href={challenge.otpauthUri}>add it to your passwords</a>, then enter the 6-digit code it shows.
                      </p>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        alt="QR code for your authenticator app"
                        src={`data:image/svg+xml;utf8,${encodeURIComponent(challenge.qrSvg)}`}
                        style={{ width: '180px', height: '180px', display: 'block', margin: '0 auto 12px' }}
                      />
                      <p style={{ margin: 0, fontFamily: 'monospace', wordBreak: 'break-all' }}>Setup key: {challenge.setupKey}</p>
                    </div>
                  ) : (
                    <p style={{ margin: '0 0 18px', fontSize: '13px', color: '#334155' }}>Enter the 6-digit code from your authenticator app.</p>
                  )}
                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#0A0E17', fontFamily: 'monospace', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '6px' }}>
                      Authenticator Code
                    </label>
                    <input
                      style={{ width: '100%', padding: '12px 14px', border: '1px solid rgba(10, 14, 23, 0.2)', borderRadius: '0px', background: '#FBFBFA', fontSize: '18px', letterSpacing: '0.3em', color: '#0A0E17' }}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={7}
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      required
                    />
                  </div>
                  <button type="submit" className={styles.btnLuxuryPrimary} style={{ width: '100%', padding: '16px', fontSize: '13px', letterSpacing: '0.05em' }}>
                    Verify code →
                  </button>
                </form>
              )}

              {/* Standard Email Authentication Form */}
              {!challenge && <form onSubmit={async (e) => { e.preventDefault(); if (loginEmail && loginPassword) { await handleLogin(loginEmail, loginPassword); } }}>
                <div style={{ marginBottom: '18px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#0A0E17', fontFamily: 'monospace', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Work Email Address
                  </label>
                  <input
                    style={{ width: '100%', padding: '12px 14px', border: '1px solid rgba(10, 14, 23, 0.2)', borderRadius: '0px', background: '#FBFBFA', fontSize: '14px', color: '#0A0E17' }}
                    type="email"
                    placeholder="user@company.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                  />
                </div>

                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#0A0E17', fontFamily: 'monospace', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Password
                  </label>
                  <input
                    style={{ width: '100%', padding: '12px 14px', border: '1px solid rgba(10, 14, 23, 0.2)', borderRadius: '0px', background: '#FBFBFA', fontSize: '14px', color: '#0A0E17' }}
                    type="password"
                    placeholder="••••••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                  />
                </div>

                <button
                  type="submit"
                  className={styles.btnLuxuryPrimary}
                  style={{ width: '100%', padding: '16px', fontSize: '13px', letterSpacing: '0.05em' }}
                >
                  Sign in →
                </button>
              </form>}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
