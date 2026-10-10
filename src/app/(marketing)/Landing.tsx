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
          <span className={styles.luxuryBadge}>Infrastructure</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: '600', color: '#047857', fontFamily: 'monospace' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#047857' }} />
          CONTROLLED RECOVERY • VALIDATION IN PROGRESS
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className={styles.btnLuxurySecondary} onClick={() => setShowLoginModal(true)}>
            Member Sign In
          </button>
          <button className={styles.btnLuxuryPrimary} onClick={() => setShowDemoRequestModal(true)}>
            Request a Product Walkthrough →
          </button>
        </div>
      </header>

      {/* VIEWPORT 1: BRAND STATEMENT */}
      <section className={styles.luxuryViewport}>
        <h1 className={styles.luxuryHeadline}>
          Compliance intelligence for life sciences.
        </h1>
        <p className={styles.luxurySubhead}>
          Veritas operates as the underlying compliance infrastructure layer for emerging biotechnology and pharmaceutical enterprise.
        </p>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <button className={styles.btnLuxuryPrimary} onClick={() => setShowDemoRequestModal(true)}>
            Request a Product Walkthrough →
          </button>
          <button className={styles.btnLuxurySecondary} onClick={() => setShowLoginModal(true)}>
            Member Sign In
          </button>
        </div>
      </section>

      {/* VIEWPORT 2: COMPLIANCE NETWORK VISUALIZATION */}
      <section className={styles.luxuryViewport} style={{ borderTop: '1px solid rgba(10, 14, 23, 0.08)' }}>
        <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#047857', marginBottom: '20px', fontFamily: 'monospace' }}>
          01 / COMPLIANCE GRAPH ARCHITECTURE
        </div>
        <h2 className={styles.luxuryHeadline} style={{ fontSize: '56px' }}>
          Every regulation maps directly to operational evidence.
        </h2>
        <p className={styles.luxurySubhead} style={{ fontSize: '18px', maxWidth: '640px' }}>
          Explore how regulations, processes, documents, people, and evidence can be connected through controlled workflows.
        </p>

        <div className={styles.topologyFrame}>
          {/* Top Telemetry Bar */}
          <div className={styles.topologyBar}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#047857', fontWeight: '700' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#047857', display: 'inline-block' }} />
              LIVE TOPOLOGY SYNC
            </div>
            <div>SYSTEM: VERITAS GxP GRAPH v2.4</div>
            <div>ILLUSTRATIVE PRODUCT MODEL</div>
              <div style={{ fontWeight: '700', color: '#0A0E17' }}>DESIGNED TO SUPPORT VALIDATED WORKFLOWS</div>
          </div>

          {/* SVG Network Graph */}
          <div style={{ padding: '36px 24px 28px', background: '#FFFFFF', position: 'relative' }}>
            <svg width="100%" height="340" viewBox="0 0 960 340" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="gridPattern" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#0A0E17" strokeWidth="1" strokeOpacity="0.04" />
                </pattern>
                <filter id="emeraldGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Hairline Grid Background */}
              <rect width="960" height="340" fill="url(#gridPattern)" />

              {/* Primary Pipeline Paths */}
              <path
                id="spinePath"
                d="M 100 170 C 180 80, 220 80, 300 80 C 380 80, 400 170, 480 170 C 560 170, 580 260, 660 260 C 740 260, 780 170, 860 170"
                stroke="#0A0E17"
                strokeWidth="1.5"
                strokeDasharray="4 4"
                opacity="0.3"
              />

              {/* Directive & Audit Arcs */}
              <path
                id="regDocArc"
                d="M 100 170 C 240 20, 340 20, 480 170"
                stroke="#047857"
                strokeWidth="1.5"
                opacity="0.6"
              />
              <path
                id="docEvidArc"
                d="M 480 170 C 620 70, 720 70, 860 170"
                stroke="#047857"
                strokeWidth="1.5"
                opacity="0.6"
              />
              <path
                id="auditChainArc"
                d="M 100 170 C 480 330, 480 330, 860 170"
                stroke="#0A0E17"
                strokeWidth="1"
                strokeDasharray="2 4"
                opacity="0.25"
              />

              {/* Animated Particles along paths */}
              <circle r="4" fill="#047857" filter="url(#emeraldGlow)">
                <animateMotion dur="5s" repeatCount="indefinite">
                  <mpath href="#spinePath" />
                </animateMotion>
              </circle>

              <circle r="3.5" fill="#047857">
                <animateMotion dur="3.5s" repeatCount="indefinite">
                  <mpath href="#regDocArc" />
                </animateMotion>
              </circle>

              <circle r="3.5" fill="#047857">
                <animateMotion dur="4s" repeatCount="indefinite">
                  <mpath href="#docEvidArc" />
                </animateMotion>
              </circle>

              <circle r="2.5" fill="#0A0E17">
                <animateMotion dur="6s" repeatCount="indefinite">
                  <mpath href="#auditChainArc" />
                </animateMotion>
              </circle>

              {/* NODE 01: REGULATIONS */}
              <g transform="translate(100, 170)" className={styles.topologyNode}>
                <circle r="36" fill="none" stroke="#047857" strokeWidth="1" strokeDasharray="3 3" className={styles.nodePulseRing} />
                <rect x="-60" y="-22" width="120" height="44" fill="#0A0E17" />
                <text y="-3" textAnchor="middle" fill="#FBFBFA" fontSize="12" fontWeight="800" fontFamily="monospace" letterSpacing="0.05em">REGULATIONS</text>
                <text y="12" textAnchor="middle" fill="#94A3B8" fontSize="9" fontWeight="600" fontFamily="monospace">EU ANNEX 11 / PART 11</text>
                <rect x="-42" y="26" width="84" height="16" fill="#FBFBFA" stroke="#0A0E17" strokeWidth="1" />
                <text y="37" textAnchor="middle" fill="#0A0E17" fontSize="8" fontWeight="700" fontFamily="monospace">STATUTORY RULE</text>
              </g>

              {/* NODE 02: PROCESSES */}
              <g transform="translate(300, 80)" className={styles.topologyNode}>
                <rect x="-55" y="-22" width="110" height="44" fill="#FFFFFF" stroke="#0A0E17" strokeWidth="1.5" />
                <text y="-3" textAnchor="middle" fill="#0A0E17" fontSize="12" fontWeight="800" fontFamily="monospace" letterSpacing="0.05em">PROCESSES</text>
                <text y="12" textAnchor="middle" fill="#475569" fontSize="9" fontWeight="600" fontFamily="monospace">DOCUMENT WORKFLOWS</text>
                <rect x="-36" y="26" width="72" height="16" fill="#FBFBFA" stroke="#0A0E17" strokeWidth="1" />
                <text y="37" textAnchor="middle" fill="#047857" fontSize="8" fontWeight="700" fontFamily="monospace">REVIEWABLE</text>
              </g>

              {/* NODE 03: DOCUMENTS (CENTRAL APEX) */}
              <g transform="translate(480, 170)" className={styles.topologyNode}>
                <circle r="42" fill="none" stroke="#047857" strokeWidth="1.5" className={styles.nodePulseRing} />
                <rect x="-65" y="-24" width="130" height="48" fill="#047857" filter="url(#emeraldGlow)" />
                <text y="-4" textAnchor="middle" fill="#FFFFFF" fontSize="13" fontWeight="800" fontFamily="monospace" letterSpacing="0.05em">DOCUMENTS</text>
                <text y="13" textAnchor="middle" fill="#E2E8F0" fontSize="9" fontWeight="600" fontFamily="monospace">CONTROLLED SOPs</text>
                <rect x="-48" y="28" width="96" height="16" fill="#0A0E17" />
                <text y="39" textAnchor="middle" fill="#FBFBFA" fontSize="8" fontWeight="700" fontFamily="monospace">SHA-256 INTEGRITY</text>
              </g>

              {/* NODE 04: PEOPLE */}
              <g transform="translate(660, 260)" className={styles.topologyNode}>
                <rect x="-55" y="-22" width="110" height="44" fill="#FFFFFF" stroke="#0A0E17" strokeWidth="1.5" />
                <text y="-3" textAnchor="middle" fill="#0A0E17" fontSize="12" fontWeight="800" fontFamily="monospace" letterSpacing="0.05em">PEOPLE</text>
                <text y="12" textAnchor="middle" fill="#475569" fontSize="9" fontWeight="600" fontFamily="monospace">QUALIFICATIONS</text>
                <rect x="-36" y="26" width="72" height="16" fill="#FBFBFA" stroke="#0A0E17" strokeWidth="1" />
                <text y="37" textAnchor="middle" fill="#047857" fontSize="8" fontWeight="700" fontFamily="monospace">STATUS VISIBLE</text>
              </g>

              {/* NODE 05: EVIDENCE */}
              <g transform="translate(860, 170)" className={styles.topologyNode}>
                <circle r="36" fill="none" stroke="#0A0E17" strokeWidth="1" strokeDasharray="3 3" />
                <rect x="-60" y="-22" width="120" height="44" fill="#0A0E17" />
                <text y="-3" textAnchor="middle" fill="#FBFBFA" fontSize="12" fontWeight="800" fontFamily="monospace" letterSpacing="0.05em">EVIDENCE</text>
                <text y="12" textAnchor="middle" fill="#94A3B8" fontSize="9" fontWeight="600" fontFamily="monospace">AUDIT LEDGER</text>
                <rect x="-44" y="26" width="88" height="16" fill="#FBFBFA" stroke="#0A0E17" strokeWidth="1" />
                <text y="37" textAnchor="middle" fill="#0A0E17" fontSize="8" fontWeight="700" fontFamily="monospace">AUDIT TRAIL</text>
              </g>
            </svg>
          </div>

          {/* Bottom Status Summary Ledger */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderTop: '1px solid rgba(10, 14, 23, 0.08)', background: '#FBFBFA', padding: '18px 24px', fontSize: '11px', fontFamily: 'monospace' }}>
            <div style={{ borderRight: '1px solid rgba(10, 14, 23, 0.08)', paddingRight: '16px' }}>
              <span style={{ color: '#475569', display: 'block', marginBottom: '2px' }}>DESIGN REFERENCES</span>
              <strong style={{ color: '#0A0E17', fontSize: '12px' }}>EU GMP Annex 11 • FDA 21 CFR Part 11</strong>
            </div>
            <div style={{ borderRight: '1px solid rgba(10, 14, 23, 0.08)', paddingRight: '16px', paddingLeft: '16px' }}>
              <span style={{ color: '#475569', display: 'block', marginBottom: '2px' }}>PERFORMANCE</span>
              <strong style={{ color: '#047857', fontSize: '12px' }}>Environment-dependent; verify during validation</strong>
            </div>
            <div style={{ paddingLeft: '16px' }}>
              <span style={{ color: '#475569', display: 'block', marginBottom: '2px' }}>CONTENT INTEGRITY</span>
              <strong style={{ color: '#0A0E17', fontSize: '12px' }}>SHA-256 Content Hashing</strong>
            </div>
          </div>
        </div>
      </section>

      {/* VIEWPORT 3: PRODUCT MOMENT 01 — DOCUMENT APPROVAL */}
      <section className={styles.luxuryViewport} style={{ borderTop: '1px solid rgba(10, 14, 23, 0.08)' }}>
        <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#047857', marginBottom: '20px', fontFamily: 'monospace' }}>
          02 / PRECISION WORKFLOW
        </div>
        <h2 className={styles.luxuryHeadline} style={{ fontSize: '56px' }}>
          Controlled document workflows with SHA-256 content verification.
        </h2>

        <div className={styles.precisionFrame} style={{ padding: 0, overflow: 'hidden' }}>
          <div className={styles.gxpCardHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#047857', fontWeight: '700' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#047857' }} />
              ILLUSTRATIVE WORKFLOW
            </div>
            <div style={{ color: '#475569' }}>CLASSIFICATION: GxP RESTRICTED</div>
            <div style={{ fontWeight: '700', color: '#047857' }}>EXAMPLE STATUS — NOT PRODUCTION EVIDENCE</div>
          </div>

          <div style={{ padding: '36px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(10, 14, 23, 0.12)', paddingBottom: '20px', marginBottom: '24px' }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.1em', color: '#047857', textTransform: 'uppercase', fontFamily: 'monospace', marginBottom: '4px' }}>
                  SOP IDENTIFIER: SOP-QA-042
                </div>
                <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#0A0E17', margin: 0 }}>
                  Cell Therapy Batch Release Protocol v3.0
                </h3>
                <div style={{ fontSize: '12px', color: '#64748B', fontFamily: 'monospace', marginTop: '6px' }}>
                  Effective Date: 2026-07-26 • Review Cycle: Annual • Owner: QA Department
                </div>
              </div>
              <div style={{ fontSize: '11px', color: '#047857', fontFamily: 'monospace', background: '#FBFBFA', padding: '6px 12px', border: '1px solid rgba(10, 14, 23, 0.15)', fontWeight: '700' }}>
                SHA-256: e8f9a2b4...9d12
              </div>
            </div>

            <div style={{ background: '#FBFBFA', border: '1px solid rgba(10, 14, 23, 0.1)', borderLeft: '3px solid #0A0E17', padding: '20px', fontSize: '13px', color: '#1E293B', lineHeight: '1.6', marginBottom: '28px', fontFamily: 'monospace' }}>
              &ldquo;Example controlled content mapped to customer-selected EU Annex 16 and FDA 21 CFR Part 211 requirements.&rdquo;
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(10, 14, 23, 0.12)', paddingTop: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: '36px', height: '36px', background: '#0A0E17', color: '#FBFBFA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '12px', fontFamily: 'monospace' }}>
                  ER
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '800', color: '#0A0E17' }}>Dr. Eleanor Vance</div>
                  <div style={{ fontSize: '11px', color: '#64748B', fontFamily: 'monospace' }}>Head of Quality Assurance • Timestamp: 2026-07-25 14:32:08 UTC</div>
                </div>
              </div>
              <span style={{ fontSize: '11px', fontWeight: '700', color: '#047857', border: '1px solid #047857', padding: '6px 14px', fontFamily: 'monospace', letterSpacing: '0.05em' }}>
                SIGNATURE EVIDENCE DISPLAY
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* VIEWPORT 4: PRODUCT MOMENT 02 — PERSONNEL QUALIFICATION */}
      <section className={styles.luxuryViewport} style={{ borderTop: '1px solid rgba(10, 14, 23, 0.08)' }}>
        <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#047857', marginBottom: '20px', fontFamily: 'monospace' }}>
          03 / PERSONNEL QUALIFICATION
        </div>
        <h2 className={styles.luxuryHeadline} style={{ fontSize: '56px' }}>
          Automated qualification tracking.
        </h2>

        <div className={styles.precisionFrame} style={{ maxWidth: '960px', padding: 0, overflow: 'hidden' }}>
          <div className={styles.gxpCardHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0A0E17', fontWeight: '700' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#047857' }} />
              ROLE-BASED PERSONNEL MATRIX
            </div>
            <div style={{ color: '#047857', fontWeight: '700' }}>EXAMPLE QUALIFICATION VIEW</div>
          </div>

          <div style={{ padding: '28px 36px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr', gap: '16px', fontSize: '11px', borderBottom: '1px solid rgba(10, 14, 23, 0.15)', paddingBottom: '12px', color: '#475569', fontWeight: '700', fontFamily: 'monospace' }}>
              <div>PERSONNEL & ROLE</div>
              <div>QUALIFICATION SOP</div>
              <div>COMPLETION DATE</div>
              <div>STATUS</div>
            </div>
            {[
              { name: 'Dr. Marcus Vance', role: 'Analytical Lead', sop: 'SOP-QA-042 (v3.0)', date: '2026-07-25', status: 'QUALIFIED' },
              { name: 'Sarah Jenkins', role: 'QC Specialist', sop: 'SOP-LAB-012 (v2.1)', date: '2026-07-24', status: 'QUALIFIED' },
              { name: 'David Chen', role: 'Process Engineer', sop: 'SOP-ENG-088 (v1.0)', date: '2026-07-22', status: 'QUALIFIED' },
            ].map((row, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr', gap: '16px', padding: '16px 0', borderBottom: '1px solid rgba(10, 14, 23, 0.06)', fontSize: '13px', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: '800', color: '#0A0E17' }}>{row.name}</div>
                  <div style={{ fontSize: '11px', color: '#64748B', fontFamily: 'monospace' }}>{row.role}</div>
                </div>
                <div style={{ color: '#475569', fontFamily: 'monospace', fontSize: '12px' }}>{row.sop}</div>
                <div style={{ color: '#64748B', fontFamily: 'monospace', fontSize: '12px' }}>{row.date}</div>
                <div style={{ color: '#047857', fontWeight: '700', fontFamily: 'monospace', fontSize: '12px' }}>✓ {row.status}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* VIEWPORT 5: PRODUCT MOMENT 03 — CRYPTOGRAPHIC AUDIT TRAIL (DARK NAVY) */}
      <section className={styles.darkNavySection}>
        <div style={{ maxWidth: '1040px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#10B981', marginBottom: '24px', fontFamily: 'monospace' }}>
            04 / CONTROLLED AUDIT TRAIL
          </div>
          <h2 style={{ fontSize: '56px', fontWeight: '800', letterSpacing: '-0.04em', color: '#FFFFFF', marginBottom: '24px', lineHeight: '1.08' }}>
            Attributable audit events available for review.
          </h2>
          <p style={{ fontSize: '18px', color: '#94A3B8', maxWidth: '640px', margin: '0 auto 48px', lineHeight: '1.6' }}>
            The product is being designed to record key workflow events and provide human-readable evidence for customer review and validation.
          </p>

          <div className={styles.terminalWindow}>
            <div className={styles.terminalBar}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10B981', fontWeight: '700' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10B981' }} />
                VERITAS AUDIT TRAIL PREVIEW
              </div>
              <div>FILTER: ALL EVENTS</div>
              <div style={{ color: '#10B981', fontWeight: '700', cursor: 'pointer' }} onClick={() => setShowDemoRequestModal(true)}>
                [REQUEST A PRODUCT WALKTHROUGH]
              </div>
            </div>

            <div style={{ padding: '28px', textAlign: 'left', fontFamily: 'monospace', fontSize: '12px', color: '#94A3B8', lineHeight: '1.8' }}>
              <div style={{ color: '#10B981', marginBottom: '10px' }}>[ILLUSTRATIVE-EVENT] DOCUMENT_WORKFLOW_REVIEWED</div>
              <div>ACTOR: example authorized reviewer</div>
              <div>RESOURCE: example controlled document version</div>
              <div>WORKFLOW STATE: example only; not validation evidence</div>
              <div>DESIGN_REFERENCE: 21 CFR Part 11 / EU GMP Annex 11</div>
              <div style={{ color: '#64748B', marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '8px' }}>
                CRYPTOGRAPHIC_CHECKSUM: 3f8a91c2b5d4e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* VIEWPORT 6: VALUE PROPOSITIONS — WHY BIOTECH LEADERS CHOOSE VERITAS */}
      <section className={styles.luxuryViewport} style={{ borderTop: '1px solid rgba(10, 14, 23, 0.08)' }}>
        <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#047857', marginBottom: '20px', fontFamily: 'monospace' }}>
          05 / ARCHITECTURE FOR GROWTH
        </div>
        <h2 className={styles.luxuryHeadline} style={{ fontSize: '52px', marginBottom: '56px' }}>
          Designed for biotechnology enterprise.
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', width: '100%' }}>
          <div className={styles.valueCard}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#047857', fontFamily: 'monospace', marginBottom: '12px' }}>01 / DEPLOYMENT SPEED</div>
            <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#0A0E17', marginBottom: '12px' }}>Focused Implementation Planning</h3>
            <p style={{ fontSize: '14px', color: '#475569', lineHeight: '1.6', margin: 0 }}>
              Start with a defined document-and-training scope, controlled configuration, and a customer-owned validation plan.
            </p>
          </div>

          <div className={styles.valueCard}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#047857', fontFamily: 'monospace', marginBottom: '12px' }}>02 / REVIEWABLE EVIDENCE</div>
            <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#0A0E17', marginBottom: '12px' }}>Validation-Ready Foundation</h3>
            <p style={{ fontSize: '14px', color: '#475569', lineHeight: '1.6', margin: 0 }}>
              Prepare traceable workflow evidence for review within each customer&apos;s intended use, procedures, configuration, and validation responsibilities.
            </p>
          </div>

          <div className={styles.valueCard}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#047857', fontFamily: 'monospace', marginBottom: '12px' }}>03 / CONNECTED INTELLIGENCE</div>
            <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#0A0E17', marginBottom: '12px' }}>Relational GxP Topology</h3>
            <p style={{ fontSize: '14px', color: '#475569', lineHeight: '1.6', margin: 0 }}>
              Connect document revisions, role-based training requirements, retraining decisions, and attributable audit events.
            </p>
          </div>
        </div>
      </section>

      {/* VIEWPORT 7: REQUEST DEMONSTRATION */}
      <section className={styles.luxuryViewport} style={{ borderTop: '1px solid rgba(10, 14, 23, 0.08)', paddingBottom: '32px' }}>
        <div className={styles.precisionFrame} style={{ textAlign: 'center', padding: '64px 48px', background: '#FFFFFF', maxWidth: '880px' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#047857', marginBottom: '16px', fontFamily: 'monospace' }}>
            RESERVED WALKTHROUGH
          </div>
          <h2 className={styles.luxuryHeadline} style={{ fontSize: '56px', marginBottom: '20px' }}>
            Establish your quality foundation.
          </h2>
          <p className={styles.luxurySubhead} style={{ fontSize: '18px', maxWidth: '600px', margin: '0 auto 36px' }}>
            Schedule a 15-minute 1-on-1 walkthrough with a European GxP Quality Architect. See how Veritas prepares your biotech enterprise for regulatory inspection.
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
            <button
              className={styles.btnLuxuryPrimary}
              style={{ padding: '18px 44px', fontSize: '13px', letterSpacing: '0.05em' }}
              onClick={() => setShowDemoRequestModal(true)}
            >
              REQUEST DEMONSTRATION →
            </button>
            <button
              className={styles.btnLuxurySecondary}
              style={{ padding: '18px 32px', fontSize: '13px', letterSpacing: '0.05em' }}
              onClick={() => setShowLoginModal(true)}
            >
              MEMBER SIGN IN
            </button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ padding: '48px 64px 32px', borderTop: '1px solid rgba(10, 14, 23, 0.08)', background: '#FBFBFA', fontSize: '12px', color: '#64748B', fontFamily: 'monospace' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: '800', color: '#0A0E17', fontSize: '13px' }}>Simpleafied Veritas</div>
            <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>© {new Date().getFullYear()} Simpleafied Solutions. All rights reserved.</div>
          </div>
          <div style={{ display: 'flex', gap: '24px' }}>
            <span style={{ cursor: 'pointer' }} onClick={() => setShowLoginModal(true)}>Member Sign In</span>
            <span style={{ cursor: 'pointer' }} onClick={() => setShowDemoRequestModal(true)}>Request Demonstration</span>
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
              Online lead collection is unavailable during controlled recovery. You can contact the product team using your own email application.
            </p>
            <p style={{ fontSize: '12px', color: '#64748B', lineHeight: '1.6', marginBottom: '24px' }}>
              The link below opens your email application; no contact details are submitted through Veritas.
            </p>
            <a
              href="mailto:contact@simpleafied.app?subject=Veritas%20Product%20Walkthrough"
              className={styles.btnLuxuryPrimary}
              style={{ display: 'block', width: '100%', padding: '16px', fontSize: '13px', letterSpacing: '0.05em', textAlign: 'center', textDecoration: 'none' }}
            >
              EMAIL THE PRODUCT TEAM →
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
                  ENTERPRISE AUTHENTICATION
                </div>
                <h3 style={{ fontSize: '22px', fontWeight: '800', color: '#0A0E17', margin: 0, letterSpacing: '-0.02em' }}>
                  Sign In to Veritas Workspace
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
                Single sign-on is unavailable during controlled recovery. Existing members can sign in with their work email and password.
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
                    VERIFY CODE →
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
                  AUTHENTICATE WORKSPACE SESSION →
                </button>
              </form>}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
