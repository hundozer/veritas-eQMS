import { useState } from 'react';
import styles from './dashboard.module.css';
import {
  lifecycleCounts,
  recentlyChanged,
  signatureQueue,
  type DashboardDocument,
  type DashboardTraining,
  type SignatureMeaning,
} from '@/lib/dashboard-summary';

interface DashboardProps {
  user: { id: string; permissions?: string[] };
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

const MEANING_LABEL: Record<SignatureMeaning, string> = {
  REVIEW: 'REVIEW',
  APPROVE: 'APPROVE',
  RELEASE: 'RELEASE',
  READ: 'READ & UNDERSTOOD',
};

const STATE_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  IN_REVIEW: 'In review',
  APPROVED: 'Approved',
  EFFECTIVE: 'Effective',
  OBSOLETE: 'Obsolete',
};

const DAY = 24 * 60 * 60 * 1000;

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function waiting(since: string, now: number): { text: string; overdue: boolean } {
  const days = Math.floor((now - new Date(since).getTime()) / DAY);
  if (days < 1) return { text: 'since today', overdue: false };
  return { text: `waiting ${days} day${days === 1 ? '' : 's'}`, overdue: days >= 3 };
}

function headline(count: number): string {
  if (count === 0) return 'Nothing is waiting on your signature.';
  if (count === 1) return 'One record is waiting on your signature.';
  return `${count} records are waiting on your signature.`;
}

// The signed-in overview: what needs the member's signature first, then the
// register by lifecycle state, recent changes and the audit trail.
export default function Dashboard({
  user, documents, trainings, auditEntries, canAuthor, onNewDraft,
  onOpenDocument, onOpenDocuments, onOpenTraining, onOpenAudit,
}: DashboardProps) {
  // Fixed when the overview opens, so ages and the date stay stable across re-renders.
  const [now] = useState(() => Date.now());
  const queue = signatureQueue(user.id, user.permissions, documents, trainings);
  const states = lifecycleCounts(documents);
  const recent = recentlyChanged(documents);
  const ownTraining = trainings.filter((t) => t.userId === user.id);
  const openTraining = ownTraining.filter((t) => t.status === 'ASSIGNED').length;
  const doneTraining = ownTraining.filter((t) => t.status === 'COMPLETED').length;

  return (
    <div className={styles.overview}>
      <header className={styles.intro}>
        <div>
          <div className={styles.eyebrow}>
            {new Date(now).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
          <h2 className={styles.headline}>{headline(queue.length)}</h2>
        </div>
        {canAuthor && (
          <button type="button" className={`${styles.button} ${styles.buttonSolid}`} onClick={onNewDraft}>
            New draft
          </button>
        )}
      </header>

      <section aria-labelledby="queue-title">
        <div className={styles.sectionHead}>
          <h3 id="queue-title" className={styles.sectionTitle}>Awaiting your signature</h3>
          {queue.length > 1 && <span className={styles.eyebrow}>oldest first</span>}
        </div>
        <div className={styles.panel}>
          {queue.length === 0 && (
            <p className={styles.empty}>No reviews, approvals, releases or training are assigned to you right now.</p>
          )}
          {queue.map((item) => {
            const age = waiting(item.since, now);
            return (
              <div key={item.key} className={styles.queueRow}>
                <span className={`${styles.meaning} ${styles[`meaning${item.meaning}`]}`}>{MEANING_LABEL[item.meaning]}</span>
                <div className={styles.queueTitle}>
                  <span>
                    <span className={styles.docNumber}>{item.documentNumber ?? 'No number'}</span>
                    <span className={styles.eyebrow}> · version {item.versionNumber}</span>
                  </span>
                  <span className={styles.docTitle}>{item.title}</span>
                </div>
                <span className={`${styles.queueAge} ${styles.mono} ${age.overdue ? styles.overdue : ''}`}>{age.text}</span>
                <button
                  type="button"
                  className={styles.button}
                  onClick={() => (item.meaning === 'READ' ? onOpenTraining() : onOpenDocument(item.documentId))}
                >
                  Open and sign
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="states-title">
        <div className={styles.sectionHead}>
          <h3 id="states-title" className={styles.sectionTitle}>Documents by lifecycle state</h3>
        </div>
        <div className={`${styles.panel} ${styles.states}`}>
          {states.map(({ state, count }) => (
            <button
              key={state}
              type="button"
              className={`${styles.stateCell} ${state === 'EFFECTIVE' ? styles.stateEffective : ''}`}
              onClick={onOpenDocuments}
            >
              <span className={styles.stateLabel}>{STATE_LABEL[state]}</span>
              <span className={styles.stateCount}>{count}</span>
            </button>
          ))}
        </div>
      </section>

      <div className={styles.columns}>
        <section aria-labelledby="recent-title" className={styles.wide}>
          <div className={styles.sectionHead}>
            <h3 id="recent-title" className={styles.sectionTitle}>Recently changed</h3>
            <button type="button" className={styles.linkButton} onClick={onOpenDocuments}>All documents</button>
          </div>
          <div className={`${styles.panel} ${styles.tableScroll}`}>
            {recent.length === 0 ? (
              <p className={styles.empty}>No documents yet.</p>
            ) : (
              <table className={styles.register}>
                <thead>
                  <tr><th>Number</th><th>Title</th><th>Version</th><th>State</th><th>Owner</th><th>Changed</th></tr>
                </thead>
                <tbody>
                  {recent.map((doc) => (
                    <tr key={doc.id}>
                      <td>
                        <button type="button" className={`${styles.linkButton} ${styles.mono}`} onClick={() => onOpenDocument(doc.id)}>
                          {doc.documentNumber ?? 'No number'}
                        </button>
                      </td>
                      <td>{doc.title}</td>
                      <td className={styles.mono}>{doc.currentVersionNumber}</td>
                      <td>
                        <span className={`${styles.chip} ${styles[`chip${doc.status}`] ?? ''}`}>{doc.status.replaceAll('_', ' ')}</span>
                      </td>
                      <td>{doc.owner.fullName}</td>
                      <td className={styles.mono}>{formatDate(doc.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <div className={styles.narrow}>
          <section aria-labelledby="training-title" className={styles.trainingCard}>
            <h3 id="training-title" className={styles.stateLabel}>Your training</h3>
            <span className={styles.trainingCount}>{openTraining} open</span>
            <span>{doneTraining} signed as read and understood</span>
            <button type="button" className={styles.linkButton} onClick={onOpenTraining}>Open training</button>
          </section>

          {auditEntries && (
            <section aria-labelledby="audit-title">
              <div className={styles.sectionHead}>
                <h3 id="audit-title" className={styles.sectionTitle}>Audit trail</h3>
                <button type="button" className={styles.linkButton} onClick={onOpenAudit}>Review and export</button>
              </div>
              {auditEntries.length === 0 ? (
                <p className={styles.empty}>No audit entries yet.</p>
              ) : (
                <ol className={styles.trail}>
                  {auditEntries.slice(0, 6).map((entry) => (
                    <li key={entry.id}>
                      <span className={styles.eyebrow}>{formatDateTime(entry.timestamp)}</span>
                      <span className={styles.trailAction}>{entry.action}</span>
                      <span className={styles.trailText}>{entry.objectType} · {entry.userEmail ?? 'unknown user'}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
