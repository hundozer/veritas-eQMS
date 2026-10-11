'use client';

import { useState, type FormEvent } from 'react';
import { AppShell, useThemeMode } from '@/ui';
import {
  Button,
  ButtonRow,
  DateField,
  Dialog,
  EmptyState,
  FieldPair,
  FileField,
  formatDate,
  formatDateTime,
  FormSheet,
  Ledger,
  LifecyclePath,
  Mono,
  Note,
  Notice,
  PageIntro,
  RecordHeader,
  RecordSheet,
  SectionTitle,
  SelectField,
  shortHash,
  SignatureBoxes,
  SignatureDialog,
  Stamp,
  TextAreaField,
  TextField,
} from '@/ui/paper';
import styles from './showcase.module.css';

// Synthetic records only; nothing here is read from or written to a database.
const HASH = '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08';
const REVISIONS = [
  { rev: 3, state: 'IN_REVIEW', created: '2026-10-02T09:12:00Z', effective: null, change: 'Hold time after cleaning reduced to 48 h (CC-2026-0004)' },
  { rev: 2, state: 'EFFECTIVE', created: '2026-03-14T10:00:00Z', effective: '2026-04-01T00:00:00Z', change: 'Rinse volumes per line size' },
  { rev: 1, state: 'SUPERSEDED', created: '2025-11-20T08:30:00Z', effective: '2025-12-01T00:00:00Z', change: 'First issue' },
];
const STATES = ['DRAFT', 'IN_REVIEW', 'APPROVED', 'EFFECTIVE', 'SUPERSEDED', 'OBSOLETE', 'WITHDRAWN'];

const SECTIONS = [
  ['foundations', 'Foundations'],
  ['actions', 'Buttons and notices'],
  ['inputs', 'Inputs and forms'],
  ['records', 'Quality records'],
  ['data', 'Ledgers and states'],
  ['signing', 'Signing'],
  ['planned', 'Not yet built'],
] as const;

