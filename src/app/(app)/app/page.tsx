'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../../page.module.css';
import { AppShell, useThemeMode } from '@/ui';
import type { NavGroup } from '@/ui';
import { documentActionsFor } from '@/lib/document-actions';
import { workspaceSections } from '@/lib/workspace-access';
import { REASON_REQUIRED, SIGNING_LABELS, signingRequest, type SigningMode } from '@/lib/signing-request';
import InviteMemberPanel from '@/ui/components/InviteMemberPanel';
import { resendInvitation } from '@/lib/invitations-client';
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
  payload: string;
  status: string;
  sourceIp: string | null;
  requestUrl: string | null;
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
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);

  // Selected Detail views
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  // Forms / Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [signingMode, setSigningMode] = useState<SigningMode | null>(null);
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
    } catch (err) {
      console.error('Fetch data error:', err);
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
    setSignPassword('');
    setEsignComment('');
  };

  const handleSignDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDocId || !signingMode) return;
    const { path, method, body } = signingRequest(signingMode, selectedDocId, esignComment, signPassword);
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
        setSuccessMessage(signingMode === 'REVIEW'
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
  const {
    canAuthor: canAuthorDocuments,
    canReview: canReviewDocuments,
    canApprove: canApproveDocuments,
    canObsolete: canObsoleteDocuments,
    canRelease: canReleaseDocuments,
    canWithdrawRevision: canWithdrawRevisions,
  } = documentActionsFor(currentUser?.permissions);
  const canInviteUsers = Boolean(currentUser?.permissions?.includes('users.create'));
  const currentWorkflow = selectedDoc?.versions.find((version) => version.versionNumber === selectedDoc.currentVersionNumber)?.approvalRoutes?.[0];
  const assignedReviewStep = currentWorkflow?.steps.find((step) => step.stepType === 'REVIEW');
  const assignedApprovalStep = currentWorkflow?.steps.find((step) => step.stepType === 'APPROVAL');
  const isAssignedReviewer = canReviewDocuments && Boolean(assignedReviewStep && assignedReviewStep.approver.id === currentUser?.id && assignedReviewStep.status === 'PENDING');
  const isAssignedApprover = canApproveDocuments && Boolean(assignedApprovalStep && assignedApprovalStep.approver.id === currentUser?.id && assignedApprovalStep.status === 'PENDING');

  // Statistics calculation for Dashboard
  const statTotalDocs = documents.length;
  const statEffectiveDocs = documents.filter((d) => d.status === 'EFFECTIVE').length;
  const statPendingTrainings = trainings.filter((t) => t.status === 'ASSIGNED').length;
  const statPendingApprovals = documents.filter((d) => d.status === 'DRAFT' || d.status === 'IN_REVIEW').length;

  const { mode, toggleTheme } = useThemeMode();

  const sections = workspaceSections(currentUser?.permissions);
  const navGroups: NavGroup[] = [
    {
      title: 'Veritas eQMS',
      items: [
        { id: 'dashboard', label: 'Dashboard', route: 'dashboard', icon: <DashboardIcon /> },
        { id: 'documents', label: 'Document Control', route: 'documents', icon: <DescriptionIcon /> },
        { id: 'training', label: 'Training Hub', route: 'training', icon: <SchoolIcon /> },
        ...(sections.includes('users-management') ? [
          { id: 'users-management', label: 'User Access & ABAC/RBAC', route: 'users-management', icon: <SchoolIcon /> }
        ] : []),
        ...(sections.includes('audit') ? [
          { id: 'audit', label: 'Compliance Audit Logs', route: 'audit', icon: <HistoryIcon /> }
        ] : []),
      ]
    }
  ];

  const headerActions = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      {currentUser && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="glass" style={{ padding: '4px 10px', borderRadius: '16px', fontSize: '12px', color: 'var(--primary)', fontWeight: '600', border: '1px solid rgba(16,185,129,0.3)' }}>
            🏢 {currentUser.tenantName || 'Acme Biotech'}
          </span>

          <span style={{ fontSize: '12px', padding: '6px 12px' }}>
            👤 <strong>{currentUser.fullName}</strong>
          </span>

          <button
            className={`${styles.btn} ${styles.btnDanger}`}
            onClick={handleSignOut}
            style={{ fontSize: '12px', padding: '6px 12px' }}
          >
            🔒 Sign Out
          </button>
        </div>
      )}
    </div>
  );

  const getHeaderTitle = () => {
    switch (activeTab) {
      case 'dashboard': return 'Compliance Dashboard';
      case 'documents': return 'Document Repository';
      case 'training': return 'Training matrix & assignments';
      case 'users-management': return 'User Access Policy & ABAC/RBAC Roster';
      case 'audit': return 'Tenant Audit Event Index';
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
      footerText="v1.0.0 -- Veritas eQMS"
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

        {/* TAB 1: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div>
            {/* Recovery status & attention center */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px', marginBottom: '24px' }}>
              {/* Compliance scoring containment */}
              <div className={`${styles.card} ${styles.cardGlow}`} style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(15,23,42,0.6) 100%)', border: '1px solid rgba(16,185,129,0.25)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#10B981', fontWeight: '700' }}>🛡️ Compliance status</span>
                  <span style={{ fontSize: '11px', background: 'rgba(16,185,129,0.15)', color: '#10B981', padding: '2px 8px', borderRadius: '4px', fontWeight: '700' }}>
                    Unavailable
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <span style={{ fontSize: '18px', color: 'var(--text-muted)', lineHeight: '1.5' }}>Automated compliance scoring is disabled during recovery.</span>
                </div>

                <div style={{ fontSize: '13px', fontWeight: '600', color: '#E2E8F0', marginTop: '6px' }}>
                  No compliance or audit-readiness conclusion is generated.
                </div>

                <div style={{ marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                  Status metrics require an approved model, traceable source data, and validation evidence.
                </div>
              </div>

              {/* What Requires My Attention Today? */}
              <div className={styles.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div className={styles.cardTitle} style={{ margin: 0 }}>⚡ What Requires My Attention Today?</div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Sensitive exports unavailable during recovery</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', padding: '12px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '11px', color: '#F59E0B', fontWeight: '700', textTransform: 'uppercase' }}>Documents in Review</div>
                    <div style={{ fontSize: '24px', fontWeight: '800', color: '#FFF', marginTop: '4px' }}>{statPendingApprovals}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Awaiting Sign-off</div>
                  </div>

                  <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', padding: '12px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '11px', color: '#3B82F6', fontWeight: '700', textTransform: 'uppercase' }}>My Overdue Training</div>
                    <div style={{ fontSize: '24px', fontWeight: '800', color: '#FFF', marginTop: '4px' }}>{statPendingTrainings}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Pending Quiz Sign-off</div>
                  </div>

                  <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', padding: '12px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '11px', color: '#EF4444', fontWeight: '700', textTransform: 'uppercase' }}>Quality Events</div>
                    <div style={{ fontSize: '24px', fontWeight: '800', color: '#FFF', marginTop: '4px' }}>—</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Unavailable during recovery</div>
                  </div>

                </div>
              </div>
            </div>

            {/* Core Stats Bar */}
            <div className={styles.grid3}>
              <div className={`${styles.card} ${styles.cardGlow}`}>
                <div className={styles.cardTitle}>Total Controlled Documents</div>
                <div className={styles.statVal}>{statTotalDocs}</div>
                <div className={styles.statLabel}>{statEffectiveDocs} Effective, {statTotalDocs - statEffectiveDocs} Draft/Obsolete</div>
              </div>
              <div className={`${styles.card} ${styles.cardGlow}`} style={{ '--primary': 'var(--secondary)' } as any}>
                <div className={styles.cardTitle}>My Pending Assignments</div>
                <div className={styles.statVal} style={{ color: statPendingTrainings > 0 ? 'var(--warning)' : '#10B981' }}>{statPendingTrainings}</div>
                <div className={styles.statLabel}>Trainings required for role profiles</div>
              </div>
              <div className={`${styles.card} ${styles.cardGlow}`} style={{ '--primary': 'var(--warning)' } as any}>
                <div className={styles.cardTitle}>Documents in Review</div>
                <div className={styles.statVal}>{statPendingApprovals}</div>
                <div className={styles.statLabel}>Requires sign-off approval to release</div>
              </div>
            </div>

            <div className={styles.grid2} style={{ marginTop: '24px' }}>
              {/* Document Overview */}
              <div className={styles.card}>
                <div className={styles.cardTitle}>Released eQMS Documents</div>
                <div className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Owner</th>
                        <th>Classification</th>
                        <th>Release Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {documents.slice(0, 5).map((doc) => (
                        <tr key={doc.id} className={styles.tableRow}>
                          <td style={{ fontWeight: '600' }}>{doc.title}</td>
                          <td>{doc.owner.fullName}</td>
                          <td>{doc.classification}</td>
                          <td>
                            <span className={`${styles.badge} ${
                              doc.status === 'EFFECTIVE' ? styles.badgeEffective :
                              doc.status === 'DRAFT' ? styles.badgeDraft : styles.badgeReview
                            }`}>
                              {doc.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Authorization boundary notice */}
              <div className={styles.card}>
                <div className={styles.cardTitle}>Current Session</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <p>You are signed in as <strong>{currentUser?.fullName}</strong>.</p>
                  <div className="glass" style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', fontSize: '13px' }}>
                    Effective access is determined by the active IAM membership and persisted permission assignments on every server request. The operational role shown in profile data is descriptive and does not grant capabilities.
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Sign out or complete a new authenticated sign-in to change identity.</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: DOCUMENT CONTROL */}
        {activeTab === 'documents' && (
          <div className={styles.grid2}>
            {/* Document Listing */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2>eQMS Document Repository</h2>
                {canAuthorDocuments && (
                  <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setShowCreateModal(true)}>
                    + New Document Draft
                  </button>
                )}
              </div>

              <div className={styles.docGrid}>
                {documents.map((doc) => (
                  <div 
                    key={doc.id} 
                    className={`${styles.docItem} ${selectedDocId === doc.id ? 'glass' : ''}`}
                    onClick={() => setSelectedDocId(doc.id)}
                    style={{ cursor: 'pointer', borderColor: selectedDocId === doc.id ? 'var(--primary)' : 'rgba(255,255,255,0.06)' }}
                  >
                    <div className={styles.docLeft}>
                      <span className={styles.docTitle}>{doc.title}</span>
                      <div className={styles.docMeta}>
                        <span>{doc.documentNumber || 'LEGACY'}</span>
                        <span>{doc.documentType}</span>
                        <span>Owner: {doc.owner.fullName}</span>
                        <span>Ver: {doc.currentVersionNumber}.0</span>
                        <span>Scope: {doc.classification}</span>
                        {doc.versions.find((version) => version.versionNumber === doc.currentVersionNumber)?.effectiveDate && (
                          <span>Effective: {new Date(doc.versions.find((version) => version.versionNumber === doc.currentVersionNumber)!.effectiveDate!).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                    <div className={styles.docRight}>
                      <span className={`${styles.badge} ${
                        doc.status === 'EFFECTIVE' ? styles.badgeEffective :
                        doc.status === 'DRAFT' ? styles.badgeDraft : styles.badgeReview
                      }`}>
                        {doc.status.replaceAll('_', ' ')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Document Details & Actions */}
            <div>
              <h2>Document Metadata & Controls</h2>
              {selectedDoc ? (
                <div className={styles.card} style={{ marginTop: '16px' }}>
                  <div className={styles.cardTitle}>
                    <span>{selectedDoc.title}</span>
                    <span className={`${styles.badge} ${
                      selectedDoc.status === 'EFFECTIVE' ? styles.badgeEffective :
                      selectedDoc.status === 'DRAFT' ? styles.badgeDraft : styles.badgeReview
                    }`}>
                      {selectedDoc.status.replaceAll('_', ' ')}
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Description</span>
                      <p style={{ marginTop: '4px' }}>{selectedDoc.description || 'No description provided.'}</p>
                    </div>

                    <div className={styles.grid3} style={{ margin: 0, gap: '12px' }}>
                      <div>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Document Number</span>
                        <div style={{ fontWeight: '600' }}>{selectedDoc.documentNumber || 'LEGACY'}</div>
                      </div>
                      <div>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Type / Classification</span>
                        <div style={{ fontWeight: '600' }}>{selectedDoc.documentType} / {selectedDoc.classification}</div>
                      </div>
                      <div>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Current Version</span>
                        <div style={{ fontWeight: '600' }}>v{selectedDoc.currentVersionNumber}.0</div>
                      </div>
                    </div>

                    {selectedDoc.trainingRequirement && (
                      <div className="glass" style={{ padding: '12px', background: 'rgba(99, 102, 241, 0.03)', borderColor: 'rgba(99, 102, 241, 0.15)' }}>
                        <strong>Training Profile Required:</strong>
                        <div style={{ fontSize: '13px', marginTop: '4px' }}>
                          Departments: <span className={styles.currentBadge}>{selectedDoc.trainingRequirement.requiredForRoles}</span>
                          {selectedDoc.trainingRequirement.requiresQuiz && <span style={{ marginLeft: '12px', color: 'var(--secondary)' }}>✓ Quiz Configured</span>}
                        </div>
                      </div>
                    )}

                    {/* Immutable version history and workflow assignments */}
                    <div>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Version History & Workflow</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                        {selectedDoc.versions.map((ver) => (
                          <div key={ver.id} className="glass" style={{ padding: '12px', fontSize: '13px', background: 'rgba(0,0,0,0.1)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '600' }}>
                              <span>Version {ver.versionNumber}.0 · {ver.status.replaceAll('_', ' ')}</span>
                              <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{new Date(ver.createdAt).toLocaleDateString()}</span>
                            </div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>
                              Integrity Hash: <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px' }}>{ver.hash.substring(0, 16)}...</span>
                            </div>
                            {ver.effectiveDate && <div style={{ fontSize: '11px' }}>Effective: {new Date(ver.effectiveDate).toLocaleString()}</div>}
                            {ver.changeSummary && <div style={{ fontSize: '11px' }}>Change: {ver.changeSummary}</div>}
                            {ver.approvalRoutes?.[0]?.steps?.map((step) => (
                              <div key={step.id} style={{ fontSize: '11px', marginTop: '4px' }}>
                                {step.stepType}: {step.approver.fullName} — {step.status}
                              </div>
                            ))}
                            <a href={`/api/documents/${selectedDoc.id}/pdf?version=${ver.versionNumber}`} target="_blank" rel="noreferrer" style={{ fontSize: '11px' }}>
                              {ver.status === 'EFFECTIVE' ? 'View effective version' : 'View (marked uncontrolled copy)'}
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '8px' }}>
                      {selectedDoc.status === 'DRAFT' && canAuthorDocuments && (
                        <>
                          <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => handleReplaceDraftFile(selectedDoc.id)}>Replace Draft File</button>
                          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSubmitForReview}>Submit for Review</button>
                        </>
                      )}
                      {selectedDoc.status === 'IN_REVIEW' && isAssignedReviewer && (
                        <>
                          <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setSigningMode('REVIEW')}>Sign Assigned Review</button>
                          <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={handleReturnDocument}>Return for Changes</button>
                        </>
                      )}
                      {selectedDoc.status === 'IN_REVIEW' && isAssignedApprover && assignedReviewStep?.status === 'COMPLETED' && (
                        <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setSigningMode('APPROVE')}>Sign Assigned Approval</button>
                      )}
                      {canWithdrawRevisions && ['DRAFT', 'IN_REVIEW', 'APPROVED'].includes(selectedDoc.status)
                        && selectedDoc.versions.some((version) => version.status === 'EFFECTIVE') && (
                        <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={handleWithdrawRevision}>Withdraw Revision</button>
                      )}
                      {selectedDoc.status === 'APPROVED' && canReleaseDocuments && (
                        <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setSigningMode('RELEASE')}>Sign Release (Make Effective)</button>
                      )}
                      {canObsoleteDocuments && ['DRAFT', 'APPROVED', 'EFFECTIVE'].includes(selectedDoc.status) && (
                        <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setSigningMode('RETIRE')}>Sign Retirement (Obsolete)</button>
                      )}
                      <a href={`/api/documents/${selectedDoc.id}/pdf`} target="_blank" rel="noreferrer" className={`${styles.btn} ${styles.btnSecondary}`}>
                        {selectedDoc.versions.some((version) => version.status === 'EFFECTIVE') ? 'View Effective Version' : 'View Current Version (Uncontrolled)'}
                      </a>
                    </div>

                    {selectedDoc.status === 'EFFECTIVE' && canAuthorDocuments && (
                      <div className="glass" style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.02)', marginTop: '12px', borderStyle: 'dashed' }}>
                        <h4 style={{ marginBottom: '8px', color: 'var(--primary)' }}>Controlled Revision</h4>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                          Create a new draft with a required reason and replacement source file. The effective version remains immutable and available until the new revision completes the lifecycle.
                        </p>
                        <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => handleUploadNewVersion(selectedDoc.id)}>
                          Create Draft Revision v{selectedDoc.currentVersionNumber + 1}.0
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="glass" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', marginTop: '16px' }}>
                  Select a document to view its controlled metadata, retained version history, assignments, and permitted lifecycle actions.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: TRAINING HUB */}
        {activeTab === 'training' && (
          <div className={styles.grid2}>
            {/* User assignments */}
            <div>
              <h2>My Required Training Assignments</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
                {trainings.filter(t => t && t.userId && currentUser?.id && t.userId === currentUser.id).length > 0 ? (
                  trainings.filter(t => t && t.userId && currentUser?.id && t.userId === currentUser.id).map((tr) => (
                    <div 
                      key={tr.id} 
                      className={styles.card}
                      style={{ borderColor: tr.status === 'ASSIGNED' ? 'var(--warning)' : 'var(--secondary)' }}
                    >
                      <div className={styles.cardTitle}>
                        <span>{tr.requirement?.document?.title || 'Controlled SOP Training'}</span>
                        <span className={`${styles.badge} ${tr.status === 'COMPLETED' ? styles.badgeEffective : styles.badgeReview}`}>
                          {tr.status}
                        </span>
                      </div>
                      <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                        {tr.requirement?.document?.description || 'Mandatory training for 21 CFR Part 11 / ISO 13485 compliance.'}
                      </p>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          Assigned: {tr.assignedAt ? new Date(tr.assignedAt).toLocaleDateString() : 'N/A'}
                          {tr.completedAt && ` | Completed: ${new Date(tr.completedAt).toLocaleDateString()}`}
                        </span>
                        
                        {tr.status === 'ASSIGNED' ? (
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            Quiz and sign-off unavailable during recovery
                          </span>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10B981', fontWeight: '600', fontSize: '13px' }}>
                            {tr.quizResult ? `Recorded quiz result (${tr.quizResult.score}%)` : 'Completion previously recorded'}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="glass" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No pending training assignments required for your profile context.
                  </div>
                )}
              </div>
            </div>

            {/* Complete Training Matrix for managers */}
            <div>
              <h2>eQMS Training Compliance Matrix</h2>
              <div className={styles.card} style={{ marginTop: '16px' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  Tenant assignment status view. Completeness and regulatory suitability have not been independently validated.
                </div>

                <div className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Role</th>
                        <th>Required SOP</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trainings && trainings.length > 0 ? (
                        trainings.map((tr) => (
                          <tr key={tr.id} className={styles.tableRow}>
                            <td style={{ fontWeight: '600' }}>{tr.user?.fullName || 'Tenant User'}</td>
                            <td><span className={styles.currentBadge}>{tr.user?.role || 'EMPLOYEE'}</span></td>
                            <td>{(tr.requirement?.document?.title || 'SOP-001').split(':')[0]}</td>
                            <td>
                              <span className={`${styles.badge} ${
                                tr.status === 'COMPLETED' ? styles.badgeEffective : styles.badgeReview
                              }`}>
                                {tr.status || 'ASSIGNED'}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                            No active training records in matrix.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: USER ROLES & RBAC/ABAC MANAGEMENT */}
        {activeTab === 'users-management' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2>Organization User Roster</h2>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Read-only recovery view. IAM-bound provisioning, role changes, and deactivation are temporarily unavailable.
                </p>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>User administration disabled</span>
            </div>

            {/* Segregation of Duties (SoD) Compliance Guard Banner */}
            <div className="glass" style={{ padding: '16px 20px', borderRadius: '12px', background: 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(15,23,42,0.6) 100%)', border: '1px solid rgba(16,185,129,0.25)', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px' }}>🛡️</span>
                <div>
                  <div style={{ fontWeight: '700', color: '#10B981', fontSize: '14px' }}>Segregation of Duties recovery status</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Some workflow restrictions are implemented, but the complete policy set has not been independently validated. Do not rely on this interface as evidence of Annex 11 or Part 11 compliance.
                  </div>
                </div>
              </div>
            </div>

            {/* User Organization Roster */}
            <div className={styles.card} style={{ marginBottom: '28px' }}>
              <div className={styles.cardTitle}>Active Organization Roster ({users.length} Users)</div>
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Employee Name</th>
                      <th>Work Email</th>
                      <th>Site / Facility</th>
                      <th>Employment</th>
                      <th>Assigned GxP Role</th>
                      <th>Department</th>
                      <th>Clearance</th>
                      <th>Sign-in</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u: any) => (
                      <tr key={u.id} className={styles.tableRow}>
                        <td style={{ fontWeight: '600' }}>
                          {u.fullName} {u.id === currentUser?.id && <span style={{ fontSize: '10px', background: 'rgba(16,185,129,0.2)', color: '#10B981', padding: '2px 6px', borderRadius: '4px', marginLeft: '6px' }}>YOU</span>}
                        </td>
                        <td>{u.email}</td>
                        <td><span className={styles.badge}>{u.site || 'Main Facility'}</span></td>
                        <td><span className={styles.currentBadge} style={{ background: 'rgba(255,255,255,0.06)' }}>{u.employmentType || 'EMPLOYEE'}</span></td>
                        <td>
                          <span className={styles.currentBadge} style={{
                            background: u.role === 'OWNER' ? 'rgba(168,85,247,0.15)' : u.role === 'ADMIN' ? 'rgba(239,68,68,0.15)' : u.role === 'APPROVER' ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.15)',
                            color: u.role === 'OWNER' ? '#A855F7' : u.role === 'ADMIN' ? '#EF4444' : u.role === 'APPROVER' ? '#F59E0B' : '#3B82F6',
                          }}>
                            {u.role}
                          </span>
                        </td>
                        <td><span className={styles.badge}>{u.department}</span></td>
                        <td><span className={styles.badge}>{u.clearance || 'INTERNAL'}</span></td>
                        <td>
                          {u.invitationPending ? (
                            <>
                              <span className={styles.badge}>Invitation pending</span>
                              {canInviteUsers && (
                                <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} style={{ marginLeft: '8px', padding: '4px 10px', fontSize: '12px' }} onClick={() => handleResendInvitation(u.id)}>Resend</button>
                              )}
                            </>
                          ) : (
                            <span className={styles.badge}>Active</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {canInviteUsers && <InviteMemberPanel onInvited={reloadUsers} />}

            {/* Canonical permission presentation containment */}
            <div className={styles.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div className={styles.cardTitle} style={{ margin: 0 }}>Role & Permission Registry</div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Unavailable during recovery</span>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
                Effective access is enforced from persisted IAM role assignments. The policy matrix is hidden until role ownership, tenant visibility, and authorized administration are implemented and validated.
              </p>
            </div>
          </div>
        )}

        {/* TAB 4: COMPLIANCE LOGS */}
        {activeTab === 'audit' && (
          <div className={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2>Tenant Audit Event Index</h2>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  A bounded operational event view. Append-only storage, completeness, retention, and regulatory validation are not yet evidenced.
                </p>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>CSV export disabled</span>
            </div>

            {/* Filter controls */}
            <div className={styles.filters}>
              <div className={styles.filterItem}>
                <label className={styles.formLabel}>Action Event</label>
                <select 
                  className={styles.select}
                  value={auditActionFilter}
                  onChange={(e) => setAuditActionFilter(e.target.value)}
                >
                  <option value="">All Actions</option>
                  <option value="Document.Create">Document.Create</option>
                  <option value="Document.View">Document.View</option>
                  <option value="Document.Approve">Document.Approve</option>
                  <option value="Training.Complete">Training.Complete</option>
                  <option value="AuditTrail.Query">AuditTrail.Query</option>
                </select>
              </div>
              
              <div className={styles.filterItem}>
                <label className={styles.formLabel}>Resource Type</label>
                <select 
                  className={styles.select}
                  value={auditTypeFilter}
                  onChange={(e) => setAuditTypeFilter(e.target.value)}
                >
                  <option value="">All Types</option>
                  <option value="Document">Document</option>
                  <option value="TrainingAssignment">TrainingAssignment</option>
                  <option value="AuditLog">AuditLog</option>
                </select>
              </div>
            </div>

            {/* Audit Logs Trail */}
            <div className={styles.auditQueryArea}>
              {auditLogs.length > 0 ? (
                auditLogs.map((log) => (
                  <div 
                    key={log.id} 
                    className={`${styles.auditItem} ${log.status !== 'Success' ? styles.auditItemDenied : ''}`}
                  >
                    <div className={styles.auditHeader}>
                      <div>
                        <span className={styles.currentBadge} style={{ marginLeft: '8px', fontSize: '10px' }}>{log.userRole}</span>
                        <span style={{ marginLeft: '12px' }}>executed</span>
                        <span className={styles.auditAction} style={{ marginLeft: '8px' }}>{log.action}</span>
                      </div>
                      <span className={styles.auditTime}>{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                    
                    <div style={{ color: log.status === 'Success' ? '#10B981' : '#F87171', fontWeight: '600', fontSize: '11px', marginTop: '4px' }}>
                      STATUS: {log.status} | EVENT_ID: {log.eventId}
                    </div>
                  </div>
                ))
              ) : (
                <div className="glass" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No audit logs match current query filters.
                </div>
              )}
            </div>
          </div>
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
      {signingMode && selectedDoc && (
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
                  You are signing <strong style={{ color: '#fff' }}>{selectedDoc.title}</strong> (Version {selectedDoc.currentVersionNumber}.0) with the meaning <strong style={{ color: '#fff' }}>{SIGNING_LABELS[signingMode].meaning}</strong>. Your signature records your name, role, the time and the SHA-256 of this version&apos;s file.
                  {signingMode === 'APPROVE' && ' Approval does not make the document effective.'}
                  {signingMode === 'RELEASE' && ' Releasing makes this version effective now and supersedes the previously effective version.'}
                  {signingMode === 'RETIRE' && ' Retiring takes the document out of use; its versions and records are kept.'}
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
