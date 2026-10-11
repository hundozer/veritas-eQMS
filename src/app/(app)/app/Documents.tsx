import { useEffect, useRef, useState } from 'react';
import styles from './documents.module.css';
import { Button, ButtonRow, EmptyState, formatDate, Ledger, LifecyclePath, Mono, Note, PageIntro, RecordHeader, RecordSheet, SectionTitle, shortHash, SignatureBoxes, Stamp } from '@/ui/paper';
import { ReasonForm, RoutingForm } from './ActionForm';
import { documentPanelActions, lifecyclePosition, LIFECYCLE_PATH, type PanelAction } from '@/lib/document-panel';
import { routingCandidates, type RoutingMember } from '@/lib/action-forms';

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

// Actions that need more than a click open a form in the record.
const FORM_ACTIONS = ['SUBMIT_REVIEW', 'RETURN', 'START_REVISION', 'WITHDRAW_REVISION'] as const;
type FormAction = (typeof FORM_ACTIONS)[number];
const isFormAction = (action: PanelAction): action is FormAction => (FORM_ACTIONS as readonly PanelAction[]).includes(action);

export type DocumentFormValues =
  | { action: 'SUBMIT_REVIEW'; reviewerId: string; approverId: string }
  | { action: 'RETURN' | 'WITHDRAW_REVISION'; reason: string }
  | { action: 'START_REVISION'; reason: string; file: File };

