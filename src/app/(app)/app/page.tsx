'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell, useThemeMode } from '@/ui';
import type { NavGroup } from '@/ui';
import { documentActionsFor } from '@/lib/document-actions';
import { workspaceSections } from '@/lib/workspace-access';
import type { AuditChange, AuditDetail } from '@/lib/audit-review';
import { REASON_REQUIRED, SIGNING_CONSEQUENCE, SIGNING_LABELS, signingRequest, type SigningMode } from '@/lib/signing-request';
import { Dialog, FieldPair, FileField, Notice, SelectField, SignatureDialog, TextAreaField, TextField } from '@/ui/paper';
import Dashboard from './Dashboard';
import Documents, { type DocumentFormValues } from './Documents';
import Training from './Training';
import People from './People';
import AuditTrail from './AuditTrail';
import type { PanelAction } from '@/lib/document-panel';
import { resendInvitation, resetTwoStepVerification } from '@/lib/invitations-client';
import { prepareDocumentFile, sha256Hex } from '@/lib/document-file-upload';
import { DOCUMENT_FILE_ACCEPT, DOCUMENT_FILE_TYPES_TEXT } from '@/lib/document-file-types';
import {
  Dashboard as DashboardIcon,
  Description as DescriptionIcon,
  School as SchoolIcon,
  History as HistoryIcon,
} from '@mui/icons-material';

interface User {
  id: string;
  email: string;
  fullName: string;
  role: string;
  department: string;
  clearance: string;
  tenantId: string;
  tenantName?: string;
  membershipRole?: string;
  // From the member list (/api/users).
  roleName?: string | null;
  accountStatus?: string;
  invitationPending?: boolean;
  permissions?: string[];
  tenant?: {
    id?: string;
    name: string;
  };
}

interface DocumentVersion {
  id: string;
  versionNumber: number;
  status: string;
  effectiveDate?: string | null;
  changeSummary?: string | null;
  hash: string;
  createdAt: string;
  createdBy: string;
  authoredById?: string | null;
  approvalRoutes?: Array<{
    id: string;
    status: string;
    steps: Array<{ id: string; stepType: string; status: string; comment?: string | null; approver: User }>;
  }>;
}

interface Document {
  id: string;
  documentNumber?: string | null;
  documentType: string;
  title: string;
  description: string;
  classification: string;
  status: string;
  ownerId: string;
  currentVersionNumber: number;
  createdAt: string;
  updatedAt: string;
  owner: User;
  versions: DocumentVersion[];
  trainingRequirement?: {
    id: string;
    requiredForRoles: string;
    requiresQuiz: boolean;
    quizQuestions: string | null;
  } | null;
}

interface TrainingAssignment {
  id: string;
  requirementId: string;
  userId: string;
  status: string;
  assignedAt: string;
  completedAt: string | null;
  documentVersion?: { versionNumber: number } | null;
  user: User;
  requirement: {
    id: string;
    requiredForRoles: string;
    requiresQuiz: boolean;
    document: Document;
  };
  quizResult?: {
    id: string;
    score: number;
    passed: boolean;
    createdAt: string;
  } | null;
}

interface AuditLog {
  id: string;
  eventId: string;
  timestamp: string;
  userEmail: string | null;
  userRole: string | null;
  action: string;
  objectType: string;
  objectId: string | null;
  status: string;
  changes: AuditChange[];
  details: AuditDetail[];
}

