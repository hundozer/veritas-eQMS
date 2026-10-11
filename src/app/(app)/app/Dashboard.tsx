import { useState } from 'react';
import styles from './dashboard.module.css';
import {
  lifecycleCounts,
  queueSummary,
  recentlyChanged,
  routingSlip,
  signatureQueue,
  type DashboardDocument,
  type DashboardTraining,
  type SignatureMeaning,
  type SlipBox,
} from '@/lib/dashboard-summary';

interface DashboardProps {
  user: { id: string; fullName?: string; membershipRole?: string; permissions?: string[] };
  // 'ready' only after documents and training have loaded, so the overview
  // never claims "nothing is waiting" before it knows, or when loading failed.
  status: 'loading' | 'ready' | 'failed';
  documents: Array<DashboardDocument & { owner: { fullName: string } }>;
  trainings: DashboardTraining[];
  // Newest audit entries, or null when the member may not read the trail.
  auditEntries: Array<{ id: string; timestamp: string; action: string; objectType: string; userEmail: string | null }> | null;
  canAuthor: boolean;
  onNewDraft: () => void;
  onOpenDocument: (documentId: string) => void;
  onOpenDocuments: () => void;
  onOpenTraining: () => void;
  onOpenAudit: () => void;
}

const SLIP_KIND: Record<SignatureMeaning, string> = {
  REVIEW: 'review',
  APPROVE: 'approval',
  RELEASE: 'release',
  READ: 'training',
};

const ACTION: Record<SignatureMeaning, string> = {
  REVIEW: 'Review and sign',
  APPROVE: 'Approve and sign',
  RELEASE: 'Release and sign',
  READ: 'Read and sign',
};

const STATE_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  IN_REVIEW: 'In review',
  APPROVED: 'Approved',
  EFFECTIVE: 'Effective',
  OBSOLETE: 'Obsolete',
  WITHDRAWN: 'Withdrawn',
};