interface DocumentsProps {
  user: { id: string; permissions?: string[] } | null;
  documents: RegisterDocument[];
  members: readonly RoutingMember[];
  selectedId: string | null;
  canAuthor: boolean;
  onSelect: (id: string) => void;
  onNewDraft: () => void;
  // Signing and replacing the draft file; the form actions use onSubmitForm.
  onAction: (action: PanelAction, doc: RegisterDocument) => void;
  // Resolves null when the action went through, else the reason it was refused.
  onSubmitForm: (doc: RegisterDocument, values: DocumentFormValues) => Promise<string | null>;
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

function stepBox(steps: Step[], stepType: string, role: string) {
  const step = steps.find((s) => s.stepType === stepType);
  if (!step) return { role, name: '', state: '—' };
  return { role, name: step.approver.fullName, state: step.status === 'COMPLETED' ? 'signed' : 'not signed yet' };
}

function DocumentRecord({ doc, user, members, onAction, onSubmitForm }: Pick<DocumentsProps, 'user' | 'members' | 'onAction' | 'onSubmitForm'> & { doc: RegisterDocument }) {
  const [form, setForm] = useState<FormAction | null>(null);
  const current = doc.versions.find((v) => v.versionNumber === doc.currentVersionNumber);
  const effective = doc.versions.find((v) => v.status === 'EFFECTIVE');
  const steps = current?.approvalRoutes?.[0]?.steps ?? [];
  const position = lifecyclePosition(doc.status);
  const actions = documentPanelActions(doc, user?.id, user?.permissions);
  const forward = actions.filter((a) => !ENDING.includes(a));
  const ending = actions.filter((a) => ENDING.includes(a));
  const open = (action: PanelAction) => (isFormAction(action) ? setForm(action) : onAction(action, doc));
  const subject = `${doc.documentNumber ?? 'No number'} rev ${doc.currentVersionNumber}`;
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
    <RecordSheet sheetRef={ref} labelledBy="record-title" className={styles.record}>
      <RecordHeader
        titleId="record-title"
        title={doc.title}
        state={doc.status}
        identity={[
          { label: 'No.', value: doc.documentNumber ?? 'No number', mono: true },
          { label: 'Revision', value: doc.currentVersionNumber, mono: true },
          { label: 'Type', value: doc.documentType },
          { label: 'Classification', value: doc.classification },
        ]}
        details={[[
          { label: 'Owner', value: doc.owner.fullName, span: 2 },
          { label: 'Trains', value: doc.trainingRequirement?.requiredForRoles || 'No department' },
          {
            label: 'In force',
            value: effective?.effectiveDate ? <Mono>rev {effective.versionNumber} since {formatDate(effective.effectiveDate)}</Mono> : 'No effective version',
          },
        ]]}
      />

      {doc.description && <p className={styles.description}>{doc.description}</p>}

      <section aria-label="Lifecycle of the current revision">
        {position >= 0 ? (
          <LifecyclePath steps={LIFECYCLE_PATH.map((state) => PATH_LABEL[state])} current={position} attached label="Lifecycle of the current revision" />
        ) : (
          <Note>This document has left the lifecycle; its revisions and records are kept below.</Note>
        )}

        <SignatureBoxes boxes={boxes} />
      </section>

      <section aria-labelledby="actions-title" className={styles.actions}>
        <SectionTitle id="actions-title">What you can do</SectionTitle>
        {actions.length === 0 ? (
          <Note>No action on this document is open to you.</Note>
        ) : (
          <>
            {forward.length > 0 && (
              <ButtonRow>
                {forward.map((action) => (
                  <Button
                    key={action}
                    variant={PRIMARY.includes(action) ? 'primary' : 'outline'}
                    aria-expanded={isFormAction(action) ? form === action : undefined}
                    onClick={() => open(action)}
                  >
                    {action === 'START_REVISION' ? `Start revision ${doc.currentVersionNumber + 1}` : ACTION_LABEL[action]}
                  </Button>
                ))}
              </ButtonRow>
            )}
            {forward.includes('START_REVISION') && form !== 'START_REVISION' && (
              <Note>
                A new revision starts as a draft with a reason and a new source file. The effective revision stays in force until the new one is released.
              </Note>
            )}
            {ending.length > 0 && (
              <ButtonRow className={styles.endingRow}>
                {ending.map((action) => (
                  <Button
                    key={action}
                    variant="quiet"
                    aria-expanded={isFormAction(action) ? form === action : undefined}
                    onClick={() => open(action)}
                  >
                    {ACTION_LABEL[action]}
                  </Button>
                ))}
              </ButtonRow>
            )}
            {form === 'SUBMIT_REVIEW' && (
              <RoutingForm
                key={form}
                subject={subject}
                candidates={routingCandidates(members)}
                onSubmit={(values) => onSubmitForm(doc, { action: 'SUBMIT_REVIEW', ...values })}
                onCancel={() => setForm(null)}
              />
            )}
            {(form === 'RETURN' || form === 'WITHDRAW_REVISION') && (
              <ReasonForm
                key={form}
                kind={form}
                subject={subject}
                onSubmit={({ reason }) => onSubmitForm(doc, { action: form, reason })}
                onCancel={() => setForm(null)}
              />
            )}
            {form === 'START_REVISION' && (
              <ReasonForm
                key={form}
                kind={form}
                subject={`${doc.documentNumber ?? 'No number'} rev ${doc.currentVersionNumber + 1}`}
                onSubmit={({ reason, file }) => (file ? onSubmitForm(doc, { action: 'START_REVISION', reason, file }) : Promise.resolve('Choose the source file for the new revision.'))}
                onCancel={() => setForm(null)}
              />
            )}
          </>
        )}
        <a className={styles.copyLink} href={`/api/documents/${doc.id}/pdf`} target="_blank" rel="noreferrer">
          {effective ? 'Open the effective copy' : 'Open the current version (marked uncontrolled)'}
        </a>
      </section>

      <section aria-labelledby="revisions-title">
        <SectionTitle id="revisions-title">Revisions</SectionTitle>
        <Ledger className={styles.revisions}>
            <thead>
              <tr><th scope="col">Rev</th><th scope="col">State</th><th scope="col">Created</th><th scope="col">Effective</th><th scope="col">Change</th><th scope="col">SHA-256</th><th scope="col">Copy</th></tr>
            </thead>
            <tbody>
              {doc.versions.map((ver) => (
                <tr key={ver.id}>
                  <td><Mono>{ver.versionNumber}</Mono></td>
                  <td><Stamp state={ver.status} /></td>
                  <td><span className={styles.date}>{formatDate(ver.createdAt)}</span><br /><span className={styles.muted}>{ver.createdBy}</span></td>
                  <td className={styles.date}>{ver.effectiveDate ? formatDate(ver.effectiveDate) : '—'}</td>
                  <td>{ver.changeSummary || '—'}</td>
                  <td className={styles.hash} title={ver.hash}>{shortHash(ver.hash)}</td>
                  <td>
                    <a href={`/api/documents/${doc.id}/pdf?version=${ver.versionNumber}`} target="_blank" rel="noreferrer">
                      {ver.status === 'EFFECTIVE' ? 'Effective copy' : 'Uncontrolled copy'}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
        </Ledger>
      </section>
    </RecordSheet>
  );
}

// The Documents tab: the register on the left, the selected document's
// record on the right, laid out like the controlled documents it manages.
export default function Documents({ user, documents, members, selectedId, canAuthor, onSelect, onNewDraft, onAction, onSubmitForm }: DocumentsProps) {
  const selected = documents.find((d) => d.id === selectedId);

  return (
    <div className={styles.page}>
      <PageIntro
        title="Document register"
        lede={`${documents.length} document${documents.length === 1 ? '' : 's'}, most recently changed first.`}
        actions={canAuthor && <Button onClick={onNewDraft}>New draft</Button>}
      />

      <div className={styles.columns}>
        <nav aria-label="Document register" className={styles.register}>
          {documents.length === 0 ? (
            <Note>
              The register is empty. {canAuthor ? 'Start with a draft: upload the source file and give it a title.' : 'Documents appear here once an author creates the first draft.'}
            </Note>
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
                      <Mono>{doc.documentNumber ?? 'No number'} <span className={styles.muted}>rev {doc.currentVersionNumber}</span></Mono>
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
          <DocumentRecord key={selected.id} doc={selected} user={user} members={members} onAction={onAction} onSubmitForm={onSubmitForm} />
        ) : (
          <div className={styles.placeholder}>
            <EmptyState>Select a document in the register to see its record: who signed what, its revisions, and what you can do with it.</EmptyState>
          </div>
        )}
      </div>
    </div>
  );
}
