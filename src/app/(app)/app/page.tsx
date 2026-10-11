'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../../page.module.css';
import { AppShell, useThemeMode } from '@/ui';
import type { NavGroup } from '@/ui';
import { documentActionsFor } from '@/lib/document-actions';
import { workspaceSections } from '@/lib/workspace-access';
import type { AuditChange, AuditDetail } from '@/lib/audit-review';
import { REASON_REQUIRED, SIGNING_LABELS, signingRequest, type SigningMode } from '@/lib/signing-request';
import Dashboard from './Dashboard';
import Documents from './Documents';
import Training from './Training';
import People from './People';
import AuditTrail from './AuditTrail';
import type { PanelAction } from '@/lib/document-panel';
import { resendInvitation, resetTwoStepVerification } from '@/lib/invitations-client';
import { prepareDocumentFile, sha256Hex } from '@/lib/document-file-upload';
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
  // Organisation role from the member list (/api/users).
  roleName?: string | null;
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

  // Document creation form state
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newClassification, setNewClassification] = useState('CONTROLLED');
  const [newDocumentType, setNewDocumentType] = useState('SOP');
  const [newRequiredRoles, setNewRequiredRoles] = useState('');
  const [newRequiresQuiz, setNewRequiresQuiz] = useState(false);
  const [newQuizQ1, setNewQuizQ1] = useState('What is the correct way to correct a handwritten error on a GxP document?');
  const [newQuizQ1Options, setNewQuizQ1Options] = useState([
    'Use white-out/correction fluid',
    'Draw a single line through it, write correction, then initial and date',
    'Scribble it out completely so it cannot be read'
  ]);
  const [newQuizQ1Correct, setNewQuizQ1Correct] = useState(1);

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

  const handleResendInvitation = async (userId: string) => {
    const result = await resendInvitation(userId);
    if (result.ok) setSuccessMessage('A new invitation link was sent.');
    else setErrorMessage(result.message);
    setTimeout(() => {
      setSuccessMessage(null);
      setErrorMessage(null);
    }, 5000);
  };

  // Lost phone: an administrator resets a member's two-step verification (DEC-080).
  const handleResetMfa = async (userId: string, name: string) => {
    const reason = window.prompt(`Reset two-step verification for ${name}? They set it up again at their next sign-in. Reason:`);
    if (!reason?.trim()) return;
    const result = await resetTwoStepVerification(userId, reason);
    if (result.ok) setSuccessMessage(`Two-step verification was reset for ${name}.`);
    else setErrorMessage(result.message);
    setTimeout(() => {
      setSuccessMessage(null);
      setErrorMessage(null);
    }, 5000);
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

  // Create Draft Revision for locked/effective document
  const handleUploadNewVersion = async (docId: string) => {
    const reason = window.prompt('Describe the reason for this revision:')?.trim();
    if (!reason) return;

    const file = await new Promise<File | null>((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.pdf,.doc,.docx,.txt,.png';
      input.onchange = () => resolve(input.files?.[0] || null);
      input.click();
    });
    if (!file) return;

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
      if (res.ok) {
        setSuccessMessage('A new draft revision was created; the effective version remains controlled.');
        fetchData();
      } else {
        setErrorMessage(data.error?.message || 'Failed to create document revision');
      }
      setTimeout(() => {
        setSuccessMessage(null);
        setErrorMessage(null);
      }, 4000);
    } catch (err: any) {
      setErrorMessage(err.message);
      setTimeout(() => setErrorMessage(null), 4000);
    }
  };

  const handleReplaceDraftFile = async (docId: string) => {
    const file = await new Promise<File | null>((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.pdf,.doc,.docx,.txt,.png';
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
      const quizQuestionsList = [
        {
          id: 'q1',
          text: newQuizQ1,
          options: newQuizQ1Options,
          correctAnswerIndex: newQuizQ1Correct
        }
      ];

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
          requiresQuiz: newRequiresQuiz,
          quizQuestions: newRequiresQuiz ? quizQuestionsList : null,
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
        setNewRequiresQuiz(false);
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
    }
  };

  const runDocumentAction = async (
    path: string,
    method: 'POST' | 'DELETE',
    body: Record<string, unknown>,
    success: string,
  ) => {
    try {
      const res = await fetch(path, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Document action failed');
      setSuccessMessage(success);
      await fetchData();
    } catch (error: any) {
      setErrorMessage(error.message);
    }
    setTimeout(() => {
      setSuccessMessage(null);
      setErrorMessage(null);
    }, 5000);
  };

  const handleSubmitForReview = async () => {
    if (!selectedDoc) return;
    const reviewerEmail = window.prompt('Reviewer email:')?.trim().toLowerCase();
    const approverEmail = window.prompt('Approver email (must be a different person):')?.trim().toLowerCase();
    const reviewer = users.find((user) => user.email.toLowerCase() === reviewerEmail);
    const approver = users.find((user) => user.email.toLowerCase() === approverEmail);
    if (!reviewer || !approver) {
      setErrorMessage('Choose existing active users by exact email address.');
      return;
    }
    await runDocumentAction(
      `/api/documents/${selectedDoc.id}/submit-review`,
      'POST',
      { reviewerId: reviewer.id, approverId: approver.id },
      'Draft submitted for assigned review.',
    );
  };

  const handleReturnDocument = async () => {
    if (!selectedDoc) return;
    const comment = window.prompt('Required return reason:')?.trim();
    if (!comment) return;
    await runDocumentAction(
      `/api/documents/${selectedDoc.id}/review`,
      'POST',
      { action: 'RETURN', comment },
      'Document returned to draft.',
    );
  };

  const handleWithdrawRevision = async () => {
    if (!selectedDoc) return;
    const reason = window.prompt('Required reason for withdrawing this revision (the effective version stays in force):')?.trim();
    if (!reason) return;
    await runDocumentAction(
      `/api/documents/${selectedDoc.id}/withdraw-revision`,
      'POST',
      { reason },
      'Revision withdrawn; the effective version remains in force.',
    );
  };

  const selectedDoc = documents.find((d) => d.id === selectedDocId);

  // The Documents tab offers only the actions documentPanelActions allows;
  // each one goes to the same handler or signing dialog as before.
  const handleDocumentAction = (action: PanelAction, doc: { id: string }) => {
    switch (action) {
      case 'REPLACE_FILE': return handleReplaceDraftFile(doc.id);
      case 'SUBMIT_REVIEW': return handleSubmitForReview();
      case 'SIGN_REVIEW': return setSigningMode('REVIEW');
      case 'RETURN': return handleReturnDocument();
      case 'SIGN_APPROVE': return setSigningMode('APPROVE');
      case 'SIGN_RELEASE': return setSigningMode('RELEASE');
      case 'START_REVISION': return handleUploadNewVersion(doc.id);
      case 'WITHDRAW_REVISION': return handleWithdrawRevision();
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
        {/* Global Notifications */}
        {successMessage && (
          <div className="glass" style={{ borderColor: 'var(--secondary)', color: '#34D399', padding: '16px', borderRadius: '8px', marginBottom: '24px', fontWeight: '500' }}>
            ✓ {successMessage}
          </div>
        )}
        {errorMessage && (
          <div className="glass" style={{ borderColor: 'var(--danger)', color: '#F87171', padding: '16px', borderRadius: '8px', marginBottom: '24px', fontWeight: '500' }}>
            ⚠ {errorMessage}
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
            onAction={handleDocumentAction}
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
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>Create New eQMS Document Draft</h3>
              <button style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer' }} onClick={() => setShowCreateModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreateDocument}>
              <div className={styles.modalBody}>
                {errorMessage && (
                  <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid #EF4444', color: '#F87171', padding: '10px 14px', borderRadius: '6px', fontSize: '13px', marginBottom: '16px' }}>
                    ⚠ {errorMessage}
                  </div>
                )}

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Attach Physical SOP File (.pdf, .docx, .doc, .txt)</label>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.txt,.png"
                    onChange={handleDocFileSelect}
                    className={styles.input}
                    style={{ padding: '8px' }}
                  />
                  {docFileName ? (
                    <div style={{ marginTop: '8px', padding: '10px 14px', background: 'rgba(16,185,129,0.08)', borderRadius: '6px', border: '1px solid rgba(16,185,129,0.2)', fontSize: '12px' }}>
                      <div style={{ fontWeight: '600', color: '#10B981' }}>📎 Attached: {docFileName} ({docFileSize})</div>
                      <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '11px', marginTop: '2px' }}>
                        SHA-256 Checksum: {docFileHash || 'Calculating integrity hash...'}
                      </div>
                    </div>
                  ) : (
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                      A source file is required. Its immutable storage key, size, and SHA-256 digest are recorded with the draft.
                    </span>
                  )}
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Document Type</label>
                  <select className={styles.select} value={newDocumentType} onChange={(e) => setNewDocumentType(e.target.value)}>
                    <option value="SOP">Standard Operating Procedure</option>
                    <option value="POLICY">Policy</option>
                    <option value="WORK_INSTRUCTION">Work Instruction</option>
                    <option value="FORM">Form</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Document Title</label>
                  <input 
                    className={styles.input}
                    type="text" 
                    placeholder="e.g. SOP-103: Equipment Calibration Procedure"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Description</label>
                  <textarea 
                    className={styles.textarea}
                    placeholder="Brief description of the document scope and intent..."
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className={styles.grid3} style={{ margin: 0, gap: '16px', marginBottom: '16px' }}>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label className={styles.formLabel}>Classification</label>
                    <select 
                      className={styles.select}
                      value={newClassification}
                      onChange={(e) => setNewClassification(e.target.value)}
                    >
                      <option value="CONTROLLED">CONTROLLED (SOPs, Policies)</option>
                      <option value="INTERNAL">INTERNAL (Internal guidance)</option>
                      <option value="HIGHLY_RESTRICTED">HIGHLY RESTRICTED (Patents, Board files)</option>
                    </select>
                  </div>
                  <div>
                    <label className={styles.formLabel}>Training departments</label>
                    <input
                      className={styles.input}
                      value={newRequiredRoles}
                      onChange={(e) => setNewRequiredRoles(e.target.value)}
                      placeholder="e.g. QA, Production (blank for none)"
                    />
                  </div>
                </div>

                <div className={styles.formGroup} style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: '600' }}>
                    <input 
                      type="checkbox"
                      checked={newRequiresQuiz}
                      onChange={(e) => setNewRequiresQuiz(e.target.checked)}
                    />
                    Enable Quiz Verification for Training Complete
                  </label>
                  
                  {newRequiresQuiz && (
                    <div style={{ marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '12px' }}>
                      <label className={styles.formLabel}>Quiz Question 1</label>
                      <input 
                        className={styles.input}
                        type="text" 
                        value={newQuizQ1}
                        onChange={(e) => setNewQuizQ1(e.target.value)}
                        style={{ marginBottom: '8px' }}
                      />
                      
                      <label className={styles.formLabel}>Options</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {newQuizQ1Options.map((opt, idx) => (
                          <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <input 
                              type="radio" 
                              name="correctAnswer" 
                              checked={newQuizQ1Correct === idx}
                              onChange={() => setNewQuizQ1Correct(idx)}
                            />
                            <input 
                              className={styles.input}
                              type="text" 
                              value={opt}
                              onChange={(e) => {
                                const newOpts = [...newQuizQ1Options];
                                newOpts[idx] = e.target.value;
                                setNewQuizQ1Options(newOpts);
                              }}
                              style={{ padding: '6px 10px', fontSize: '13px' }}
                            />
                          </div>
                        ))}
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '6px' }}>
                        Select the radio button next to the correct answer.
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
                  Create Controlled Draft
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: SIGN REVIEW OR APPROVAL */}
      {signingMode && (signingMode === 'READ' ? signingTraining : selectedDoc) && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent} style={{ maxWidth: '500px' }}>
            <div className={styles.modalHeader}>
              <h3>{SIGNING_LABELS[signingMode].title}</h3>
              <button style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer' }} onClick={closeSigning}>×</button>
            </div>
            <form onSubmit={handleSignDocument}>
              <div className={styles.modalBody}>
                {errorMessage && (
                  <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid #EF4444', color: '#F87171', padding: '10px 14px', borderRadius: '6px', fontSize: '13px', marginBottom: '16px' }}>
                    ⚠ {errorMessage}
                  </div>
                )}
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  You are signing <strong style={{ color: '#fff' }}>{signingMode === 'READ' ? signingTraining?.title : selectedDoc?.title}</strong> (Version {signingMode === 'READ' ? signingTraining?.versionNumber : selectedDoc?.currentVersionNumber}.0) with the meaning <strong style={{ color: '#fff' }}>{SIGNING_LABELS[signingMode].meaning}</strong>. Your signature records your name, role, the time and the SHA-256 of this version&apos;s file.
                  {signingMode === 'APPROVE' && ' Approval does not make the document effective.'}
                  {signingMode === 'RELEASE' && ' Releasing makes this version effective now and supersedes the previously effective version.'}
                  {signingMode === 'RETIRE' && ' Retiring takes the document out of use; its versions and records are kept.'}
                  {signingMode === 'READ' && ' Your training on this version is then complete.'}
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>{REASON_REQUIRED[signingMode] ? 'Reason (required)' : 'Comments (Optional)'}</label>
                  <input
                    className={styles.input}
                    type="text"
                    placeholder={REASON_REQUIRED[signingMode] ? 'Why is this document retired?' : 'Remarks...'}
                    required={REASON_REQUIRED[signingMode]}
                    value={esignComment}
                    onChange={(e) => setEsignComment(e.target.value)}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Your password</label>
                  <input
                    className={styles.input}
                    type="password"
                    autoComplete="current-password"
                    required
                    value={signPassword}
                    onChange={(e) => setSignPassword(e.target.value)}
                  />
                </div>

              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={closeSigning}>
                  Cancel
                </button>
                <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} style={{ background: 'var(--warning)', color: '#000' }}>
                  {SIGNING_LABELS[signingMode].submit}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      </AppShell>
    );
  }
