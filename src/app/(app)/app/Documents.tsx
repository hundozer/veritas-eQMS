import { useEffect, useRef } from 'react';
import styles from './documents.module.css';
import Stamp from './Stamp';
import { documentPanelActions, lifecyclePosition, LIFECYCLE_PATH, type PanelAction } from '@/lib/document-panel';

interface Step {
  id: string;
  stepType: string;
  status: string;
  approver: { id: string; fullName: string };
}

interface Version {
  id: string;
  versionNumber: number;
  status: string;
  effectiveDate?: string | null;
  changeSummary?: string | null;
  hash: string;
  createdAt: string;
  createdBy: string;
  approvalRoutes?: Array<{ steps: Step[] }>;
}

export interface RegisterDocument {
  id: string;
  documentNumber?: string | null;
  documentType: string;
  title: string;
  description: string;
  classification: string;
  status: string;
  currentVersionNumber: number;
  owner: { fullName: string };
  versions: Version[];
  trainingRequirement?: { requiredForRoles: string } | null;
}

interface DocumentsProps {
  user: { id: string; permissions?: string[] } | null;
  documents: RegisterDocument[];
  selectedId: string | null;
  canAuthor: boolean;
  onSelect: (id: string) => void;
  onNewDraft: () => void;
  onAction: (action: PanelAction, doc: RegisterDocument) => void;
}

const PATH_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  IN_REVIEW: 'In review',
  APPROVED: 'Approved',
  EFFECTIVE: 'Effective',
};

const ACTION_LABEL: Record<PanelAction, string> = {
  SIGN_REVIEW: 'Sign review',
  RETURN: 'Return for changes',
  SIGN_APPROVE: 'Sign approval',
  SIGN_RELEASE: 'Sign release (make effective)',
  SUBMIT_REVIEW: 'Submit for review',
  REPLACE_FILE: 'Replace draft file',
  START_REVISION: 'Start a new revision',
  WITHDRAW_REVISION: 'Withdraw this revision',
  SIGN_RETIRE: 'Retire (sign)',
};

// Signing and submitting move the document forward; withdrawing and retiring
// take something out of use, so they sit apart.
const PRIMARY: PanelAction[] = ['SIGN_REVIEW', 'SIGN_APPROVE', 'SIGN_RELEASE', 'SUBMIT_REVIEW'];
const ENDING: PanelAction[] = ['WITHDRAW_REVISION', 'SIGN_RETIRE'];

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function stepBox(steps: Step[], stepType: string, role: string) {
  const step = steps.find((s) => s.stepType === stepType);
  if (!step) return { role, name: '', state: '—' };
  return { role, name: step.approver.fullName, state: step.status === 'COMPLETED' ? 'signed' : 'not signed yet' };
}

