import { useState, type ReactNode } from 'react';
import styles from './dashboard.module.css';
import {
  lifecycleCounts,
  queueSummary,
  recentlyChanged,
  signatureQueue,
  type DashboardDocument,
  type DashboardTraining,
  type SignatureMeaning,
} from '@/lib/dashboard-summary';

interface DashboardProps {
  user: { id: string; permissions?: string[] };
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

const MEANING_LABEL: Record<SignatureMeaning, string> = {
  REVIEW: 'Review',
  APPROVE: 'Approve',
  RELEASE: 'Release',
  READ: 'Read and understood',
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

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function waiting(since: string, now: number): { text: string; overdue: boolean } {
  const days = Math.floor((now - new Date(since).getTime()) / DAY);
  if (days < 1) return { text: 'today', overdue: false };
  return { text: `${days} day${days === 1 ? '' : 's'}`, overdue: days >= 3 };
}

function headline(count: number): string {
  if (count === 0) return 'Nothing is waiting on your signature.';
  if (count === 1) return 'One record is waiting on your signature.';
  return `${count} records are waiting on your signature.`;
}

function Swatch({ state }: { state: string }) {
  return <span aria-hidden="true" className={`${styles.swatch} ${styles[`fill${state}`] ?? ''}`} />;
}

function SectionHead({ n, id, title, action }: { n: number; id: string; title: string; action?: ReactNode }) {
  return (
    <div className={styles.sectionHead}>
      <h3 id={id} className={styles.sectionTitle}>
        <span className={styles.sectionNumber}>{n}</span>
        {title}
      </h3>
      {action}
    </div>
  );
}

// The signed-in overview, laid out like a document register: what needs the
// member's signature first, then the register, their training and the trail.
export default function Dashboard({
  user, status, documents, trainings, auditEntries, canAuthor, onNewDraft,
  onOpenDocument, onOpenDocuments, onOpenTraining, onOpenAudit,
}: DashboardProps) {
  // Fixed when the overview opens, so ages and the date stay stable across re-renders.
  const [now] = useState(() => Date.now());
  const loaded = status === 'ready';
  const queue = signatureQueue(user.id, user.permissions, documents, trainings);
  const states = lifecycleCounts(documents);
  const total = documents.length;
  const recent = recentlyChanged(documents);
  const ownTraining = trainings.filter((t) => t.userId === user.id);
  const openTraining = ownTraining.filter((t) => t.status === 'ASSIGNED').length;
  const doneTraining = ownTraining.filter((t) => t.status === 'COMPLETED').length;

  return (
    <div className={styles.overview} aria-busy={!loaded}>
      <header className={styles.intro}>
        <div className={styles.introText}>
          <p className={styles.eyebrow}>
            {new Date(now).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <h2 className={styles.headline}>
            {status === 'failed' ? 'Your records could not be loaded.' : loaded ? headline(queue.length) : 'Checking what is waiting on you…'}
          </h2>
          {status === 'failed' && <p className={styles.lede}>Reload the page to try again. The overview shows nothing until it can read your records.</p>}
          {loaded && queue.length > 0 && <p className={styles.lede}>{queueSummary(queue)}</p>}
        </div>
        {canAuthor && (
          <button type="button" className={styles.primary} onClick={onNewDraft}>
            New draft
          </button>
        )}
      </header>

      <section aria-labelledby="queue-title" className={styles.section}>
        <SectionHead n={1} id="queue-title" title="Awaiting your signature" action={loaded && queue.length > 1 ? <span className={styles.note}>Oldest first</span> : undefined} />
        {status === 'loading' ? (
          <div className={styles.skeleton} aria-hidden="true">
            <span /><span /><span />
          </div>
        ) : status === 'failed' ? null : queue.length === 0 ? (
          <p className={styles.empty}>
            No review, approval, release or training is assigned to you. New assignments appear here as soon as they are made.
          </p>
        ) : (
          <ol className={styles.queue}>
            {queue.map((item, index) => {
              const age = waiting(item.since, now);
              return (
                <li key={item.key}>
                  <button
                    type="button"
                    className={styles.queueRow}
                    onClick={() => (item.meaning === 'READ' ? onOpenTraining() : onOpenDocument(item.documentId))}
                  >
                    <span className={styles.index}>{String(index + 1).padStart(2, '0')}</span>
                    <span className={styles.meaning}>{MEANING_LABEL[item.meaning]}</span>
                    <span className={styles.record}>
                      <span className={styles.docNumber}>
                        {item.documentNumber ?? 'No number'}
                        <span className={styles.version}> v{item.versionNumber}</span>
                      </span>
                      <span className={styles.docTitle}>{item.title}</span>
                    </span>
                    <span className={`${styles.age} ${age.overdue ? styles.overdue : ''}`}>
                      {age.text === 'today' ? 'Since today' : `Waiting ${age.text}`}
                    </span>
                    <span className={styles.go}>
                      {item.meaning === 'READ' ? 'Read' : 'Open'}
                      <span aria-hidden="true" className={styles.arrow}>→</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <div className={styles.columns}>
        <section aria-labelledby="register-title" className={`${styles.section} ${styles.wide}`}>
          <SectionHead
            n={2}
            id="register-title"
            title="Register"
            action={<button type="button" className={styles.textLink} onClick={onOpenDocuments}>All documents</button>}
          />

          {loaded && total > 0 && (
            <div className={styles.composition}>
              <div className={styles.bar} role="img" aria-label={states.map(({ state, count }) => `${STATE_LABEL[state]} ${count}`).join(', ')}>
                {states.filter(({ count }) => count > 0).map(({ state, count }) => (
                  <span key={state} className={styles[`fill${state}`]} style={{ flexGrow: count }} />
                ))}
              </div>
              <ul className={styles.legend}>
                {states.map(({ state, count }) => (
                  <li key={state} className={count === 0 ? styles.legendZero : undefined}>
                    <Swatch state={state} />
                    {STATE_LABEL[state]}
                    <span className={styles.legendCount}>{count}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {status === 'loading' ? (
            <div className={styles.skeleton} aria-hidden="true"><span /><span /></div>
          ) : status === 'failed' ? null : recent.length === 0 ? (
            <p className={styles.empty}>The register is empty. {canAuthor ? 'Start with a draft: upload the source file and give it a title.' : 'Documents appear here once an author creates the first draft.'}</p>
          ) : (
            <div className={styles.tableScroll}>
              <table className={styles.register}>
                <caption className={styles.caption}>Recently changed</caption>
                <thead>
                  <tr><th scope="col">Number</th><th scope="col">Title</th><th scope="col">State</th><th scope="col">Owner</th><th scope="col">Changed</th></tr>
                </thead>
                <tbody>
                  {recent.map((doc) => (
                    <tr key={doc.id}>
                      <td>
                        <button type="button" className={styles.numberLink} onClick={() => onOpenDocument(doc.id)}>
                          {doc.documentNumber ?? 'No number'}
                        </button>
                        <span className={styles.version}> v{doc.currentVersionNumber}</span>
                      </td>
                      <td>{doc.title}</td>
                      <td className={styles.stateCell}><Swatch state={doc.status} />{STATE_LABEL[doc.status] ?? doc.status}</td>
                      <td className={styles.muted}>{doc.owner.fullName}</td>
                      <td className={styles.date}>{formatDate(doc.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className={styles.narrow}>
          <section aria-labelledby="training-title" className={styles.section}>
            <SectionHead
              n={3}
              id="training-title"
              title="Your training"
              action={<button type="button" className={styles.textLink} onClick={onOpenTraining}>Training</button>}
            />
            <dl className={styles.figures}>
              <div>
                <dt>Open</dt>
                <dd className={loaded && openTraining > 0 ? styles.figureOpen : undefined}>{loaded ? openTraining : '–'}</dd>
              </div>
              <div>
                <dt>Signed</dt>
                <dd>{loaded ? doneTraining : '–'}</dd>
              </div>
            </dl>
          </section>

          {auditEntries && (
            <section aria-labelledby="audit-title" className={styles.section}>
              <SectionHead
                n={4}
                id="audit-title"
                title="Audit trail"
                action={<button type="button" className={styles.textLink} onClick={onOpenAudit}>Review</button>}
              />
              {auditEntries.length === 0 ? (
                <p className={styles.empty}>{loaded ? 'No audit entries yet.' : ''}</p>
              ) : (
                <ol className={styles.trail}>
                  {auditEntries.slice(0, 6).map((entry) => (
                    <li key={entry.id}>
                      <span className={styles.trailTime}>{formatDateTime(entry.timestamp)}</span>
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