const COLOUR_TOKENS = [
  ['--bg', 'Page background'], ['--bg2', 'Sidebar, index'], ['--card-bg', 'Sheet, record surface'], ['--blight', 'Hover wash'],
  ['--t1', 'Ink: text and rules'], ['--t2', 'Secondary text'], ['--t3', 'Tertiary text, inactive marks'], ['--border', 'Hairline rule'],
  ['--lime', 'In force, signing box'], ['--lime3', 'Current step'], ['--danger', 'Refusal, take out of use'], ['--danger-bg', 'Error notice wash'],
  ['--gold', 'Due soon (overview)'], ['--dark', 'Primary button hover'],
] as const;

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className={styles.section} aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`} className={styles.sectionHeading}>{title}</h3>
      {children}
    </section>
  );
}

function Specimen({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className={styles.specimen}>
      <span className={styles.specimenName}>{name}</span>
      {children}
    </div>
  );
}

export default function Showcase() {
  const { mode, toggleTheme } = useThemeMode();
  const [sheet, setSheet] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [dialog, setDialog] = useState(false);
  const [signing, setSigning] = useState(false);
  const [reason, setReason] = useState('');
  const [password, setPassword] = useState('');
  const [signError, setSignError] = useState<string | null>(null);

  const refuseSheet = (event: FormEvent) => {
    event.preventDefault();
    setSheetError('The server refused: example refusal shown in the form, which stays open.');
  };
  const refuseSigning = (event: FormEvent) => {
    event.preventDefault();
    setPassword('');
    setSignError('The password did not match; nothing was signed');
  };

  return (
    <AppShell
      navGroups={[{ title: 'Design system', items: SECTIONS.map(([id, label]) => ({ id, label, route: id })) }]}
      onNavigate={(route) => document.getElementById(route)?.scrollIntoView({ block: 'start' })}
      headerTitle="Design system"
      headerActions={<span className={styles.devTag}>Development only · synthetic data</span>}
      themeMode={mode}
      onThemeToggle={toggleTheme}
      footerText="Veritas"
    >
      <div className={styles.page}>
        <PageIntro
          title="Veritas paper components"
          lede="Every specimen below is the shared component from src/ui/paper, rendered with synthetic data. Switch the theme to check both."
        />

        <Section id="foundations" title="Foundations">
          <div className={styles.swatches}>
            {COLOUR_TOKENS.map(([token, use]) => (
              <div key={token} className={styles.swatch}>
                <span className={styles.chip} style={{ background: `var(${token})` }} aria-hidden="true" />
                <Mono>{token}</Mono>
                <span className={styles.swatchUse}>{use}</span>
              </div>
            ))}
          </div>
          <div className={styles.type}>
            <p className={styles.typeSerif}>Headline serif: Cleaning of the filling line</p>
            <p className={styles.typeSans}>Body sans, 14–15 px: The reviewer signs first, then the approver.</p>
            <p><Mono>Mono: SOP-0001 · rev 3 · {shortHash(HASH)} · {formatDate('2026-10-11T00:00:00Z')}</Mono></p>
            <span className={styles.typeLabel}>small-caps label</span>
          </div>
        </Section>

        <Section id="actions" title="Buttons and notices">
          <Specimen name="Button: primary · outline · quiet · disabled">
            <ButtonRow>
              <Button variant="primary">Sign approval</Button>
              <Button>New draft</Button>
              <Button variant="quiet">Withdraw this revision</Button>
              <Button variant="primary" disabled>Working…</Button>
            </ButtonRow>
          </Specimen>
          <Specimen name="Notice: info · success · error">
            <div className={styles.stack}>
              <Notice>Changing a member&apos;s role is not available yet.</Notice>
              <Notice tone="success">Approval signed. The document must still be released to become effective.</Notice>
              <Notice tone="error">Document state changed; refresh and try again</Notice>
            </div>
          </Specimen>
          <Specimen name="EmptyState">
            <EmptyState>The register is empty. Start with a draft: upload the source file and give it a title.</EmptyState>
          </Specimen>
        </Section>

        <Section id="inputs" title="Inputs and forms">
          <Specimen name="Fields">
            <div className={styles.form}>
              <TextField label="Title" placeholder="e.g. Cleaning of the filling line" hint="Shown in the register and on every copy." />
              <FieldPair>
                <SelectField label="Classification" defaultValue="CONTROLLED">
                  <option value="CONTROLLED">Controlled</option>
                  <option value="INTERNAL">Internal</option>
                </SelectField>
                <DateField label="Due date" defaultValue="2026-11-02" />
              </FieldPair>
              <TextAreaField label="Reason for the change" />
              <FileField label="Source file: PDF, Word, Excel, PowerPoint or text" />
            </div>
          </Specimen>
          <Specimen name="FormSheet (in-page action form)">
            {sheet ? (
              <FormSheet
                title="Return for changes"
                subject="SOP-0001 rev 3"
                note="The draft goes back to its author with your reason."
                error={sheetError}
                busy={false}
                submit="Return for changes"
                onCancel={() => { setSheet(false); setSheetError(null); }}
                onSubmit={refuseSheet}
              >
                <TextAreaField label="Reason" required />
              </FormSheet>
            ) : (
              <Button onClick={() => setSheet(true)} aria-expanded={false}>Return for changes</Button>
            )}
          </Specimen>
          <Specimen name="Dialog (create a record)">
            <Button onClick={() => setDialog(true)}>New draft</Button>
            {dialog && (
              <Dialog title="New controlled draft" submit="Create controlled draft" onSubmit={(e) => { e.preventDefault(); setDialog(false); }} onCancel={() => setDialog(false)}>
                <TextField label="Title" required />
                <FileField label="Source file" />
              </Dialog>
            )}
          </Specimen>
        </Section>

        <Section id="records" title="Quality records">
          <RecordSheet labelledBy="specimen-record">
            <RecordHeader
              titleId="specimen-record"
              title="Cleaning of the filling line"
              state="IN_REVIEW"
              identity={[
                { label: 'No.', value: 'SOP-0001', mono: true },
                { label: 'Revision', value: 3, mono: true },
                { label: 'Type', value: 'SOP' },
                { label: 'Classification', value: 'CONTROLLED' },
              ]}
              details={[[
                { label: 'Owner', value: 'Ada Author', span: 2 },
                { label: 'Trains', value: 'Production, QA' },
                { label: 'In force', value: <Mono>rev 2 since {formatDate('2026-04-01T00:00:00Z')}</Mono> },
              ]]}
            />
            <section aria-label="Lifecycle of the current revision">
              <LifecyclePath steps={['Draft', 'In review', 'Approved', 'Effective']} current={1} attached />
              <SignatureBoxes boxes={[
                { role: 'Author', name: 'Ada Author', state: formatDate('2026-10-02T09:12:00Z') },
                { role: 'Review', name: 'Rui Reviewer', state: 'not signed yet' },
                { role: 'Approve', name: 'Quinn Quality', state: 'not signed yet' },
                { role: 'Release', name: '', state: '—' },
              ]} />
            </section>
            <div>
              <SectionTitle>What you can do</SectionTitle>
              <ButtonRow>
                <Button variant="primary">Sign review</Button>
                <Button>Return for changes</Button>
              </ButtonRow>
            </div>
          </RecordSheet>
          <Specimen name="LifecyclePath (standalone, change control states as an example)">
            <LifecyclePath steps={['Requested', 'Assessed', 'Approved', 'Implemented', 'Verified', 'Closed']} current={2} />
          </Specimen>
        </Section>

        <Section id="data" title="Ledgers and states">
          <Specimen name="Stamp: every document state">
            <div className={styles.stamps}>{STATES.map((s) => <Stamp key={s} state={s} />)}</div>
          </Specimen>
          <Specimen name="Ledger">
            <Ledger caption="Revisions of SOP-0001">
              <thead>
                <tr><th scope="col">Rev</th><th scope="col">State</th><th scope="col">Created</th><th scope="col">Effective</th><th scope="col">Change</th><th scope="col">SHA-256</th></tr>
              </thead>
              <tbody>
                {REVISIONS.map((r) => (
                  <tr key={r.rev}>
                    <td><Mono>{r.rev}</Mono></td>
                    <td><Stamp state={r.state} /></td>
                    <td><Mono>{formatDateTime(r.created)}</Mono></td>
                    <td><Mono>{r.effective ? formatDate(r.effective) : '—'}</Mono></td>
                    <td>{r.change}</td>
                    <td title={HASH}><Mono>{shortHash(HASH)}</Mono></td>
                  </tr>
                ))}
              </tbody>
            </Ledger>
          </Specimen>
        </Section>

        <Section id="signing" title="Signing">
          <Specimen name="SignatureDialog (wrong password refused, as the server would)">
            <Button variant="primary" onClick={() => setSigning(true)}>Sign release (make effective)</Button>
            {signing && (
              <SignatureDialog
                title="Sign release"
                record="SOP-0001 Cleaning of the filling line"
                version="Revision 3"
                meaning="Released"
                consequence="Releasing makes this version effective now and supersedes the previously effective version."
                reasonRequired={false}
                reason={reason}
                onReasonChange={setReason}
                password={password}
                onPasswordChange={setPassword}
                error={signError}
                submit="Sign and make effective"
                onSubmit={refuseSigning}
                onCancel={() => { setSigning(false); setSignError(null); setPassword(''); setReason(''); }}
              />
            )}
          </Specimen>
        </Section>

        <Section id="planned" title="Not yet built">
          <Note>
            RelatedRecords, ImpactFinding, ImpactReviewPanel, AuditTimeline, EvidencePanel and AssignmentPanel have
            agreed contracts in docs/design-system/components.md but no implementation. They appear here when the
            roadmap item that needs them (VER-01 to VER-04) adds them.
          </Note>
        </Section>
      </div>
    </AppShell>
  );
}