const DAY = 24 * 60 * 60 * 1000;

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatShortDate(value: string): string {
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function waiting(since: string, now: number): { text: string; overdue: boolean } {
  const days = Math.floor((now - new Date(since).getTime()) / DAY);
  if (days < 1) return { text: 'With you since today', overdue: false };
  return { text: `With you since ${formatShortDate(since)}, ${days} day${days === 1 ? '' : 's'}`, overdue: days >= 3 };
}

function headline(count: number): string {
  if (count === 0) return 'Nothing is routed to you for signature.';
  if (count === 1) return 'One record is routed to you for signature.';
  return `${count} records are routed to you for signature.`;
}

function Stamp({ state }: { state: string }) {
  return <span className={`${styles.stamp} ${styles[`stamp${state}`] ?? ''}`}>{(STATE_LABEL[state] ?? state).toUpperCase()}</span>;
}

function SignatureBox({ box }: { box: SlipBox }) {
  return (
    <div className={`${styles.sigBox} ${box.state === 'yours' ? styles.sigYours : ''}`}>
      <span className={styles.sigRole}>{box.role}</span>
      <span className={styles.sigLine}>
        {box.state === 'yours' ? 'your signature' : box.state === 'open' ? '' : box.name ?? ''}
      </span>
      <span className={styles.sigState}>
        {box.state === 'signed' && (box.date ? formatShortDate(box.date) : 'signed')}
        {box.state === 'yours' && 'waiting for you'}
        {box.state === 'waiting' && 'not signed yet'}
        {box.state === 'open' && '—'}
      </span>
    </div>
  );
}

// The signed-in overview, built from the paper records a GMP team already
// knows: a routing slip for each record that waits on the member, a register
// of documents, and the member's training record.
export default function Dashboard({
  user, status, documents, trainings, auditEntries, canAuthor, onNewDraft,
  onOpenDocument, onOpenDocuments, onOpenTraining, onOpenAudit,
}: DashboardProps) {
  // Fixed when the overview opens, so ages and the date stay stable across re-renders.
  const [now] = useState(() => Date.now());
  const loaded = status === 'ready';
  const queue = signatureQueue(user.id, user.permissions, documents, trainings);
  const states = lifecycleCounts(documents);
  const recent = recentlyChanged(documents);
  const ownTraining = trainings.filter((t) => t.userId === user.id);
  const openTraining = ownTraining.filter((t) => t.status === 'ASSIGNED').length;
  const doneTraining = ownTraining.filter((t) => t.status === 'COMPLETED').length;
  const statusById = new Map(documents.map((d) => [d.id, d.status]));

  return (
    <div className={styles.overview} aria-busy={!loaded}>
      <table className={styles.formHeader}>
        <tbody>
          <tr>
            <td>
              <span className={styles.formLabel}>Workspace</span>
              <span className={styles.formValue}>Records routed to you</span>
            </td>
            <td>
              <span className={styles.formLabel}>Holder</span>
              <span className={styles.formValue}>{[user.fullName, user.membershipRole].filter(Boolean).join(', ') || '—'}</span>
            </td>
            <td>
              <span className={styles.formLabel}>As of</span>
              <span className={`${styles.formValue} ${styles.mono}`}>
                {new Date(now).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            </td>
          </tr>
        </tbody>
      </table>

      <header className={styles.intro}>
        <div className={styles.introText}>
          <h2 className={styles.headline}>
            {status === 'failed' ? 'Your records could not be loaded.' : loaded ? headline(queue.length) : 'Checking what is routed to you…'}
          </h2>
          {status === 'failed' && <p className={styles.lede}>Reload the page to try again. The overview shows nothing until it can read your records.</p>}
          {loaded && queue.length > 0 && <p className={styles.lede}>{queueSummary(queue)}</p>}
        </div>
        {canAuthor && (
          <button type="button" className={styles.outline} onClick={onNewDraft}>
            New draft
          </button>
        )}
      </header>

      <section aria-label="Routing slips">
        {status === 'loading' && (
          <div className={styles.slips} aria-hidden="true">
            <div className={styles.slipSkeleton} /><div className={styles.slipSkeleton} />
          </div>
        )}
        {loaded && queue.length === 0 && (
          <p className={styles.empty}>
            No review, approval, release or training is assigned to you. New assignments appear here as soon as they are made.
          </p>
        )}
        {loaded && queue.length > 0 && (
          <div className={styles.slips}>
            {queue.map((item) => {
              const age = waiting(item.since, now);
              const stampState = item.meaning === 'READ' ? 'EFFECTIVE' : statusById.get(item.documentId) ?? '';
              const open = () => (item.meaning === 'READ' ? onOpenTraining() : onOpenDocument(item.documentId));
              return (
                <article key={item.key} className={styles.slip}>
                  <div className={styles.slipHead}>
                    <span className={styles.slipKind}>Routing slip · {SLIP_KIND[item.meaning]}</span>
                    <span className={styles.slipNumber}>
                      {item.documentNumber ?? 'No number'} <span className={styles.slipRev}>v{item.versionNumber}</span>
                    </span>
                  </div>
                  <div className={styles.slipBody}>
                    {stampState && <Stamp state={stampState} />}
                    <h3 className={styles.slipTitle}>{item.title}</h3>
                    <span className={age.overdue ? styles.overdue : styles.age}>{age.text}</span>
                  </div>
                  <div className={styles.sigRow} style={{ gridTemplateColumns: `repeat(${item.meaning === 'READ' ? 2 : 4}, minmax(0, 1fr))` }}>
                    {routingSlip(item, documents, trainings).map((box) => <SignatureBox key={box.role} box={box} />)}
                  </div>
                  <button type="button" className={styles.slipAction} onClick={open}>
                    {ACTION[item.meaning]} <span aria-hidden="true">→</span>
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <div className={styles.columns}>
        <section aria-labelledby="register-title" className={styles.register}>
          <div className={styles.registerHead}>
            <h2 id="register-title" className={styles.sectionTitle}>Register</h2>
            {loaded && (
              <span className={styles.counts}>
                {states.map(({ state, count }) => (
                  <span key={state} className={state === 'EFFECTIVE' ? styles.countEffective : undefined}>
                    {STATE_LABEL[state]} {count}
                  </span>
                ))}
              </span>
            )}
          </div>
          {status === 'loading' ? (
            <div className={styles.rowSkeleton} aria-hidden="true"><span /><span /><span /></div>
          ) : status === 'failed' ? null : recent.length === 0 ? (
            <p className={styles.empty}>The register is empty. {canAuthor ? 'Start with a draft: upload the source file and give it a title.' : 'Documents appear here once an author creates the first draft.'}</p>
          ) : (
            <div className={styles.tableScroll}>
              <table className={styles.ledger}>
                <caption className={styles.caption}>Recently changed</caption>
                <thead>
                  <tr><th scope="col">No.</th><th scope="col">Rev</th><th scope="col">Title</th><th scope="col">Status</th><th scope="col">Owner</th><th scope="col">Changed</th></tr>
                </thead>
                <tbody>
                  {recent.map((doc) => (
                    <tr key={doc.id}>
                      <td>
                        <button type="button" className={styles.numberLink} onClick={() => onOpenDocument(doc.id)}>
                          {doc.documentNumber ?? 'No number'}
                        </button>
                      </td>
                      <td className={styles.mono}>{doc.currentVersionNumber}</td>
                      <td className={styles.ledgerTitle}>{doc.title}</td>
                      <td><Stamp state={doc.status} /></td>
                      <td className={styles.muted}>{doc.owner.fullName}</td>
                      <td className={styles.date}>{formatDate(doc.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <button type="button" className={styles.textLink} onClick={onOpenDocuments}>All documents</button>
        </section>

        <aside className={styles.record}>
          <section aria-labelledby="training-title">
            <h2 id="training-title" className={styles.recordKind}>Training record · read and understood</h2>
            <dl className={styles.figures}>
              <div><dt>open</dt><dd>{loaded ? openTraining : '–'}</dd></div>
              <div><dt>signed</dt><dd>{loaded ? doneTraining : '–'}</dd></div>
            </dl>
            <button type="button" className={styles.textLink} onClick={onOpenTraining}>Training</button>
          </section>

          {auditEntries && (
            <section aria-labelledby="audit-title" className={styles.trailBlock}>
              <h2 id="audit-title" className={styles.recordKind}>Last entries in the audit trail</h2>
              {auditEntries.length === 0 ? (
                <p className={styles.muted}>{loaded ? 'No audit entries yet.' : ''}</p>
              ) : (
                <ol className={styles.trail}>
                  {auditEntries.slice(0, 5).map((entry) => (
                    <li key={entry.id}>
                      <span className={styles.trailTime}>{formatDateTime(entry.timestamp)}</span>
                      <span className={styles.trailAction}>{entry.action}</span>
                      <span className={styles.trailText}>{entry.objectType} · {entry.userEmail ?? 'unknown user'}</span>
                    </li>
                  ))}
                </ol>
              )}
              <button type="button" className={styles.textLink} onClick={onOpenAudit}>Full audit trail</button>
            </section>
          )}

          <p className={styles.notYet}>Change control, deviations and CAPA are not part of Veritas yet.</p>
        </aside>
      </div>
    </div>
  );
}
