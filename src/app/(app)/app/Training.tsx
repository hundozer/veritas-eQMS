import styles from './training.module.css';
import { buildTrainingMatrix } from '@/lib/training-matrix';
import { ownTrainingRecord, type TrainingRowState } from '@/lib/training-record';

export interface TabAssignment {
  id: string;
  userId: string;
  status: string;
  assignedAt: string;
  completedAt: string | null;
  documentVersion?: { versionNumber: number } | null;
  user: { id: string; fullName: string; department: string };
  requirement: { document: { id: string; documentNumber?: string | null; title: string } };
  quizResult?: { score: number } | null;
}

interface TrainingProps {
  user: { id: string; fullName?: string; permissions?: string[] } | null;
  assignments: TabAssignment[];
  // Everyone's training, for holders of training.read_all (DEC-076).
  showMatrix: boolean;
  onSign: (assignment: TabAssignment) => void;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function StateText({ state, assignment }: { state: TrainingRowState; assignment: TabAssignment }) {
  if (state === 'signed') {
    if (assignment.quizResult) return <span>Quiz result recorded ({assignment.quizResult.score}%)</span>;
    return <span className={styles.signed}>Signed{assignment.completedAt ? ` ${formatDate(assignment.completedAt)}` : ''}</span>;
  }
  if (state === 'waiting') return <span className={styles.muted}>Waiting for the next effective version</span>;
  if (state === 'superseded') return <span className={styles.muted}>Replaced by training on a newer version</span>;
  if (state === 'open') return <span className={styles.muted}>Open; your role cannot sign training</span>;
  return <span className={styles.open}>Open</span>;
}

// The Training tab: the member's own "read and understood" record, then the
// training matrix for those who may see everyone's training.
export default function Training({ user, assignments, showMatrix, onSign }: TrainingProps) {
  const record = ownTrainingRecord(assignments, user?.id, user?.permissions);
  const open = record.filter((r) => r.state === 'sign' || r.state === 'open').length;
  const signed = record.filter((r) => r.state === 'signed').length;
  const matrix = showMatrix ? buildTrainingMatrix(assignments) : null;

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <div>
          <h2 className={styles.headline}>Training record</h2>
          <p className={styles.lede}>
            Read and understood{user?.fullName ? `, for ${user.fullName}` : ''}. {open} open, {signed} signed.
          </p>
        </div>
      </header>

      <section aria-labelledby="own-title" className={styles.sheet}>
        <div className={styles.sheetHead}>
          <h3 id="own-title" className={styles.sheetKind}>Your training</h3>
          <span className={styles.sheetNote}>Open the effective copy, read it, then sign with your password.</span>
        </div>
        {record.length === 0 ? (
          <p className={styles.empty}>No training is assigned to you. When a document you train on is released, it appears here.</p>
        ) : (
          <ol className={styles.rows}>
            {record.map((assignment) => {
              const doc = assignment.requirement.document;
              const actionable = assignment.state === 'sign';
              return (
                <li key={assignment.id} className={`${styles.row} ${actionable ? styles.rowOpen : ''}`}>
                  <div className={styles.rowDoc}>
                    <span className={styles.mono}>
                      {doc.documentNumber ?? 'No number'}
                      {assignment.documentVersion && <span className={styles.muted}> rev {assignment.documentVersion.versionNumber}</span>}
                    </span>
                    <span className={styles.rowTitle}>{doc.title}</span>
                  </div>
                  <div className={styles.rowDates}>
                    <span className={styles.label}>Assigned</span>
                    <span className={styles.mono}>{formatDate(assignment.assignedAt)}</span>
                  </div>
                  <div className={styles.rowState}>
                    <StateText state={assignment.state} assignment={assignment} />
                  </div>
                  {(assignment.state === 'sign' || assignment.state === 'open') && (
                    <div className={styles.rowActions}>
                      <a className={styles.outline} href={`/api/documents/${doc.id}/pdf`} target="_blank" rel="noreferrer">Open the effective copy</a>
                      {actionable && (
                        <button type="button" className={styles.primary} onClick={() => onSign(assignment)}>
                          Sign read and understood
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {matrix && (
        <section aria-labelledby="matrix-title" className={styles.matrixSection}>
          <div className={styles.matrixHead}>
            <h3 id="matrix-title" className={styles.sectionTitle}>Training matrix</h3>
            <span className={styles.counts}>
              <span className={styles.countOpen}>{matrix.totals.open} open</span>
              <span>{matrix.totals.completed} signed</span>
            </span>
          </div>
          <p className={styles.note}>Each cell is a person&apos;s training on the newest version they were assigned. Superseded assignments are left out.</p>
          {matrix.people.length === 0 ? (
            <p className={styles.empty}>No training is assigned yet. Training is assigned when a document with training departments is released.</p>
          ) : (
            <div className={styles.tableScroll}>
              <table className={styles.matrix}>
                <thead>
                  <tr>
                    <th scope="col" className={styles.personCol}>Person</th>
                    {matrix.documents.map((document) => (
                      <th key={document.id} scope="col" title={document.title}>
                        <span className={styles.mono}>{document.documentNumber ?? document.title}</span>
                        <span className={styles.colTitle}>{document.title}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrix.people.map((person) => (
                    <tr key={person.id}>
                      <th scope="row" className={styles.personCol}>
                        <span className={styles.personName}>{person.fullName}</span>
                        <span className={styles.muted}>{person.department}</span>
                      </th>
                      {matrix.documents.map((document) => {
                        const cell = person.cells[document.id];
                        if (!cell) return <td key={document.id} className={styles.none}><span aria-label="Not assigned">—</span></td>;
                        const version = cell.versionNumber ? `rev ${cell.versionNumber}` : '';
                        return cell.status === 'COMPLETED' ? (
                          <td key={document.id}>
                            <span className={styles.tick} aria-hidden="true">✓</span>
                            <span className={styles.cellText}>{version}{cell.completedAt ? ` · ${formatDate(cell.completedAt)}` : ''}</span>
                          </td>
                        ) : (
                          <td key={document.id} className={styles.cellOpen}>
                            <span className={styles.ring} aria-hidden="true" />
                            <span className={styles.cellText}>open {version}</span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className={styles.legend}>
            <span><span className={styles.tick} aria-hidden="true">✓</span> signed, with the revision and date</span>
            <span><span className={styles.ring} aria-hidden="true" /> open</span>
            <span>— not in a training department for this document</span>
          </p>
        </section>
      )}
    </div>
  );
}