function DocumentRecord({ doc, user, onAction }: { doc: RegisterDocument; user: DocumentsProps['user']; onAction: DocumentsProps['onAction'] }) {
  const current = doc.versions.find((v) => v.versionNumber === doc.currentVersionNumber);
  const effective = doc.versions.find((v) => v.status === 'EFFECTIVE');
  const steps = current?.approvalRoutes?.[0]?.steps ?? [];
  const position = lifecyclePosition(doc.status);
  const actions = documentPanelActions(doc, user?.id, user?.permissions);
  const forward = actions.filter((a) => !ENDING.includes(a));
  const ending = actions.filter((a) => ENDING.includes(a));
  // On a narrow screen the record sits below the register; bring it into view
  // when a document is chosen (or arrives selected from an overview slip).
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (window.matchMedia('(max-width: 900px)').matches) ref.current?.scrollIntoView({ block: 'start' });
  }, []);
  const boxes = [
    { role: 'Author', name: current?.createdBy ?? '', state: current ? formatDate(current.createdAt) : '—' },
    stepBox(steps, 'REVIEW', 'Review'),
    stepBox(steps, 'APPROVAL', 'Approve'),
    { role: 'Release', name: '', state: current && ['EFFECTIVE', 'SUPERSEDED'].includes(current.status) ? 'signed' : '—' },
  ];

  return (
    <article ref={ref} className={styles.record} aria-labelledby="record-title">
      <table className={styles.formHeader}>
        <tbody>
          <tr>
            <td><span className={styles.label}>No.</span><span className={styles.mono}>{doc.documentNumber ?? 'No number'}</span></td>
            <td><span className={styles.label}>Revision</span><span className={styles.mono}>{doc.currentVersionNumber}</span></td>
            <td><span className={styles.label}>Type</span>{doc.documentType}</td>
            <td><span className={styles.label}>Classification</span>{doc.classification}</td>
          </tr>
          <tr>
            <td colSpan={4} className={styles.titleCell}>
              <h3 id="record-title" className={styles.title}>{doc.title}</h3>
              <Stamp state={doc.status} className={styles.recordStamp} />
            </td>
          </tr>
          <tr>
            <td colSpan={2}><span className={styles.label}>Owner</span>{doc.owner.fullName}</td>
            <td><span className={styles.label}>Trains</span>{doc.trainingRequirement?.requiredForRoles || 'No department'}</td>
            <td>
              <span className={styles.label}>In force</span>
              {effective?.effectiveDate ? <span className={styles.mono}>rev {effective.versionNumber} since {formatDate(effective.effectiveDate)}</span> : 'No effective version'}
            </td>
          </tr>
        </tbody>
      </table>

      {doc.description && <p className={styles.description}>{doc.description}</p>}

      <section aria-label="Lifecycle of the current revision">
        {position >= 0 ? (
          <ol className={styles.path}>
            {LIFECYCLE_PATH.map((state, index) => (
              <li
                key={state}
                className={`${styles.pathStep} ${index < position ? styles.pathDone : ''} ${index === position ? styles.pathNow : ''}`}
                aria-current={index === position ? 'step' : undefined}
              >
                <span className={styles.pathMark} aria-hidden="true">{index < position ? '✓' : index + 1}</span>
                {PATH_LABEL[state]}
              </li>
            ))}
          </ol>
        ) : (
          <p className={styles.note}>This document has left the lifecycle; its revisions and records are kept below.</p>
        )}

        <div className={styles.sigRow}>
          {boxes.map((box) => (
            <div key={box.role} className={styles.sigBox}>
              <span className={styles.label}>{box.role}</span>
              <span className={styles.sigLine}>{box.name}</span>
              <span className={styles.sigState}>{box.state}</span>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="actions-title" className={styles.actions}>
        <h4 id="actions-title" className={styles.sectionTitle}>What you can do</h4>
        {actions.length === 0 ? (
          <p className={styles.note}>No action on this document is open to you.</p>
        ) : (
          <>
            {forward.length > 0 && (
              <div className={styles.buttonRow}>
                {forward.map((action) => (
                  <button
                    key={action}
                    type="button"
                    className={PRIMARY.includes(action) ? styles.primary : styles.outline}
                    onClick={() => onAction(action, doc)}
                  >
                    {action === 'START_REVISION' ? `Start revision ${doc.currentVersionNumber + 1}` : ACTION_LABEL[action]}
                  </button>
                ))}
              </div>
            )}
            {forward.includes('START_REVISION') && (
              <p className={styles.note}>
                A new revision starts as a draft with a reason and a new source file. The effective revision stays in force until the new one is released.
              </p>
            )}
            {ending.length > 0 && (
              <div className={`${styles.buttonRow} ${styles.endingRow}`}>
                {ending.map((action) => (
                  <button key={action} type="button" className={styles.quiet} onClick={() => onAction(action, doc)}>
                    {ACTION_LABEL[action]}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
        <a className={styles.copyLink} href={`/api/documents/${doc.id}/pdf`} target="_blank" rel="noreferrer">
          {effective ? 'Open the effective copy' : 'Open the current version (marked uncontrolled)'}
        </a>
      </section>

      <section aria-labelledby="revisions-title">
        <h4 id="revisions-title" className={styles.sectionTitle}>Revisions</h4>
        <div className={styles.tableScroll}>
          <table className={styles.ledger}>
            <thead>
              <tr><th scope="col">Rev</th><th scope="col">State</th><th scope="col">Created</th><th scope="col">Effective</th><th scope="col">Change</th><th scope="col">SHA-256</th><th scope="col">Copy</th></tr>
            </thead>
            <tbody>
              {doc.versions.map((ver) => (
                <tr key={ver.id}>
                  <td className={styles.mono}>{ver.versionNumber}</td>
                  <td><Stamp state={ver.status} /></td>
                  <td><span className={styles.date}>{formatDate(ver.createdAt)}</span><br /><span className={styles.muted}>{ver.createdBy}</span></td>
                  <td className={styles.date}>{ver.effectiveDate ? formatDate(ver.effectiveDate) : '—'}</td>
                  <td>{ver.changeSummary || '—'}</td>
                  <td className={styles.hash} title={ver.hash}>{ver.hash.slice(0, 12)}…</td>
                  <td>
                    <a href={`/api/documents/${doc.id}/pdf?version=${ver.versionNumber}`} target="_blank" rel="noreferrer">
                      {ver.status === 'EFFECTIVE' ? 'Effective copy' : 'Uncontrolled copy'}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </article>
  );
}

// The Documents tab: the register on the left, the selected document's
// record on the right, laid out like the controlled documents it manages.
export default function Documents({ user, documents, selectedId, canAuthor, onSelect, onNewDraft, onAction }: DocumentsProps) {
  const selected = documents.find((d) => d.id === selectedId);

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <div>
          <h2 className={styles.headline}>Document register</h2>
          <p className={styles.lede}>{documents.length} document{documents.length === 1 ? '' : 's'}, most recently changed first.</p>
        </div>
        {canAuthor && (
          <button type="button" className={styles.outline} onClick={onNewDraft}>New draft</button>
        )}
      </header>

      <div className={styles.columns}>
        <nav aria-label="Document register" className={styles.register}>
          {documents.length === 0 ? (
            <p className={styles.note}>
              The register is empty. {canAuthor ? 'Start with a draft: upload the source file and give it a title.' : 'Documents appear here once an author creates the first draft.'}
            </p>
          ) : (
            <ul className={styles.list}>
              {documents.map((doc) => (
                <li key={doc.id}>
                  <button
                    type="button"
                    className={`${styles.entry} ${doc.id === selectedId ? styles.entrySelected : ''}`}
                    aria-current={doc.id === selectedId ? 'true' : undefined}
                    onClick={() => onSelect(doc.id)}
                  >
                    <span className={styles.entryHead}>
                      <span className={styles.mono}>{doc.documentNumber ?? 'No number'} <span className={styles.muted}>rev {doc.currentVersionNumber}</span></span>
                      <Stamp state={doc.status} />
                    </span>
                    <span className={styles.entryTitle}>{doc.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </nav>

        {selected ? (
          <DocumentRecord key={selected.id} doc={selected} user={user} onAction={onAction} />
        ) : (
          <div className={styles.placeholder}>
            <p>Select a document in the register to see its record: who signed what, its revisions, and what you can do with it.</p>
          </div>
        )}
      </div>
    </div>
  );
}