// The signed-in workspace (/app). The (app) layout has already checked the
// session on the server; what is offered here follows the persisted
// permissions returned with the session, never a job title (DEC-058).
export default function Workspace() {
  const router = useRouter();

  // Navigation
  const [activeTab, setActiveTab] = useState<'dashboard' | 'documents' | 'training' | 'audit' | 'users-management'>('dashboard');

  // Users / Personas
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // App Data
  const [documents, setDocuments] = useState<Document[]>([]);
  const [trainings, setTrainings] = useState<TrainingAssignment[]>([]);
  const [trainingMatrixView, setTrainingMatrixView] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [dataStatus, setDataStatus] = useState<'loading' | 'ready' | 'failed'>('loading');

  // Selected Detail views
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  // Forms / Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [signingMode, setSigningMode] = useState<SigningMode | null>(null);
  const [signingTraining, setSigningTraining] = useState<{ id: string; title: string; versionNumber: number } | null>(null);
  const [signPassword, setSignPassword] = useState('');
  const [signing, setSigning] = useState(false);

  // Document creation form state
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newClassification, setNewClassification] = useState('CONTROLLED');
  const [newDocumentType, setNewDocumentType] = useState('SOP');
  const [newRequiredRoles, setNewRequiredRoles] = useState('');

  // Attached Physical File State
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docFileName, setDocFileName] = useState('');
  const [docFileSize, setDocFileSize] = useState('');
  const [docFileHash, setDocFileHash] = useState('');

  const handleDocFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setDocFile(file);
    setDocFileName(file.name);
    setDocFileSize(`${(file.size / 1024).toFixed(1)} KB`);
    try {
      setDocFileHash(await sha256Hex(await file.arrayBuffer()));
    } catch {
      setDocFileHash('');
    }
  };

  // Approval form state
  const [esignComment, setEsignComment] = useState('');

  // Audit Filters
  const [auditActionFilter, setAuditActionFilter] = useState('');
  const [auditTypeFilter, setAuditTypeFilter] = useState('');

  // General Notification / Error messages
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Restore the authenticated user from the server-side opaque session.
  const reloadUsers = useCallback(() => {
    fetch('/api/users')
      .then((res) => res.json())
      .then((usersData) => setUsers(usersData.users || []))
      .catch(() => undefined);
  }, []);

  const flashSuccess = (message: string) => {
    setErrorMessage(null);
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  const handleResendInvitation = async (userId: string) => {
    const result = await resendInvitation(userId);
    if (result.ok) setSuccessMessage('A new invitation link was sent.');
    else setErrorMessage(result.message);
    setTimeout(() => {
      setSuccessMessage(null);
      setErrorMessage(null);
    }, 5000);
  };

  // Lost phone: an administrator resets a member's two-step verification
  // (DEC-080). The reason comes from the form on the People tab, which shows
  // a refusal itself.
  const handleResetMfa = async (userId: string, name: string, reason: string): Promise<string | null> => {
    const result = await resetTwoStepVerification(userId, reason);
    if (!result.ok) return result.message;
    flashSuccess(`Two-step verification was reset for ${name}.`);
    return null;
  };

  useEffect(() => {
    fetch('/api/auth/session')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setCurrentUser(data.user);
          reloadUsers();
        } else {
          router.replace('/');
        }
      })
      .catch(() => router.replace('/'));
  }, [reloadUsers, router]);

  // Handle Sign Out / Logout
  const handleSignOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setCurrentUser(null);
    router.replace('/');
    router.refresh();
  };

  // Fetch all dashboard data when user switches
  const fetchData = useCallback(async () => {
    if (!currentUser) return;

    try {
      // Fetch Documents
      const docRes = await fetch('/api/documents');
      const docData = await docRes.json();
      if (docData.documents) setDocuments(docData.documents);

      // Fetch Trainings
      const trRes = await fetch('/api/trainings');
      const trData = await trRes.json();
      if (trData.assignments) setTrainings(trData.assignments);
      setTrainingMatrixView(trData.isMatrix === true);

      // Fetch Audit logs (if compliance role)
      if (workspaceSections(currentUser.permissions).includes('audit')) {
        const auditQuery = new URLSearchParams();
        if (auditActionFilter) auditQuery.append('action', auditActionFilter);
        if (auditTypeFilter) auditQuery.append('objectType', auditTypeFilter);

        const audRes = await fetch(`/api/audit?${auditQuery.toString()}`);
        const audData = await audRes.json();
        if (audData.logs) setAuditLogs(audData.logs);
      }

      // Fetch Notifications
      const notifRes = await fetch('/api/notifications');
      const notifData = await notifRes.json();
      if (notifData.notifications) setNotifications(notifData.notifications);
      setDataStatus(docRes.ok && trRes.ok ? 'ready' : 'failed');
    } catch (err) {
      console.error('Fetch data error:', err);
      setDataStatus('failed');
    }
  }, [currentUser, auditActionFilter, auditTypeFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // A new draft revision of an effective document, with the reason and
  // source file from the form in the document record.
  const handleStartRevision = async (docId: string, reason: string, file: File): Promise<string | null> => {
    try {
      const fileFields = await prepareDocumentFile(file);
      const res = await fetch(`/api/documents/${docId}/revision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason, ...fileFields }),
      });
      const data = await res.json();
      if (!res.ok) return data.error?.message || 'Failed to create document revision';
      flashSuccess('A new draft revision was created; the effective version remains controlled.');
      await fetchData();
      return null;
    } catch (err: any) {
      return err.message || 'Failed to create document revision';
    }
  };

  const handleReplaceDraftFile = async (docId: string) => {
    const file = await new Promise<File | null>((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = DOCUMENT_FILE_ACCEPT;
      input.onchange = () => resolve(input.files?.[0] || null);
      input.click();
    });
    if (!file) return;
    try {
      const res = await fetch(`/api/documents/${docId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(await prepareDocumentFile(file)),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Draft replacement failed');
      setSuccessMessage('Draft file replaced with a new immutable controlled object.');
      await fetchData();
    } catch (error: any) {
      setErrorMessage(error.message);
    }
    setTimeout(() => {
      setSuccessMessage(null);
      setErrorMessage(null);
    }, 5000);
  };

  // Create Document
  const handleCreateDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !docFile) {
      setErrorMessage('A source file is required for every controlled document.');
      return;
    }

    try {
      const fileFields = await prepareDocumentFile(docFile);
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: newTitle,
          documentType: newDocumentType,
          ...fileFields,
          description: newDesc,
          classification: newClassification,
          requiredRoles: newRequiredRoles,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMessage(`Document "${data.document.title}" created successfully!`);
        setShowCreateModal(false);
        setNewTitle('');
        setNewDesc('');
        setNewDocumentType('SOP');
        setNewClassification('CONTROLLED');
        setNewRequiredRoles('');
        setDocFile(null);
        setDocFileName('');
        setDocFileSize('');
        setDocFileHash('');
        fetchData();
      } else {
        setErrorMessage(data.error?.message || 'Failed to create document');
      }
      setTimeout(() => {
        setSuccessMessage(null);
        setErrorMessage(null);
      }, 5000);
    } catch (err: any) {
      setErrorMessage(err.message);
      setTimeout(() => setErrorMessage(null), 5000);
    }
  };

  // Review completion and approval are signed with the signer's own password.
  const closeSigning = () => {
    setSigningMode(null);
    setSigningTraining(null);
    setSignPassword('');
    setEsignComment('');
  };

  const handleSignDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = signingMode === 'READ' ? signingTraining?.id : selectedDocId;
    if (!targetId || !signingMode) return;
    const { path, method, body } = signingRequest(signingMode, targetId, esignComment, signPassword);
    setSignPassword('');
    setSigning(true);

    try {
      const res = await fetch(path, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMessage(signingMode === 'READ'
          ? 'Training signed as read and understood.'
          : signingMode === 'REVIEW'
          ? 'Review signed; assigned approval is now available.'
          : signingMode === 'APPROVE'
            ? 'Approval signed. The document must still be released to become effective.'
            : signingMode === 'RELEASE'
              ? 'Release signed. This version is now effective; any previous version is superseded.'
              : 'Retirement signed. The document is obsolete; its records were kept.');
        closeSigning();
        fetchData();
      } else {
        setErrorMessage(data.error?.message || 'Signing failed');
      }
      setTimeout(() => {
        setSuccessMessage(null);
        setErrorMessage(null);
      }, 5000);
    } catch (err: any) {
      setErrorMessage(err.message);
      setTimeout(() => setErrorMessage(null), 5000);
    } finally {
      setSigning(false);
    }
  };

  // Resolves null when the action went through, else the reason it was
  // refused, which the form in the document record shows.
  const runDocumentAction = async (
    path: string,
    body: Record<string, unknown>,
    success: string,
  ): Promise<string | null> => {
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) return data.error?.message || 'Document action failed';
      flashSuccess(success);
      await fetchData();
      return null;
    } catch (error: any) {
      return error.message || 'Document action failed';
    }
  };

  const handleDocumentForm = (doc: { id: string }, values: DocumentFormValues): Promise<string | null> => {
    switch (values.action) {
      case 'SUBMIT_REVIEW':
        return runDocumentAction(
          `/api/documents/${doc.id}/submit-review`,
          { reviewerId: values.reviewerId, approverId: values.approverId },
          'Draft submitted for assigned review.',
        );
      case 'RETURN':
        return runDocumentAction(`/api/documents/${doc.id}/review`, { action: 'RETURN', comment: values.reason }, 'Document returned to draft.');
      case 'WITHDRAW_REVISION':
        return runDocumentAction(
          `/api/documents/${doc.id}/withdraw-revision`,
          { reason: values.reason },
          'Revision withdrawn; the effective version remains in force.',
        );
      case 'START_REVISION':
        return handleStartRevision(doc.id, values.reason, values.file);
    }
  };

  const selectedDoc = documents.find((d) => d.id === selectedDocId);

  // The Documents tab offers only the actions documentPanelActions allows.
  // Signing opens the signing dialog; actions that need a reason or the
  // routing go through the form in the record (handleDocumentForm).
  const handleDocumentAction = (action: PanelAction, doc: { id: string }) => {
    switch (action) {
      case 'REPLACE_FILE': return handleReplaceDraftFile(doc.id);
      case 'SIGN_REVIEW': return setSigningMode('REVIEW');
      case 'SIGN_APPROVE': return setSigningMode('APPROVE');
      case 'SIGN_RELEASE': return setSigningMode('RELEASE');
      case 'SIGN_RETIRE': return setSigningMode('RETIRE');
    }
  };
  const { canAuthor: canAuthorDocuments } = documentActionsFor(currentUser?.permissions);
  const canInviteUsers = Boolean(currentUser?.permissions?.includes('users.create'));
  const canExportAudit = Boolean(currentUser?.permissions?.includes('audit.read') && currentUser?.permissions?.includes('audit.export'));
  const auditExportHref = `/api/audit/export?${new URLSearchParams({
    ...(auditActionFilter && { action: auditActionFilter }),
    ...(auditTypeFilter && { objectType: auditTypeFilter }),
  }).toString()}`;
  const { mode, toggleTheme } = useThemeMode();

  const sections = workspaceSections(currentUser?.permissions);
  const navGroups: NavGroup[] = [
    {
      title: 'Veritas eQMS',
      items: [
        { id: 'dashboard', label: 'Overview', route: 'dashboard', icon: <DashboardIcon /> },
        { id: 'documents', label: 'Documents', route: 'documents', icon: <DescriptionIcon /> },
        { id: 'training', label: 'Training', route: 'training', icon: <SchoolIcon /> },
        ...(sections.includes('users-management') ? [
          { id: 'users-management', label: 'People', route: 'users-management', icon: <SchoolIcon /> }
        ] : []),
        ...(sections.includes('audit') ? [
          { id: 'audit', label: 'Audit trail', route: 'audit', icon: <HistoryIcon /> }
        ] : []),
      ]
    }
  ];

  const headerActions = currentUser && (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '13px' }}>
      {(currentUser.tenantName || currentUser.tenant?.name) && (
        <span style={{ color: 'var(--t2)' }}>{currentUser.tenantName || currentUser.tenant?.name}</span>
      )}
      <span style={{ fontWeight: 600 }}>{currentUser.fullName}</span>
      <button
        type="button"
        onClick={handleSignOut}
        style={{ minHeight: '32px', padding: '0 12px', borderRadius: '3px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--t1)', font: 'inherit', fontWeight: 500, cursor: 'pointer' }}
      >
        Sign out
      </button>
    </div>
  );

  const getHeaderTitle = () => {
    switch (activeTab) {
      case 'dashboard': return 'Overview';
      case 'documents': return 'Documents';
      case 'training': return 'Training';
      case 'users-management': return 'People';
      case 'audit': return 'Audit trail';
      default: return 'Veritas eQMS';
    }
  };

  return (
    <AppShell
      navGroups={navGroups}
      activeRoute={activeTab}
      onNavigate={(route) => setActiveTab(route as any)}
      headerTitle={getHeaderTitle()}
      headerActions={headerActions}
      themeMode={mode}
      onThemeToggle={toggleTheme}
      footerText="Veritas"
    >
      <div style={{ flex: 1, padding: '24px 0', overflowY: 'auto' }}>
        {/* Messages about the last action; a modal shows its own refusal. */}
        {!showCreateModal && !signingMode && (successMessage || errorMessage) && (
          <div style={{ marginBottom: '24px' }}>
            {successMessage && <Notice tone="success">{successMessage}</Notice>}
            {errorMessage && <Notice tone="error">{errorMessage}</Notice>}
          </div>
        )}

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'dashboard' && currentUser && (
          <Dashboard
            user={currentUser}
            status={dataStatus}
            documents={documents}
            trainings={trainings}
            auditEntries={sections.includes('audit') && !auditActionFilter && !auditTypeFilter ? auditLogs : null}
            canAuthor={canAuthorDocuments}
            onNewDraft={() => setShowCreateModal(true)}
            onOpenDocument={(id) => {
              setSelectedDocId(id);
              setActiveTab('documents');
            }}
            onOpenDocuments={() => setActiveTab('documents')}
            onOpenTraining={() => setActiveTab('training')}
            onOpenAudit={() => setActiveTab('audit')}
          />
        )}

        {/* TAB 2: DOCUMENTS */}
        {activeTab === 'documents' && (
          <Documents
            user={currentUser}
            documents={documents}
            selectedId={selectedDocId}
            canAuthor={canAuthorDocuments}
            onSelect={setSelectedDocId}
            onNewDraft={() => setShowCreateModal(true)}
            members={users}
            onAction={handleDocumentAction}
            onSubmitForm={handleDocumentForm}
          />
        )}

        {/* TAB 3: TRAINING */}
        {activeTab === 'training' && (
          <Training
            user={currentUser}
            assignments={trainings}
            showMatrix={trainingMatrixView}
            onSign={(assignment) => {
              if (!assignment.documentVersion) return;
              setSigningTraining({ id: assignment.id, title: assignment.requirement.document.title, versionNumber: assignment.documentVersion.versionNumber });
              setSigningMode('READ');
            }}
          />
        )}

        {/* TAB: PEOPLE */}
        {activeTab === 'users-management' && (
          <People
            user={currentUser}
            organisation={currentUser?.tenantName || currentUser?.tenant?.name}
            members={users}
            canInvite={canInviteUsers}
            onInvited={reloadUsers}
            onResendInvitation={handleResendInvitation}
            onResetTwoStep={handleResetMfa}
          />
        )}

        {/* TAB 4: AUDIT TRAIL */}
        {activeTab === 'audit' && (
          <AuditTrail
            entries={auditLogs}
            actionFilter={auditActionFilter}
            typeFilter={auditTypeFilter}
            onActionFilter={setAuditActionFilter}
            onTypeFilter={setAuditTypeFilter}
            exportHref={canExportAudit ? auditExportHref : null}
          />
        )}

      </div>

      {/* MODAL 1: CREATE DOCUMENT */}
      {showCreateModal && (
        <Dialog
          title="New controlled draft"
          error={errorMessage}
          submit="Create controlled draft"
          onSubmit={handleCreateDocument}
          onCancel={() => setShowCreateModal(false)}
        >
          <FileField
            label={`Source file: ${DOCUMENT_FILE_TYPES_TEXT}`}
            accept={DOCUMENT_FILE_ACCEPT}
            onChange={handleDocFileSelect}
            hint={docFileName
              ? <>Attached: {docFileName} ({docFileSize}). SHA-256: <span style={{ fontFamily: 'var(--font-mono)', overflowWrap: 'anywhere' }}>{docFileHash || 'calculating…'}</span></>
              : 'A source file is required. Its immutable storage key, size and SHA-256 digest are recorded with the draft.'}
          />
          <SelectField label="Document type" value={newDocumentType} onChange={(e) => setNewDocumentType(e.target.value)}>
            <option value="SOP">Standard operating procedure</option>
            <option value="POLICY">Policy</option>
            <option value="WORK_INSTRUCTION">Work instruction</option>
            <option value="FORM">Form</option>
            <option value="OTHER">Other</option>
          </SelectField>
          <TextField
            label="Title"
            placeholder="e.g. Cleaning of the filling line"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            required
          />
          <TextAreaField
            label="Description"
            placeholder="Scope and purpose of the document"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
          />
          <FieldPair>
            <SelectField label="Classification" value={newClassification} onChange={(e) => setNewClassification(e.target.value)}>
              <option value="CONTROLLED">Controlled (SOPs, policies)</option>
              <option value="INTERNAL">Internal (internal guidance)</option>
              <option value="HIGHLY_RESTRICTED">Highly restricted (patents, board files)</option>
            </SelectField>
            <TextField
              label="Training departments"
              value={newRequiredRoles}
              onChange={(e) => setNewRequiredRoles(e.target.value)}
              placeholder="e.g. QA, Production (blank for none)"
            />
          </FieldPair>
        </Dialog>
      )}

      {/* MODAL 2: SIGN (review, approval, release, retirement, training) */}
      {signingMode && (signingMode === 'READ' ? signingTraining : selectedDoc) && (
        <SignatureDialog
          title={SIGNING_LABELS[signingMode].title}
          record={signingMode === 'READ' ? signingTraining?.title : `${selectedDoc?.documentNumber ?? 'No number'} ${selectedDoc?.title}`}
          version={`Revision ${signingMode === 'READ' ? signingTraining?.versionNumber : selectedDoc?.currentVersionNumber}`}
          meaning={SIGNING_LABELS[signingMode].meaning}
          consequence={SIGNING_CONSEQUENCE[signingMode]}
          reasonRequired={REASON_REQUIRED[signingMode]}
          reasonPlaceholder={REASON_REQUIRED[signingMode] ? 'Why is this document retired?' : undefined}
          reason={esignComment}
          onReasonChange={setEsignComment}
          password={signPassword}
          onPasswordChange={setSignPassword}
          error={errorMessage}
          busy={signing}
          submit={SIGNING_LABELS[signingMode].submit}
          onSubmit={handleSignDocument}
          onCancel={closeSigning}
        />
      )}

      </AppShell>
    );
  }
