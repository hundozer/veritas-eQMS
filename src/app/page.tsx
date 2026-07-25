'use client';

import { useState, useEffect, useCallback } from 'react';
import styles from './page.module.css';
import { AppShell, useThemeMode } from '@/ui';
import type { NavGroup } from '@/ui';
import dynamic from 'next/dynamic';

const DashboardAnalytics = dynamic(() => import('@/components/DashboardAnalytics'), { ssr: false });
import {
  Dashboard as DashboardIcon,
  Description as DescriptionIcon,
  School as SchoolIcon,
  PublishedWithChanges as ChangeIcon,
  Report as ReportIcon,
  History as HistoryIcon,
  Build as BuildIcon
} from '@mui/icons-material';

interface User {
  id: string;
  email: string;
  fullName: string;
  role: string;
  department: string;
  clearance: string;
  tenantId: string;
}

interface DocumentVersion {
  id: string;
  versionNumber: number;
  filePath: string;
  hash: string;
  createdAt: string;
  createdBy: string;
  signatureManifest?: {
    id: string;
    signedAt: string;
    meaning: string;
    ipAddress: string;
    signer: { fullName: string; role: string };
  } | null;
}

interface Document {
  id: string;
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
    quizQuestions: string | null;
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

interface ChangeRequest {
  id: string;
  title: string;
  reason: string;
  riskLevel: string;
  status: string;
  createdAt: string;
  documents: {
    documentId: string;
    document: Document;
  }[];
}

interface Deviation {
  id: string;
  title: string;
  description: string;
  classification: string;
  status: string;
  detectedById: string;
  detectedBy: User;
  investigatorId: string | null;
  investigator: User | null;
  investigationNotes: string | null;
  createdAt: string;
  capas: CAPA[];
}

interface CAPA {
  id: string;
  title: string;
  actionPlan: string;
  status: string;
  dueDate: string;
  completedAt: string | null;
  assignedToId: string;
  assignedTo: User;
  deviationId: string | null;
  deviation: Deviation | null;
  createdAt: string;
}

interface MaintenanceLog {
  id: string;
  equipmentId: string;
  performedById: string;
  performedBy: User;
  performedAt: string;
  activityType: string;
  notes: string;
  result: string;
  esignSignatureId: string | null;
  createdAt: string;
}

interface Equipment {
  id: string;
  name: string;
  description: string | null;
  modelNumber: string | null;
  serialNumber: string | null;
  location: string;
  status: string;
  calibrationIntervalDays: number;
  lastCalibratedAt: string;
  nextCalibrationDueDate: string;
  createdAt: string;
  maintenanceLogs: MaintenanceLog[];
  deviations: Deviation[];
}

interface QuizQuestion {
  id: string;
  text: string;
  options: string[];
  correctAnswerIndex: number;
}

interface QuizAnswer {
  questionId: string;
  answerIndex: number;
}

export default function Home() {
  // Navigation
  const [activeTab, setActiveTab] = useState<'dashboard' | 'documents' | 'training' | 'audit' | 'change-control' | 'quality-events' | 'equipment'>('dashboard');

  // Users / Personas
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // App Data
  const [documents, setDocuments] = useState<Document[]>([]);
  const [trainings, setTrainings] = useState<TrainingAssignment[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [deviations, setDeviations] = useState<Deviation[]>([]);
  const [capas, setCapas] = useState<CAPA[]>([]);
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);

  // Selected Detail views
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [selectedTrainingId, setSelectedTrainingId] = useState<string | null>(null);
  const [selectedCRId, setSelectedCRId] = useState<string | null>(null);
  const [selectedDeviationId, setSelectedDeviationId] = useState<string | null>(null);
  const [selectedCapaId, setSelectedCapaId] = useState<string | null>(null);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | null>(null);

  // Forms / Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showTrainingModal, setShowTrainingModal] = useState(false);
  const [showCreateCRModal, setShowCreateCRModal] = useState(false);
  const [showCRSignModal, setShowCRSignModal] = useState(false);
  const [showCreateDeviationModal, setShowCreateDeviationModal] = useState(false);
  const [showCreateCapaModal, setShowCreateCapaModal] = useState(false);
  const [showCapaSignModal, setShowCapaSignModal] = useState(false);
  const [showDeviationInvestigateModal, setShowDeviationInvestigateModal] = useState(false);
  const [showLogMaintenanceModal, setShowLogMaintenanceModal] = useState(false);

  // Deviation form state
  const [newDevTitle, setNewDevTitle] = useState('');
  const [newDevDescription, setNewDevDescription] = useState('');
  const [newDevClassification, setNewDevClassification] = useState('MINOR');

  // CAPA form state
  const [newCapaTitle, setNewCapaTitle] = useState('');
  const [newCapaActionPlan, setNewCapaActionPlan] = useState('');
  const [newCapaDueDate, setNewCapaDueDate] = useState('');
  const [newCapaAssignedToId, setNewCapaAssignedToId] = useState('');
  const [newCapaDeviationId, setNewCapaDeviationId] = useState<string | null>(null);

  // Deviation investigation form state
  const [investigationNotes, setInvestigationNotes] = useState('');
  const [investigationStatus, setInvestigationStatus] = useState('UNDER_INVESTIGATION');
  const [investigationInvestigatorId, setInvestigationInvestigatorId] = useState('');

  // CAPA sign-off state
  const [esignCapaPassword, setEsignCapaPassword] = useState('');

  // Change Control form state
  const [newCRTitle, setNewCRTitle] = useState('');
  const [newCRReason, setNewCRReason] = useState('');
  const [newCRRiskLevel, setNewCRRiskLevel] = useState('MEDIUM');
  const [newCRDocIds, setNewCRDocIds] = useState<string[]>([]);

  // Change Control E-Sign sign-off state
  const [esignCRPassword, setEsignCRPassword] = useState('');
  const [esignCRAction, setEsignCRAction] = useState<'APPROVE' | 'CLOSE'>('APPROVE');
  const [esignCRComment, setEsignCRComment] = useState('');

  // Document creation form state
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newClassification, setNewClassification] = useState('CONTROLLED');
  const [newRequiredRoles, setNewRequiredRoles] = useState('EMPLOYEE');
  const [newRequiresQuiz, setNewRequiresQuiz] = useState(false);
  const [newQuizQ1, setNewQuizQ1] = useState('What is the correct way to correct a handwritten error on a GxP document?');
  const [newQuizQ1Options, setNewQuizQ1Options] = useState([
    'Use white-out/correction fluid',
    'Draw a single line through it, write correction, then initial and date',
    'Scribble it out completely so it cannot be read'
  ]);
  const [newQuizQ1Correct, setNewQuizQ1Correct] = useState(1);

  // Approval form state
  const [esignPassword, setEsignPassword] = useState('');
  const [esignMeaning, setEsignMeaning] = useState('Approval of Document Release');
  const [esignComment, setEsignComment] = useState('');

  // Quiz submission state
  const [quizAnswers, setQuizAnswers] = useState<{ [questionId: string]: number }>({});
  const [esignTrainingPassword, setEsignTrainingPassword] = useState('');
  const [quizError, setQuizError] = useState<string | null>(null);

  // Audit Filters
  const [auditActionFilter, setAuditActionFilter] = useState('');
  const [auditTypeFilter, setAuditTypeFilter] = useState('');

  // Equipment Maintenance form state
  const [eqLogActivityType, setEqLogActivityType] = useState('CALIBRATION');
  const [eqLogNotes, setEqLogNotes] = useState('');
  const [eqLogResult, setEqLogResult] = useState('PASS');
  const [eqLogPassword, setEqLogPassword] = useState('');

  // General Notification / Error messages
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load tenant users on start
  useEffect(() => {
    fetch('/api/users')
      .then((res) => res.json())
      .then((data) => {
        if (data.users) {
          setUsers(data.users);
          // Set default user as owner@acme.com if no cookie is set
          const match = document.cookie.match(/user-email=([^;]+)/);
          const email = match ? decodeURIComponent(match[1]) : 'owner@acme.com';
          const defaultUser = data.users.find((u: User) => u.email === email) || data.users[0];
          if (defaultUser) {
            setCurrentUser(defaultUser);
            // Save to cookie to make it sticky in api requests
            document.cookie = `user-email=${defaultUser.email}; path=/; max-age=86400`;
          }
        }
      })
      .catch((err) => console.error('Failed to load users:', err));
  }, []);

  // Fetch all dashboard data when user switches
  const fetchData = useCallback(async () => {
    if (!currentUser) return;

    try {
      // Fetch Documents
      const docRes = await fetch('/api/documents', {
        headers: { 'x-user-email': currentUser.email },
      });
      const docData = await docRes.json();
      if (docData.documents) setDocuments(docData.documents);

      // Fetch Trainings
      const trRes = await fetch('/api/trainings', {
        headers: { 'x-user-email': currentUser.email },
      });
      const trData = await trRes.json();
      if (trData.assignments) setTrainings(trData.assignments);

      // Fetch Audit logs (if compliance role)
      if (currentUser.role === 'ADMIN' || currentUser.role === 'AUDITOR') {
        const auditQuery = new URLSearchParams();
        if (auditActionFilter) auditQuery.append('action', auditActionFilter);
        if (auditTypeFilter) auditQuery.append('objectType', auditTypeFilter);

        const audRes = await fetch(`/api/audit?${auditQuery.toString()}`, {
          headers: { 'x-user-email': currentUser.email },
        });
        const audData = await audRes.json();
        if (audData.logs) setAuditLogs(audData.logs);
      }

      // Fetch Change Requests
      const crRes = await fetch('/api/change-requests', {
        headers: { 'x-user-email': currentUser.email },
      });
      const crData = await crRes.json();
      if (crData.changeRequests) setChangeRequests(crData.changeRequests);

      // Fetch Deviations
      const devRes = await fetch('/api/deviations', {
        headers: { 'x-user-email': currentUser.email },
      });
      const devData = await devRes.json();
      if (devData.deviations) setDeviations(devData.deviations);

      // Fetch CAPAs
      const capaRes = await fetch('/api/capas', {
        headers: { 'x-user-email': currentUser.email },
      });
      const capaData = await capaRes.json();
      if (capaData.capas) setCapas(capaData.capas);

      // Fetch Equipment
      const eqRes = await fetch('/api/equipment', {
        headers: { 'x-user-email': currentUser.email },
      });
      const eqData = await eqRes.json();
      if (eqData.equipment) setEquipmentList(eqData.equipment);
    } catch (err) {
      console.error('Fetch data error:', err);
    }
  }, [currentUser, auditActionFilter, auditTypeFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Log new Deviation
  const handleCreateDeviation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDevTitle.trim() || !newDevDescription.trim()) return;

    try {
      const res = await fetch('/api/deviations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': currentUser?.email || '',
        },
        body: JSON.stringify({
          title: newDevTitle,
          description: newDevDescription,
          classification: newDevClassification,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMessage('Deviation logged successfully!');
        setShowCreateDeviationModal(false);
        setNewDevTitle('');
        setNewDevDescription('');
        fetchData();
      } else {
        setErrorMessage(data.error?.message || 'Failed to log deviation');
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

  // Perform root cause investigation
  const handleDeviationInvestigate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeviationId || !investigationNotes.trim()) return;

    try {
      const res = await fetch(`/api/deviations/${selectedDeviationId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': currentUser?.email || '',
        },
        body: JSON.stringify({
          investigatorId: investigationInvestigatorId || undefined,
          investigationNotes,
          status: investigationStatus,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMessage('Investigation details updated!');
        setShowDeviationInvestigateModal(false);
        fetchData();
      } else {
        setErrorMessage(data.error?.message || 'Failed to update investigation');
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

  // Create new CAPA
  const handleCreateCapa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCapaTitle.trim() || !newCapaActionPlan.trim() || !newCapaDueDate || !newCapaAssignedToId) return;

    try {
      const res = await fetch('/api/capas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': currentUser?.email || '',
        },
        body: JSON.stringify({
          title: newCapaTitle,
          actionPlan: newCapaActionPlan,
          dueDate: newCapaDueDate,
          assignedToId: newCapaAssignedToId,
          deviationId: newCapaDeviationId,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMessage('CAPA successfully logged and assigned!');
        setShowCreateCapaModal(false);
        setNewCapaTitle('');
        setNewCapaActionPlan('');
        setNewCapaDueDate('');
        setNewCapaAssignedToId('');
        setNewCapaDeviationId(null);
        fetchData();
      } else {
        setErrorMessage(data.error?.message || 'Failed to create CAPA');
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

  // E-Sign and Close CAPA
  const handleCapaSignOff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCapaId || !esignCapaPassword) return;

    try {
      const res = await fetch(`/api/capas/${selectedCapaId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': currentUser?.email || '',
        },
        body: JSON.stringify({
          status: 'CLOSED',
          password: esignCapaPassword,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMessage('CAPA closed and verified via electronic signature!');
        setShowCapaSignModal(false);
        setEsignCapaPassword('');
        fetchData();
      } else {
        setErrorMessage(data.error?.message || 'E-Sign validation failed');
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

  // Create Change Request
  const handleCreateCR = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCRTitle.trim() || !newCRReason.trim() || newCRDocIds.length === 0) return;

    try {
      const res = await fetch('/api/change-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': currentUser?.email || '',
        },
        body: JSON.stringify({
          title: newCRTitle,
          reason: newCRReason,
          riskLevel: newCRRiskLevel,
          documentIds: newCRDocIds,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMessage('Change Request submitted under QA review!');
        setShowCreateCRModal(false);
        setNewCRTitle('');
        setNewCRReason('');
        setNewCRDocIds([]);
        fetchData();
      } else {
        setErrorMessage(data.error?.message || 'Failed to submit Change Request');
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

  // E-Sign Change Request Approval or Closure
  const handleCRSignOff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCRId || !esignCRPassword) return;

    try {
      const res = await fetch(`/api/change-requests/${selectedCRId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': currentUser?.email || '',
        },
        body: JSON.stringify({
          password: esignCRPassword,
          actionType: esignCRAction,
          comment: esignCRComment,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMessage(`Change Request successfully ${esignCRAction === 'APPROVE' ? 'Approved' : 'Closed'}!`);
        setShowCRSignModal(false);
        setEsignCRPassword('');
        setEsignCRComment('');
        fetchData();
      } else {
        setErrorMessage(data.error?.message || 'Verification failed');
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

  // Create Draft Revision for locked/effective document
  const handleUploadNewVersion = async (docId: string) => {
    try {
      const res = await fetch(`/api/documents/${docId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': currentUser?.email || '',
        },
        body: JSON.stringify({
          // Send mock PDF base64 indicating version update
          contentBase64: 'JVBERi0xLjQKJcfsj6IKMSAwIG9iagogIDw8L1R5cGUvQ2F0YWxvZy9QYWdlcyAyIDAgUj4+CmVuZG9iagoyIDAgb2JqCiAgPDwvVHlwZS9QYWdlcy9LaWRzWzMgMCBSXS9Db3VudCAxPj4KZW5kb2JqCjMgMCBvYmoKICA8PC9UeXBlL1BhZ2UvUGFyZW50IDIgMCBSL01lZGlhQm94WzAgMCA1OTUgODQyXS9Db250ZW50cyA0IDAgUj4+CmVuZG9iago0IDAgb2JqCiAgPDwvTGVuZ3RoIDU5Pj5zdHJlYW0KQlQKICAvRjEgMjQgVGYKICA3MCA3MDAgVGQKICAoVmVyaXRhcyBlUU1TIC0gR3hQIFJldmlzaW9uKSBUagogRVQKZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgNQowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMTkgMDAwMDAgbiAKMDAwMDAwMDA3MCAwMDAwMCBuIAowMDAwMDAwMTI3IDAwMDAwIGYgCjAwMDAwMDAyMDkgMDAwMDAgbiAKdHJhaWxlcgowMDAwMDAwMjg4Cg==',
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMessage('Successfully drafted new version! Status reset to DRAFT.');
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

  // Switch persona
  const handleUserChange = (email: string) => {
    const selected = users.find((u) => u.email === email);
    if (selected) {
      setCurrentUser(selected);
      document.cookie = `user-email=${selected.email}; path=/; max-age=86400`;
      setSelectedDocId(null);
      setSelectedTrainingId(null);
      setSuccessMessage(`Switched active user context to ${selected.fullName} (${selected.role})`);
      setTimeout(() => setSuccessMessage(null), 3000);
    }
  };

  // Create Document
  const handleCreateDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      const quizQuestionsList = [
        {
          id: 'q1',
          text: newQuizQ1,
          options: newQuizQ1Options,
          correctAnswerIndex: newQuizQ1Correct
        }
      ];

      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': currentUser?.email || '',
        },
        body: JSON.stringify({
          title: newTitle,
          description: newDesc,
          classification: newClassification,
          requiredRoles: newRequiredRoles,
          requiresQuiz: newRequiresQuiz,
          quizQuestions: newRequiresQuiz ? quizQuestionsList : null,
          contentBase64: 'JVBERi0xLjQKJcfsj6IKMSAwIG9iagogIDw8L1R5cGUvQ2F0YWxvZy9QYWdlcyAyIDAgUj4+CmVuZG9iagoyIDAgb2JqCiAgPDwvVHlwZS9QYWdlcy9LaWRzWzMgMCBSXS9Db3VudCAxPj4KZW5kb2JqCjMgMCBvYmoKICA8PC9UeXBlL1BhZ2UvUGFyZW50IDIgMCBSL01lZGlhQm94WzAgMCA1OTUgODQyXS9Db250ZW50cyA0IDAgUj4+CmVuZG9iago0IDAgb2JqCiAgPDwvTGVuZ3RoIDU5Pj5zdHJlYW0KQlQKICAvRjEgMjQgVGYKICA3MCA3MDAgVGQKICAoVmVyaXRhcyBlUU1TIC0gR3hQIERvY3VtZW50KSBUagogRVQKZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgNQowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMTkgMDAwMDAgbiAKMDAwMDAwMDA3MCAwMDAwMCBuIAowMDAwMDAwMTI3IDAwMDAwIGYgCjAwMDAwMDAyMDkgMDAwMDAgbiAKdHJhaWxlcgowMDAwMDAwMjg4Cg==', // minimal valid mock PDF base64
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMessage('Successfully uploaded new document draft!');
        setShowCreateModal(false);
        setNewTitle('');
        setNewDesc('');
        setNewClassification('CONTROLLED');
        setNewRequiredRoles('EMPLOYEE');
        setNewRequiresQuiz(false);
        fetchData();
      } else {
        setErrorMessage(data.error?.message || 'Failed to create document');
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

  // E-Sign Document Approval
  const handleApproveDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDocId || !esignPassword) return;

    try {
      const res = await fetch(`/api/documents/${selectedDocId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': currentUser?.email || '',
        },
        body: JSON.stringify({
          password: esignPassword,
          meaning: esignMeaning,
          comment: esignComment,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMessage(`Document approved and released! Created ${data.trainingAssignmentsCreated} training assignments.`);
        setShowApproveModal(false);
        setEsignPassword('');
        setEsignComment('');
        fetchData();
      } else {
        setErrorMessage(data.error?.message || 'Verification failed');
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

  // Submit Training Quiz & E-Sign
  const handleSubmitTraining = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrainingId || !esignTrainingPassword) return;

    const assignment = trainings.find((t) => t.id === selectedTrainingId);
    if (!assignment) return;

    const answersList: QuizAnswer[] = [];
    if (assignment.requirement.requiresQuiz && assignment.requirement.quizQuestions) {
      const questions: QuizQuestion[] = JSON.parse(assignment.requirement.quizQuestions);
      let missingAnswers = false;
      
      questions.forEach((q: QuizQuestion) => {
        const val = quizAnswers[q.id];
        if (val === undefined) {
          missingAnswers = true;
        } else {
          answersList.push({ questionId: q.id, answerIndex: val });
        }
      });

      if (missingAnswers) {
        setQuizError('Please answer all questions before submitting.');
        return;
      }
    }

    try {
      const res = await fetch('/api/trainings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': currentUser?.email || '',
        },
        body: JSON.stringify({
          assignmentId: selectedTrainingId,
          answers: answersList,
          esignPassword: esignTrainingPassword,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        if (data.success) {
          setSuccessMessage(`Training sign-off complete! Score: ${data.score}%`);
          setShowTrainingModal(false);
          setQuizAnswers({});
          setEsignTrainingPassword('');
          setQuizError(null);
          fetchData();
        } else {
          setQuizError(`Quiz failed with score ${data.score}%. An 80% passing score is required. Please review material and try again.`);
        }
      } else {
        setQuizError(data.error?.message || 'Submission failed');
      }
    } catch (err: any) {
      setQuizError(err.message);
    }
  };

  // Log Equipment Maintenance/Calibration with E-Sign
  const handleLogMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEquipmentId || !eqLogNotes.trim() || !eqLogPassword) return;

    try {
      const res = await fetch(`/api/equipment/${selectedEquipmentId}/logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': currentUser?.email || '',
        },
        body: JSON.stringify({
          activityType: eqLogActivityType,
          notes: eqLogNotes,
          result: eqLogResult,
          password: eqLogPassword,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        const resultMsg = eqLogResult === 'FAIL'
          ? 'Activity logged as FAIL — equipment taken OUT_OF_SERVICE and MAJOR deviation auto-created.'
          : 'Activity logged successfully. Equipment status updated.';
        setSuccessMessage(resultMsg);
        setShowLogMaintenanceModal(false);
        setEqLogNotes('');
        setEqLogPassword('');
        setEqLogResult('PASS');
        setEqLogActivityType('CALIBRATION');
        fetchData();
      } else {
        setErrorMessage(data.error?.message || 'Failed to log maintenance activity');
      }
      setTimeout(() => {
        setSuccessMessage(null);
        setErrorMessage(null);
      }, 5000);
    } catch (err: any) {
      setErrorMessage(err.message);
      setTimeout(() => setErrorMessage(null), 4000);
    }
  };

  // Export CSV
  const handleExportAudit = () => {
    if (!currentUser) return;
    const url = `/api/audit/export?x-user-email=${encodeURIComponent(currentUser.email)}`;
    window.open(url, '_blank');
  };

  const selectedDoc = documents.find((d) => d.id === selectedDocId);
  const selectedTraining = trainings.find((t) => t.id === selectedTrainingId);

  // Statistics calculation for Dashboard
  const statTotalDocs = documents.length;
  const statEffectiveDocs = documents.filter((d) => d.status === 'EFFECTIVE').length;
  const statPendingTrainings = trainings.filter((t) => t.status === 'ASSIGNED').length;
  const statPendingApprovals = documents.filter((d) => d.status === 'DRAFT' || d.status === 'IN_REVIEW').length;
  const statOverdueEquipment = equipmentList.filter((eq) => new Date(eq.nextCalibrationDueDate) < new Date() || eq.status === 'OUT_OF_SERVICE').length;
  const statTotalEquipment = equipmentList.length;
  const selectedEquipment = equipmentList.find((eq) => eq.id === selectedEquipmentId) || null;

  const { mode, toggleTheme } = useThemeMode();

  const navGroups: NavGroup[] = [
    {
      title: 'Veritas eQMS',
      items: [
        { id: 'dashboard', label: 'Dashboard', route: 'dashboard', icon: <DashboardIcon /> },
        { id: 'documents', label: 'Document Control', route: 'documents', icon: <DescriptionIcon /> },
        { id: 'training', label: 'Training Hub', route: 'training', icon: <SchoolIcon /> },
        ...(currentUser?.role && currentUser.role !== 'EMPLOYEE' ? [
          { id: 'change-control', label: 'Change Control', route: 'change-control', icon: <ChangeIcon /> }
        ] : []),
        { id: 'quality-events', label: 'Quality Events', route: 'quality-events', icon: <ReportIcon /> },
        { id: 'equipment', label: 'Equipment Cal.', route: 'equipment', icon: <BuildIcon /> },
        ...(currentUser?.role && (currentUser.role === 'ADMIN' || currentUser.role === 'AUDITOR') ? [
          { id: 'audit', label: 'Compliance Logs', route: 'audit', icon: <HistoryIcon /> }
        ] : []),
      ]
    }
  ];

  const headerActions = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Tenant: <strong>{currentUser ? currentUser.tenantId.substring(0, 8) + '...' : 'Acme Biotech'}</strong></span>
      <select 
        style={{
          background: 'var(--blight)',
          color: 'var(--t1)',
          border: '1px solid var(--border)',
          padding: '6px 12px',
          borderRadius: '6px',
          outline: 'none',
          cursor: 'pointer',
          fontSize: '13px'
        }}
        value={currentUser?.email || ''} 
        onChange={(e) => handleUserChange(e.target.value)}
      >
        {users.map((u) => (
          <option key={u.id} value={u.email} style={{ background: 'var(--bg)', color: 'var(--t1)' }}>
            {u.fullName} ({u.role})
          </option>
        ))}
      </select>
    </div>
  );

  const getHeaderTitle = () => {
    switch (activeTab) {
      case 'dashboard': return 'Compliance Dashboard';
      case 'documents': return 'Document Repository';
      case 'training': return 'Training matrix & assignments';
      case 'change-control': return 'Change Request Workflows';
      case 'quality-events': return 'GxP Quality Events (Deviation & CAPA)';
      case 'equipment': return 'Equipment Calibration & Maintenance';
      case 'audit': return 'GxP Chronological Audit Log';
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
            <div className={styles.grid3}>
              <div className={`${styles.card} ${styles.cardGlow}`}>
                <div className={styles.cardTitle}>Total Documents</div>
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

            {/* Analytics Charts */}
            <div style={{ marginTop: '24px' }}>
              <DashboardAnalytics
                documents={documents}
                deviations={deviations}
                capas={capas}
                trainings={trainings}
                equipment={equipmentList}
              />
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

              {/* Persona Guide Info */}
              <div className={styles.card}>
                <div className={styles.cardTitle}>Active Persona Context</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <p>You are logged in as <strong>{currentUser?.fullName}</strong> with role <strong>{currentUser?.role}</strong>.</p>
                  <div className="glass" style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', fontSize: '13px' }}>
                    <strong>Capabilities for your role:</strong>
                    <ul style={{ paddingLeft: '20px', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {currentUser?.role === 'ADMIN' && (
                        <>
                          <li>Create, edit, delete, and approve all documents</li>
                          <li>Access full compliance audit trail and CSV exports</li>
                          <li>View entire training matrix</li>
                        </>
                      )}
                      {currentUser?.role === 'OWNER' && (
                        <>
                          <li>Upload new document drafts and update metadata</li>
                          <li>View documents (with restricted ABAC clearance checking)</li>
                          <li>View training matrix</li>
                        </>
                      )}
                      {currentUser?.role === 'APPROVER' && (
                        <>
                          <li>Approve & sign release manifests (e-signature)</li>
                          <li>View documents and download content</li>
                        </>
                      )}
                      {currentUser?.role === 'EMPLOYEE' && (
                        <>
                          <li>View released effective documents</li>
                          <li>Complete assigned training tasks and quizzes</li>
                        </>
                      )}
                      {currentUser?.role === 'AUDITOR' && (
                        <>
                          <li>View effective documents (read-only audit portal)</li>
                          <li>Export full chronological audit logs</li>
                        </>
                      )}
                    </ul>
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Use the top right selector to switch personas and test different access limits.</span>
                </div>
              </div>
            </div>

            {/* Quality Actions / CAPA Checklist Row */}
            <div className={styles.grid2} style={{ marginTop: '24px' }}>
              <div className={styles.card}>
                <div className={styles.cardTitle}>My Assigned Open CAPAs</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                  {capas.filter(c => c.assignedToId === currentUser?.id && c.status !== 'CLOSED').length > 0 ? (
                    capas.filter(c => c.assignedToId === currentUser?.id && c.status !== 'CLOSED').map((c) => (
                      <div key={c.id} className="glass" style={{ padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong style={{ fontSize: '14px', color: '#fff' }}>{c.title}</strong>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                            Due: {new Date(c.dueDate).toLocaleDateString()} | Related Dev: {c.deviation?.title || 'None'}
                          </div>
                        </div>
                        <button 
                          className={`${styles.btn} ${styles.btnPrimary}`}
                          style={{ fontSize: '12px', padding: '6px 12px' }}
                          onClick={() => {
                            setSelectedCapaId(c.id);
                            setShowCapaSignModal(true);
                          }}
                        >
                          E-Sign & Complete
                        </button>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                      ✓ No pending CAPA assignments.
                    </div>
                  )}
                </div>
              </div>

              <div className={styles.card}>
                <div className={styles.cardTitle}>Recent Quality Deviations</div>
                <div className={styles.tableWrapper} style={{ marginTop: '12px' }}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>ID/Title</th>
                        <th>Classification</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deviations.slice(0, 3).map((d) => (
                        <tr key={d.id} className={styles.tableRow}>
                          <td style={{ fontWeight: '600' }}>{d.title.split(':')[0]}</td>
                          <td>
                            <strong style={{ 
                              color: d.classification === 'CRITICAL' ? 'var(--danger)' : 
                                     d.classification === 'MAJOR' ? 'var(--warning)' : '#10B981',
                              fontSize: '12px'
                            }}>{d.classification}</strong>
                          </td>
                          <td>
                            <span className={`${styles.badge} ${
                              d.status === 'CLOSED' ? styles.badgeEffective : styles.badgeReview
                            }`}>
                              {d.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
                {(currentUser?.role === 'ADMIN' || currentUser?.role === 'OWNER') && (
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
                        <span>Owner: {doc.owner.fullName}</span>
                        <span>Ver: {doc.currentVersionNumber}.0</span>
                        <span>Scope: {doc.classification}</span>
                      </div>
                    </div>
                    <div className={styles.docRight}>
                      <span className={`${styles.badge} ${
                        doc.status === 'EFFECTIVE' ? styles.badgeEffective :
                        doc.status === 'DRAFT' ? styles.badgeDraft : styles.badgeReview
                      }`}>
                        {doc.status}
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
                      {selectedDoc.status}
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Description</span>
                      <p style={{ marginTop: '4px' }}>{selectedDoc.description || 'No description provided.'}</p>
                    </div>

                    <div className={styles.grid3} style={{ margin: 0, gap: '12px' }}>
                      <div>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Owner</span>
                        <div style={{ fontWeight: '600' }}>{selectedDoc.owner.fullName}</div>
                      </div>
                      <div>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Classification</span>
                        <div style={{ fontWeight: '600' }}>{selectedDoc.classification}</div>
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
                          Roles: <span className={styles.currentBadge}>{selectedDoc.trainingRequirement.requiredForRoles}</span>
                          {selectedDoc.trainingRequirement.requiresQuiz && <span style={{ marginLeft: '12px', color: 'var(--secondary)' }}>✓ Quiz Configured</span>}
                        </div>
                      </div>
                    )}

                    {/* Version History & Signature Manifests */}
                    <div>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Version History & Signatures</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                        {selectedDoc.versions.map((ver) => (
                          <div key={ver.id} className="glass" style={{ padding: '12px', fontSize: '13px', background: 'rgba(0,0,0,0.1)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '600' }}>
                              <span>Version {ver.versionNumber}.0</span>
                              <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{new Date(ver.createdAt).toLocaleDateString()}</span>
                            </div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>
                              Integrity Hash: <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px' }}>{ver.hash.substring(0, 16)}...</span>
                            </div>
                            {ver.signatureManifest ? (
                              <div style={{ marginTop: '8px', padding: '6px 8px', background: 'rgba(16, 185, 129, 0.08)', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                <div style={{ color: '#34D399', fontWeight: '600', fontSize: '11px' }}>E-SIGNED COMPLIANT (21 CFR Part 11)</div>
                                <div style={{ fontSize: '12px' }}>
                                  Signed by: {ver.signatureManifest.signer.fullName} ({ver.signatureManifest.signer.role})
                                </div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                                  Meaning: {ver.signatureManifest.meaning} | IP: {ver.signatureManifest.ipAddress}
                                </div>
                              </div>
                            ) : (
                              <div style={{ marginTop: '8px', color: 'var(--warning)', fontSize: '11px', fontWeight: '600' }}>
                                PENDING E-SIGNATURE APPROVAL
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                      {(selectedDoc.status === 'DRAFT' || selectedDoc.status === 'IN_REVIEW') && 
                       (currentUser?.role === 'APPROVER' || currentUser?.role === 'ADMIN') && (
                        <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setShowApproveModal(true)}>
                          Execute E-Sign & Release
                        </button>
                      )}
                      
                      {selectedDoc.status === 'EFFECTIVE' && (
                        <a 
                          href={`/${selectedDoc.versions[0]?.filePath}`} 
                          target="_blank" 
                          rel="noreferrer"
                          className={`${styles.btn} ${styles.btnSecondary}`}
                        >
                          View Watermarked PDF
                        </a>
                      )}
                    </div>

                    {selectedDoc.status === 'EFFECTIVE' && (
                      <div className="glass" style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.02)', marginTop: '12px', borderStyle: 'dashed' }}>
                        <h4 style={{ marginBottom: '8px', color: 'var(--primary)' }}>SOP Revision Lock (GxP)</h4>
                        {changeRequests.some(cr => cr.status === 'APPROVED' && cr.documents.some(d => d.documentId === selectedDoc.id)) ? (
                          <div>
                            <p style={{ fontSize: '13px', color: '#34D399', marginBottom: '12px', fontWeight: '500' }}>
                              ✓ Approved Change Request detected. Revision lock opened.
                            </p>
                            <button 
                              className={`${styles.btn} ${styles.btnPrimary}`}
                              onClick={() => handleUploadNewVersion(selectedDoc.id)}
                            >
                              Draft Revision v{selectedDoc.currentVersionNumber + 1}.0
                            </button>
                          </div>
                        ) : (
                          <div>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                              ⚠ Revisions locked. A Change Request must be created and approved by QA before you can draft a new version.
                            </p>
                            {(currentUser?.role === 'ADMIN' || currentUser?.role === 'OWNER') && (
                              <button 
                                className={`${styles.btn} ${styles.btnSecondary}`}
                                onClick={() => {
                                  setNewCRDocIds([selectedDoc.id]);
                                  setNewCRTitle(`CR: Revise ${selectedDoc.title.split(':')[0]}`);
                                  setActiveTab('change-control');
                                  setShowCreateCRModal(true);
                                }}
                              >
                                Initiate Change Request
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="glass" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', marginTop: '16px' }}>
                  Select a document from the repository to view metadata, version history, e-signatures, and access options.
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
                {trainings.filter(t => t.userId === currentUser?.id).length > 0 ? (
                  trainings.filter(t => t.userId === currentUser?.id).map((tr) => (
                    <div 
                      key={tr.id} 
                      className={styles.card}
                      style={{ borderColor: tr.status === 'ASSIGNED' ? 'var(--warning)' : 'var(--secondary)' }}
                    >
                      <div className={styles.cardTitle}>
                        <span>{tr.requirement.document.title}</span>
                        <span className={`${styles.badge} ${tr.status === 'COMPLETED' ? styles.badgeEffective : styles.badgeReview}`}>
                          {tr.status}
                        </span>
                      </div>
                      <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                        {tr.requirement.document.description}
                      </p>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          Assigned: {new Date(tr.assignedAt).toLocaleDateString()}
                          {tr.completedAt && ` | Completed: ${new Date(tr.completedAt).toLocaleDateString()}`}
                        </span>
                        
                        {tr.status === 'ASSIGNED' ? (
                          <button 
                            className={`${styles.btn} ${styles.btnPrimary}`}
                            onClick={() => {
                              setSelectedTrainingId(tr.id);
                              setShowTrainingModal(true);
                            }}
                          >
                            Open Reader & Take Quiz
                          </button>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10B981', fontWeight: '600', fontSize: '13px' }}>
                            ✓ Quiz Passed ({tr.quizResult?.score}%)
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="glass" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No training assignments required for your role/profile context.
                  </div>
                )}
              </div>
            </div>

            {/* Complete Training Matrix for managers */}
            <div>
              <h2>eQMS Training Compliance Matrix</h2>
              <div className={styles.card} style={{ marginTop: '16px' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  Complete list of all active assignments in the tenant, ensuring compliance audits are training-complete.
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
                      {trainings.map((tr) => (
                        <tr key={tr.id} className={styles.tableRow}>
                          <td style={{ fontWeight: '600' }}>{tr.user.fullName}</td>
                          <td><span className={styles.currentBadge}>{tr.user.role}</span></td>
                          <td>{tr.requirement.document.title.split(':')[0]}</td>
                          <td>
                            <span className={`${styles.badge} ${
                              tr.status === 'COMPLETED' ? styles.badgeEffective : styles.badgeReview
                            }`}>
                              {tr.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: CHANGE CONTROL */}
        {activeTab === 'change-control' && (
          <div className={styles.grid2}>
            {/* Change Requests List */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2>Quality Change Control</h2>
                {(currentUser?.role === 'ADMIN' || currentUser?.role === 'OWNER') && (
                  <button 
                    className={`${styles.btn} ${styles.btnPrimary}`} 
                    onClick={() => setShowCreateCRModal(true)}
                  >
                    + New Change Request
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {changeRequests.map((cr) => (
                  <div 
                    key={cr.id} 
                    className={styles.card}
                    onClick={() => setSelectedCRId(cr.id)}
                    style={{ cursor: 'pointer', borderColor: selectedCRId === cr.id ? 'var(--primary)' : 'rgba(255,255,255,0.06)' }}
                  >
                    <div className={styles.cardTitle}>
                      <span>{cr.title}</span>
                      <span className={`${styles.badge} ${
                        cr.status === 'CLOSED' ? styles.badgeEffective :
                        cr.status === 'APPROVED' ? styles.badgeReview : styles.badgeDraft
                      }`}>
                        {cr.status}
                      </span>
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                      Risk Level: <strong style={{ 
                        color: cr.riskLevel === 'HIGH' ? 'var(--danger)' : 
                               cr.riskLevel === 'MEDIUM' ? 'var(--warning)' : '#10B981' 
                      }}>{cr.riskLevel}</strong>
                    </p>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                      Linked Docs: {cr.documents.map(d => d.document.title.split(':')[0]).join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Change Request Detail Panel */}
            <div>
              <h2>Change Request Details</h2>
              {selectedCRId && changeRequests.find(c => c.id === selectedCRId) ? (
                (() => {
                  const cr = changeRequests.find(c => c.id === selectedCRId)!;
                  return (
                    <div className={styles.card} style={{ marginTop: '16px' }}>
                      <div className={styles.cardTitle}>
                        <span>{cr.title}</span>
                        <span className={`${styles.badge} ${
                          cr.status === 'CLOSED' ? styles.badgeEffective :
                          cr.status === 'APPROVED' ? styles.badgeReview : styles.badgeDraft
                        }`}>
                          {cr.status}
                        </span>
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Reason for Change</span>
                          <p style={{ marginTop: '4px', fontSize: '14px' }}>{cr.reason}</p>
                        </div>

                        <div className={styles.grid3} style={{ margin: 0, gap: '12px' }}>
                          <div>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Risk Level</span>
                            <div style={{ fontWeight: '600', color: cr.riskLevel === 'HIGH' ? 'var(--danger)' : cr.riskLevel === 'MEDIUM' ? 'var(--warning)' : '#10B981' }}>{cr.riskLevel}</div>
                          </div>
                          <div>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Created</span>
                            <div style={{ fontWeight: '600' }}>{new Date(cr.createdAt).toLocaleDateString()}</div>
                          </div>
                        </div>

                        {cr.riskLevel === 'HIGH' && (
                          <div className="glass" style={{ padding: '12px', borderColor: 'var(--danger)', background: 'rgba(239, 68, 68, 0.03)', color: '#F87171', fontSize: '13px' }}>
                            <strong>HIGH RISK ASSESSMENT:</strong> Formal training, reading logs, and passing quiz verification scores are mandatory upon release.
                          </div>
                        )}

                        <div>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Impacted Documents</span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                            {cr.documents.map((d) => (
                              <div key={d.documentId} className="glass" style={{ padding: '10px 12px', fontSize: '13px', background: 'rgba(0,0,0,0.15)' }}>
                                <div style={{ fontWeight: '600' }}>{d.document.title}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                  Current Status: <span style={{ color: d.document.status === 'EFFECTIVE' ? '#10B981' : 'var(--warning)' }}>{d.document.status}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Sign-off buttons */}
                        <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                          {cr.status === 'UNDER_REVIEW' && (currentUser?.role === 'APPROVER' || currentUser?.role === 'ADMIN') && (
                            <button 
                              className={`${styles.btn} ${styles.btnPrimary}`}
                              onClick={() => {
                                setEsignCRAction('APPROVE');
                                setShowCRSignModal(true);
                              }}
                            >
                              Sign-off Approval (Unlock Edit)
                            </button>
                          )}
                          {cr.status === 'APPROVED' && (currentUser?.role === 'APPROVER' || currentUser?.role === 'ADMIN') && (
                            <button 
                              className={`${styles.btn} ${styles.btnPrimary}`}
                              onClick={() => {
                                setEsignCRAction('CLOSE');
                                setShowCRSignModal(true);
                              }}
                              style={{ background: 'var(--secondary)' }}
                            >
                              Sign-off Closure
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="glass" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', marginTop: '16px' }}>
                  Select a Change Request from the list to review risk mitigation, linked SOPs, and QA approval options.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 6: QUALITY EVENTS (DEVIATIONS & CAPA) */}
        {activeTab === 'quality-events' && (
          <div className={styles.grid2}>
            {/* Column 1: Lists of Deviations & CAPAs */}
            <div>
              {/* Deviations Panel */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2>Quality Deviations</h2>
                <button 
                  className={`${styles.btn} ${styles.btnPrimary}`} 
                  onClick={() => setShowCreateDeviationModal(true)}
                >
                  + Log Deviation
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                {deviations.length > 0 ? (
                  deviations.map((d) => (
                    <div 
                      key={d.id} 
                      className={styles.card}
                      onClick={() => {
                        setSelectedDeviationId(d.id);
                        setSelectedCapaId(null);
                      }}
                      style={{ cursor: 'pointer', borderColor: selectedDeviationId === d.id ? 'var(--primary)' : 'rgba(255,255,255,0.06)' }}
                    >
                      <div className={styles.cardTitle}>
                        <span>{d.title}</span>
                        <span className={`${styles.badge} ${
                          d.status === 'CLOSED' ? styles.badgeEffective : styles.badgeDraft
                        }`}>
                          {d.status}
                        </span>
                      </div>
                      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        Classification: <strong style={{ 
                          color: d.classification === 'CRITICAL' ? 'var(--danger)' : 
                                 d.classification === 'MAJOR' ? 'var(--warning)' : '#10B981' 
                        }}>{d.classification}</strong>
                      </p>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                        Logged by: {d.detectedBy?.fullName} | Date: {new Date(d.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="glass" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No deviations logged in this tenant.
                  </div>
                )}
              </div>

              {/* CAPAs Panel */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2>CAPA Actions</h2>
                {(currentUser?.role === 'ADMIN' || currentUser?.role === 'OWNER') && (
                  <button 
                    className={`${styles.btn} ${styles.btnSecondary}`} 
                    onClick={() => {
                      setNewCapaDeviationId(null);
                      setShowCreateCapaModal(true);
                    }}
                  >
                    + New CAPA
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {capas.length > 0 ? (
                  capas.map((c) => (
                    <div 
                      key={c.id} 
                      className={styles.card}
                      onClick={() => {
                        setSelectedCapaId(c.id);
                        setSelectedDeviationId(null);
                      }}
                      style={{ cursor: 'pointer', borderColor: selectedCapaId === c.id ? 'var(--secondary)' : 'rgba(255,255,255,0.06)' }}
                    >
                      <div className={styles.cardTitle}>
                        <span>{c.title}</span>
                        <span className={`${styles.badge} ${
                          c.status === 'CLOSED' ? styles.badgeEffective : styles.badgeReview
                        }`}>
                          {c.status}
                        </span>
                      </div>
                      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        Assignee: <strong>{c.assignedTo?.fullName}</strong>
                      </p>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                        Due: {new Date(c.dueDate).toLocaleDateString()} {c.deviation && `| Dev ID: ${c.deviation.title.split(':')[0]}`}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="glass" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No CAPA tasks logged in this tenant.
                  </div>
                )}
              </div>
            </div>

            {/* Column 2: Selected Item Detail panel */}
            <div>
              {selectedDeviationId && deviations.find(d => d.id === selectedDeviationId) && (
                (() => {
                  const d = deviations.find(d => d.id === selectedDeviationId)!;
                  return (
                    <div>
                      <h2>Deviation Details</h2>
                      <div className={styles.card} style={{ marginTop: '16px' }}>
                        <div className={styles.cardTitle}>
                          <span>{d.title}</span>
                          <span className={`${styles.badge} ${
                            d.status === 'CLOSED' ? styles.badgeEffective : styles.badgeDraft
                          }`}>
                            {d.status}
                          </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                          <div>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Event Description</span>
                            <p style={{ marginTop: '4px', fontSize: '14px' }}>{d.description}</p>
                          </div>

                          <div className={styles.grid3} style={{ margin: 0, gap: '12px' }}>
                            <div>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Classification</span>
                              <div style={{ fontWeight: '600', color: d.classification === 'CRITICAL' ? 'var(--danger)' : d.classification === 'MAJOR' ? 'var(--warning)' : '#10B981' }}>
                                {d.classification}
                              </div>
                            </div>
                            <div>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Logged By</span>
                              <div style={{ fontWeight: '600' }}>{d.detectedBy?.fullName}</div>
                            </div>
                            <div>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Date Logged</span>
                              <div style={{ fontWeight: '600' }}>{new Date(d.createdAt).toLocaleDateString()}</div>
                            </div>
                          </div>

                          <div className="glass" style={{ padding: '16px', background: 'rgba(0,0,0,0.15)' }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Root Cause & Investigation Details</span>
                            {d.investigationNotes ? (
                              <p style={{ fontSize: '13px' }}>{d.investigationNotes}</p>
                            ) : (
                              <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No investigation notes logged yet.</p>
                            )}
                            {d.investigator && (
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                                Assigned Investigator: <strong>{d.investigator.fullName}</strong>
                              </div>
                            )}
                          </div>

                          {/* Linked CAPAs list */}
                          <div>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Linked CAPA Actions</span>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                              {d.capas && d.capas.length > 0 ? (
                                d.capas.map((c) => (
                                  <div key={c.id} className="glass" style={{ padding: '8px 12px', fontSize: '13px', background: 'rgba(255,255,255,0.02)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                      <span>{c.title}</span>
                                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Assignee: {c.assignedTo?.fullName}</span>
                                    </div>
                                    <span className={`${styles.badge} ${c.status === 'CLOSED' ? styles.badgeEffective : styles.badgeReview}`} style={{ fontSize: '10px' }}>
                                      {c.status}
                                    </span>
                                  </div>
                                ))
                              ) : (
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No preventive actions linked.</div>
                              )}
                            </div>
                          </div>

                          {/* Investigation and CAPA actions buttons */}
                          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                            {currentUser?.role !== 'EMPLOYEE' && (
                              <button 
                                className={`${styles.btn} ${styles.btnPrimary}`}
                                onClick={() => {
                                  setInvestigationNotes(d.investigationNotes || '');
                                  setInvestigationStatus(d.status);
                                  setInvestigationInvestigatorId(d.investigatorId || '');
                                  setShowDeviationInvestigateModal(true);
                                }}
                              >
                                Investigate & Log Root Cause
                              </button>
                            )}
                            {d.status !== 'CLOSED' && (currentUser?.role === 'ADMIN' || currentUser?.role === 'OWNER') && (
                              <button 
                                className={`${styles.btn} ${styles.btnSecondary}`}
                                onClick={() => {
                                  setNewCapaDeviationId(d.id);
                                  setNewCapaTitle(`CAPA: Prevent recurrence of DEV-${d.title.split(':')[0]}`);
                                  setShowCreateCapaModal(true);
                                }}
                              >
                                + Link CAPA
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()
              )}

              {selectedCapaId && capas.find(c => c.id === selectedCapaId) && (
                (() => {
                  const c = capas.find(c => c.id === selectedCapaId)!;
                  return (
                    <div>
                      <h2>CAPA Details</h2>
                      <div className={styles.card} style={{ marginTop: '16px' }}>
                        <div className={styles.cardTitle}>
                          <span>{c.title}</span>
                          <span className={`${styles.badge} ${
                            c.status === 'CLOSED' ? styles.badgeEffective : styles.badgeReview
                          }`}>
                            {c.status}
                          </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                          <div>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Action Plan Details</span>
                            <p style={{ marginTop: '4px', fontSize: '14px' }}>{c.actionPlan}</p>
                          </div>

                          <div className={styles.grid2} style={{ margin: 0, gap: '12px' }}>
                            <div>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Assigned To</span>
                              <div style={{ fontWeight: '600' }}>{c.assignedTo?.fullName} ({c.assignedTo?.department})</div>
                            </div>
                            <div>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Due Date</span>
                              <div style={{ fontWeight: '600', color: new Date(c.dueDate) < new Date() && c.status !== 'CLOSED' ? 'var(--danger)' : '#fff' }}>
                                {new Date(c.dueDate).toLocaleDateString()} {new Date(c.dueDate) < new Date() && c.status !== 'CLOSED' && ' (OVERDUE)'}
                              </div>
                            </div>
                          </div>

                          {c.deviation && (
                            <div className="glass" style={{ padding: '12px', background: 'rgba(0,0,0,0.1)' }}>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Triggered by Deviation</span>
                              <strong style={{ fontSize: '13px', display: 'block', marginTop: '4px' }}>{c.deviation.title}</strong>
                            </div>
                          )}

                          {c.status !== 'CLOSED' && (currentUser?.role === 'ADMIN' || currentUser?.id === c.assignedToId) && (
                            <div style={{ marginTop: '8px' }}>
                              <button 
                                className={`${styles.btn} ${styles.btnPrimary}`}
                                onClick={() => {
                                  setEsignCapaPassword('');
                                  setShowCapaSignModal(true);
                                }}
                              >
                                Sign-off & Close CAPA (E-Sign)
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()
              )}

              {!selectedDeviationId && !selectedCapaId && (
                <div className="glass" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', marginTop: '16px' }}>
                  Select a Deviation or CAPA from the left lists to view investigation logs, root cause analysis, action items, and electronic sign-offs.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 6: EQUIPMENT CALIBRATION & MAINTENANCE */}
        {activeTab === 'equipment' && (
          <div className={styles.grid2}>
            {/* Equipment Registry List */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2>Equipment Registry</h2>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span className={`${styles.badge} ${statOverdueEquipment > 0 ? styles.badgeObsolete : styles.badgeEffective}`} style={{ fontSize: '11px' }}>
                    {statOverdueEquipment} Overdue / OOS
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{statTotalEquipment} total</span>
                </div>
              </div>

              <div className={styles.docGrid}>
                {equipmentList.map((eq) => {
                  const isDue = new Date(eq.nextCalibrationDueDate) < new Date();
                  const isOOS = eq.status === 'OUT_OF_SERVICE';
                  return (
                    <div
                      key={eq.id}
                      className={`${styles.docItem} ${selectedEquipmentId === eq.id ? 'glass' : ''}`}
                      onClick={() => setSelectedEquipmentId(eq.id)}
                      style={{
                        cursor: 'pointer',
                        borderColor: selectedEquipmentId === eq.id ? 'var(--primary)' :
                                     (isDue || isOOS) ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255,255,255,0.06)'
                      }}
                    >
                      <div className={styles.docLeft}>
                        <span className={styles.docTitle}>{eq.name}</span>
                        <div className={styles.docMeta}>
                          <span>{eq.location}</span>
                          <span>{eq.modelNumber || 'N/A'}</span>
                          <span>S/N: {eq.serialNumber || 'N/A'}</span>
                        </div>
                      </div>
                      <div className={styles.docRight}>
                        <span className={`${styles.badge} ${
                          eq.status === 'ACTIVE' ? styles.badgeEffective :
                          eq.status === 'OUT_OF_SERVICE' ? styles.badgeObsolete :
                          eq.status === 'CALIBRATION_DUE' ? styles.badgeReview : styles.badgeDraft
                        }`}>
                          {eq.status}
                        </span>
                        {isDue && eq.status !== 'OUT_OF_SERVICE' && (
                          <span style={{ fontSize: '10px', color: 'var(--danger)', marginTop: '4px', display: 'block', fontWeight: 600 }}>⚠ OVERDUE</span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {equipmentList.length === 0 && (
                  <div className="glass" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No equipment registered. Equipment data will appear after seeding.
                  </div>
                )}
              </div>
            </div>

            {/* Equipment Detail + Maintenance Logs */}
            <div>
              <h2>Equipment Details & Calibration History</h2>
              {selectedEquipment ? (
                <div className={styles.card} style={{ marginTop: '16px' }}>
                  <div className={styles.cardTitle} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{selectedEquipment.name}</span>
                    <span className={`${styles.badge} ${
                      selectedEquipment.status === 'ACTIVE' ? styles.badgeEffective :
                      selectedEquipment.status === 'OUT_OF_SERVICE' ? styles.badgeObsolete : styles.badgeReview
                    }`}>{selectedEquipment.status}</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                      {selectedEquipment.description || 'No description available.'}
                    </div>

                    <div className={styles.grid3} style={{ margin: 0, gap: '12px' }}>
                      <div>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Model</span>
                        <div style={{ fontWeight: '600' }}>{selectedEquipment.modelNumber || 'N/A'}</div>
                      </div>
                      <div>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Serial Number</span>
                        <div style={{ fontWeight: '600' }}>{selectedEquipment.serialNumber || 'N/A'}</div>
                      </div>
                      <div>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Location</span>
                        <div style={{ fontWeight: '600' }}>{selectedEquipment.location}</div>
                      </div>
                    </div>

                    <div className={styles.grid3} style={{ margin: 0, gap: '12px' }}>
                      <div>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Cal. Interval</span>
                        <div style={{ fontWeight: '600' }}>{selectedEquipment.calibrationIntervalDays} days</div>
                      </div>
                      <div>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Last Calibrated</span>
                        <div style={{ fontWeight: '600' }}>{new Date(selectedEquipment.lastCalibratedAt).toLocaleDateString()}</div>
                      </div>
                      <div>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Next Due Date</span>
                        <div style={{
                          fontWeight: '600',
                          color: new Date(selectedEquipment.nextCalibrationDueDate) < new Date() ? 'var(--danger)' : '#10B981'
                        }}>
                          {new Date(selectedEquipment.nextCalibrationDueDate).toLocaleDateString()}
                          {new Date(selectedEquipment.nextCalibrationDueDate) < new Date() && ' (OVERDUE)'}
                        </div>
                      </div>
                    </div>

                    {/* Action Button */}
                    {(currentUser?.role === 'ADMIN' || currentUser?.role === 'OWNER') && (
                      <div>
                        <button
                          className={`${styles.btn} ${styles.btnPrimary}`}
                          onClick={() => setShowLogMaintenanceModal(true)}
                        >
                          📋 Log Calibration / Maintenance Activity
                        </button>
                      </div>
                    )}

                    {/* Linked Deviations */}
                    {selectedEquipment.deviations && selectedEquipment.deviations.length > 0 && (
                      <div>
                        <h4 style={{ marginBottom: '8px', color: 'var(--danger)' }}>⚠ Linked Deviations</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {selectedEquipment.deviations.map((dev) => (
                            <div key={dev.id} className="glass" style={{ padding: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <strong style={{ fontSize: '13px' }}>{dev.title}</strong>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                  {dev.classification} | {dev.status} | {new Date(dev.createdAt).toLocaleDateString()}
                                </div>
                              </div>
                              <span className={`${styles.badge} ${
                                dev.classification === 'CRITICAL' ? styles.badgeObsolete :
                                dev.classification === 'MAJOR' ? styles.badgeReview : styles.badgeEffective
                              }`}>{dev.classification}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Maintenance Log History */}
                    <div>
                      <h4 style={{ marginBottom: '8px' }}>Maintenance & Calibration History</h4>
                      {selectedEquipment.maintenanceLogs && selectedEquipment.maintenanceLogs.length > 0 ? (
                        <div className={styles.tableWrapper}>
                          <table className={styles.table}>
                            <thead>
                              <tr>
                                <th>Date</th>
                                <th>Type</th>
                                <th>Result</th>
                                <th>Performed By</th>
                                <th>E-Sign</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedEquipment.maintenanceLogs.map((log) => (
                                <tr key={log.id} className={styles.tableRow}>
                                  <td>{new Date(log.performedAt).toLocaleDateString()}</td>
                                  <td>
                                    <span className={`${styles.badge} ${styles.badgeDraft}`} style={{ fontSize: '10px' }}>
                                      {log.activityType}
                                    </span>
                                  </td>
                                  <td>
                                    <span style={{
                                      fontWeight: '700',
                                      color: log.result === 'PASS' ? '#10B981' : 'var(--danger)'
                                    }}>{log.result}</span>
                                  </td>
                                  <td>{log.performedBy?.fullName || 'Unknown'}</td>
                                  <td>
                                    {log.esignSignatureId ? (
                                      <span style={{ color: '#10B981', fontSize: '11px' }}>✓ Signed</span>
                                    ) : (
                                      <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>—</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="glass" style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                          No maintenance activities logged yet.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="glass" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', marginTop: '16px' }}>
                  Select an equipment item from the registry to view calibration details, maintenance logs, and compliance status.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: COMPLIANCE LOGS */}
        {activeTab === 'audit' && (
          <div className={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2>Chronological GxP Audit Trail (21 CFR Part 11)</h2>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Immutable chronological ledger of all CUD and READ actions within the tenant.
                </p>
              </div>
              <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={handleExportAudit}>
                Export Chronological CSV
              </button>
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
                        <span className={styles.auditUser}>{log.userEmail || 'System'}</span>
                        <span className={styles.currentBadge} style={{ marginLeft: '8px', fontSize: '10px' }}>{log.userRole}</span>
                        <span style={{ marginLeft: '12px' }}>executed</span>
                        <span className={styles.auditAction} style={{ marginLeft: '8px' }}>{log.action}</span>
                      </div>
                      <span className={styles.auditTime}>{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                    
                    <div style={{ color: log.status === 'Success' ? '#10B981' : '#F87171', fontWeight: '600', fontSize: '11px', marginTop: '4px' }}>
                      STATUS: {log.status} | IP: {log.sourceIp} | EVENT_ID: {log.eventId}
                    </div>

                    <pre className={styles.auditPayload}>
                      {JSON.stringify(JSON.parse(log.payload), null, 2)}
                    </pre>
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
                    <label className={styles.formLabel}>Required Training Role</label>
                    <select 
                      className={styles.select}
                      value={newRequiredRoles}
                      onChange={(e) => setNewRequiredRoles(e.target.value)}
                    >
                      <option value="EMPLOYEE">EMPLOYEE</option>
                      <option value="OWNER,EMPLOYEE">EMPLOYEE & OWNER</option>
                      <option value="ADMIN">ADMIN Only</option>
                    </select>
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
                  Upload Draft SOP
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: E-SIGN APPROVAL */}
      {showApproveModal && selectedDoc && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent} style={{ maxWidth: '500px' }}>
            <div className={styles.modalHeader}>
              <h3>Execute E-Signature Approval</h3>
              <button style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer' }} onClick={() => setShowApproveModal(false)}>×</button>
            </div>
            <form onSubmit={handleApproveDocument}>
              <div className={styles.modalBody}>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  You are electronically signing the approval of document: <strong style={{ color: '#fff' }}>{selectedDoc.title}</strong> (Version {selectedDoc.currentVersionNumber}.0).
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Signature Meaning</label>
                  <select 
                    className={styles.select}
                    value={esignMeaning}
                    onChange={(e) => setEsignMeaning(e.target.value)}
                  >
                    <option value="Approval of Document Release">Approval of Document Release (QA Release)</option>
                    <option value="Authorship Verification">Authorship Verification</option>
                    <option value="Review Sign-off">Review Sign-off</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Comments (Optional)</label>
                  <input 
                    className={styles.input}
                    type="text" 
                    placeholder="Approver remarks..."
                    value={esignComment}
                    onChange={(e) => setEsignComment(e.target.value)}
                  />
                </div>

                <div className={`${styles.formGroup} ${styles.esignHighlight}`}>
                  <label className={styles.formLabel} style={{ color: 'var(--warning)', fontWeight: '600' }}>
                    Enter Password to Confirm E-Signature
                  </label>
                  <input 
                    className={styles.input}
                    type="password" 
                    placeholder="Enter any password to sign"
                    value={esignPassword}
                    onChange={(e) => setEsignPassword(e.target.value)}
                    required
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    Under 21 CFR Part 11 regulations, this action is the legal equivalent of your handwritten signature.
                  </span>
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setShowApproveModal(false)}>
                  Cancel
                </button>
                <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} style={{ background: 'var(--warning)', color: '#000' }}>
                  Electronically Sign & Release
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: TRAINING READER & QUIZ */}
      {showTrainingModal && selectedTraining && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent} style={{ maxWidth: '700px' }}>
            <div className={styles.modalHeader}>
              <h3>SOP Training & Verification Portal</h3>
              <button style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer' }} onClick={() => setShowTrainingModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmitTraining}>
              <div className={styles.modalBody}>
                {/* Simulated Document Reader */}
                <div className="glass" style={{ padding: '20px', height: '180px', overflowY: 'auto', marginBottom: '20px', background: 'rgba(0,0,0,0.3)', borderStyle: 'dashed' }}>
                  <h4 style={{ marginBottom: '8px', color: 'var(--primary)' }}>{selectedTraining.requirement.document.title}</h4>
                  <p style={{ fontSize: '13px', lineHeight: '1.6' }}>
                    <strong>1. PURPOSE</strong><br />
                    This procedure outlines the necessary steps required to ensure compliance with document standards, including version formatting, revision audits, change requests, and role-based training assignments. All employees must follow these guidelines strictly to ensure compliance with FDA 21 CFR Part 11 and EU GxP validation metrics.<br /><br />
                    <strong>2. PROCEDURE</strong><br />
                    A. Documents must always be created in a DRAFT state.<br />
                    B. Review routes can include sequential or parallel reviewer steps.<br />
                    C. Final approval triggers automatic training assignments across mapped roles.<br />
                    D. Any changes require a Change Request (CR) record and trigger retraining.
                  </p>
                </div>

                {/* Quiz section */}
                {selectedTraining.requirement.requiresQuiz && selectedTraining.requirement.quizQuestions && (
                  <div>
                    <h4 style={{ marginBottom: '12px' }}>Knowledge Assessment Quiz</h4>
                    
                    {JSON.parse(selectedTraining.requirement.quizQuestions).map((q: QuizQuestion) => (
                      <div key={q.id} className={styles.quizCard}>
                        <div className={styles.quizQuestion}>{q.text}</div>
                        <div className={styles.quizOptionsList}>
                          {q.options.map((opt: string, optIdx: number) => (
                            <label key={optIdx} className={styles.quizOptionLabel}>
                              <input 
                                className={styles.quizRadio}
                                type="radio" 
                                name={`question_${q.id}`} 
                                checked={quizAnswers[q.id] === optIdx}
                                onChange={() => {
                                  const newAnswers = { ...quizAnswers };
                                  newAnswers[q.id] = optIdx;
                                  setQuizAnswers(newAnswers);
                                }}
                              />
                              <span className={styles.quizOptionText}>{opt}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {quizError && (
                  <div style={{ color: '#F87171', padding: '12px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', marginBottom: '16px', fontSize: '13px' }}>
                    ⚠ {quizError}
                  </div>
                )}

                {/* E-Signature block */}
                <div className={styles.esignHighlight}>
                  <label className={styles.formLabel} style={{ color: 'var(--warning)', fontWeight: '600' }}>
                    Enter Password to Execute Training Sign-Off
                  </label>
                  <input 
                    className={styles.input}
                    type="password" 
                    placeholder="Enter password to sign-off"
                    value={esignTrainingPassword}
                    onChange={(e) => setEsignTrainingPassword(e.target.value)}
                    required
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    By executing this e-signature, you certify that you have read, understood, and successfully completed the required training for {selectedTraining.requirement.document.title}.
                  </span>
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setShowTrainingModal(false)}>
                  Cancel
                </button>
                <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
                  Submit Quiz & E-Sign Complete
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: CREATE CHANGE REQUEST */}
      {showCreateCRModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>Initiate Quality Change Request</h3>
              <button style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer' }} onClick={() => setShowCreateCRModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreateCR}>
              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Change Request Title</label>
                  <input 
                    className={styles.input}
                    type="text" 
                    placeholder="e.g. CR-2026-002: Revision to Clean Room Guidelines"
                    value={newCRTitle}
                    onChange={(e) => setNewCRTitle(e.target.value)}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Reason for Change & Impact Assessment</label>
                  <textarea 
                    className={styles.textarea}
                    placeholder="Specify the reason why this change is necessary and detail any GxP quality impacts..."
                    value={newCRReason}
                    onChange={(e) => setNewCRReason(e.target.value)}
                    rows={4}
                    required
                  />
                </div>

                <div className={styles.grid2} style={{ margin: 0, gap: '16px' }}>
                  <div>
                    <label className={styles.formLabel}>Risk Level</label>
                    <select 
                      className={styles.select}
                      value={newCRRiskLevel}
                      onChange={(e) => setNewCRRiskLevel(e.target.value)}
                    >
                      <option value="LOW">LOW (Typos, Formatting)</option>
                      <option value="MEDIUM">MEDIUM (Minor Process Updates)</option>
                      <option value="HIGH">HIGH (Critical GxP Procedure Changes)</option>
                    </select>
                  </div>
                  <div>
                    <label className={styles.formLabel}>Link Impacted Documents</label>
                    <div style={{ maxHeight: '120px', overflowY: 'auto', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.08)' }}>
                      {documents.map((d) => (
                        <label key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', margin: '4px 0', cursor: 'pointer' }}>
                          <input 
                            type="checkbox"
                            checked={newCRDocIds.includes(d.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewCRDocIds([...newCRDocIds, d.id]);
                              } else {
                                setNewCRDocIds(newCRDocIds.filter(id => id !== d.id));
                              }
                            }}
                          />
                          {d.title.split(':')[0]}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setShowCreateCRModal(false)}>
                  Cancel
                </button>
                <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
                  Submit Change Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: CHANGE REQUEST SIGN-OFF */}
      {showCRSignModal && selectedCRId && changeRequests.find(c => c.id === selectedCRId) && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent} style={{ maxWidth: '500px' }}>
            <div className={styles.modalHeader}>
              <h3>Execute Change Control Sign-Off</h3>
              <button style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer' }} onClick={() => setShowCRSignModal(false)}>×</button>
            </div>
            <form onSubmit={handleCRSignOff}>
              <div className={styles.modalBody}>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  You are electronically signing the <strong>{esignCRAction}</strong> action for Change Request:<br />
                  <strong style={{ color: '#fff' }}>{changeRequests.find(c => c.id === selectedCRId)?.title}</strong>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Sign-off Comment / Review Note</label>
                  <input 
                    className={styles.input}
                    type="text" 
                    placeholder="Reason for sign-off approval..."
                    value={esignCRComment}
                    onChange={(e) => setEsignCRComment(e.target.value)}
                  />
                </div>

                <div className={`${styles.formGroup} ${styles.esignHighlight}`}>
                  <label className={styles.formLabel} style={{ color: 'var(--warning)', fontWeight: '600' }}>
                    Enter Password to Execute E-Signature
                  </label>
                  <input 
                    className={styles.input}
                    type="password" 
                    placeholder="Enter password to sign"
                    value={esignCRPassword}
                    onChange={(e) => setEsignCRPassword(e.target.value)}
                    required
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    Under 21 CFR Part 11 regulations, this action represents your legal authorization of the Quality Change Control event.
                  </span>
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setShowCRSignModal(false)}>
                  Cancel
                </button>
                <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} style={{ background: 'var(--warning)', color: '#000' }}>
                  Sign-off Change Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: LOG DEVIATION */}
      {showCreateDeviationModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>Log GxP Quality Deviation</h3>
              <button style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer' }} onClick={() => setShowCreateDeviationModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreateDeviation}>
              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Deviation Title</label>
                  <input 
                    className={styles.input}
                    type="text" 
                    placeholder="e.g. DEV-2026-002: Cleanroom B Humidity Spike"
                    value={newDevTitle}
                    onChange={(e) => setNewDevTitle(e.target.value)}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Event Description & Context</label>
                  <textarea 
                    className={styles.textarea}
                    placeholder="Detail the deviation occurrence, date, duration, active batches, and immediate containment steps taken..."
                    value={newDevDescription}
                    onChange={(e) => setNewDevDescription(e.target.value)}
                    rows={4}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Initial Classification</label>
                  <select 
                    className={styles.select}
                    value={newDevClassification}
                    onChange={(e) => setNewDevClassification(e.target.value)}
                  >
                    <option value="MINOR">MINOR (No batch/system impact)</option>
                    <option value="MAJOR">MAJOR (Potential quality impact, containment needed)</option>
                    <option value="CRITICAL">CRITICAL (Direct product/safety impact, immediate stop)</option>
                  </select>
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setShowCreateDeviationModal(false)}>
                  Cancel
                </button>
                <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
                  Log Quality Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 7: CREATE CAPA */}
      {showCreateCapaModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>Assign Corrective / Preventive Action (CAPA)</h3>
              <button style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer' }} onClick={() => setShowCreateCapaModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreateCapa}>
              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>CAPA Action Title</label>
                  <input 
                    className={styles.input}
                    type="text" 
                    placeholder="e.g. CAPA-2026-002: Upgrade HVAC Sensors"
                    value={newCapaTitle}
                    onChange={(e) => setNewCapaTitle(e.target.value)}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Action Plan & Resolution Tasks</label>
                  <textarea 
                    className={styles.textarea}
                    placeholder="Specify target actions, required changes, and verification procedures..."
                    value={newCapaActionPlan}
                    onChange={(e) => setNewCapaActionPlan(e.target.value)}
                    rows={4}
                    required
                  />
                </div>

                <div className={styles.grid2} style={{ margin: 0, gap: '16px' }}>
                  <div>
                    <label className={styles.formLabel}>Assignee</label>
                    <select 
                      className={styles.select}
                      value={newCapaAssignedToId}
                      onChange={(e) => setNewCapaAssignedToId(e.target.value)}
                      required
                    >
                      <option value="">Select Assignee...</option>
                      {users.map(u => (
                        <option key={u.id} value={u.id}>{u.fullName} ({u.role} - {u.department})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={styles.formLabel}>Due Date</label>
                    <input 
                      className={styles.input}
                      type="date"
                      value={newCapaDueDate}
                      onChange={(e) => setNewCapaDueDate(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setShowCreateCapaModal(false)}>
                  Cancel
                </button>
                <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
                  Assign CAPA
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 8: DEVIATION INVESTIGATION */}
      {showDeviationInvestigateModal && selectedDeviationId && deviations.find(d => d.id === selectedDeviationId) && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>Log Investigation & Root Cause Analysis</h3>
              <button style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer' }} onClick={() => setShowDeviationInvestigateModal(false)}>×</button>
            </div>
            <form onSubmit={handleDeviationInvestigate}>
              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Root Cause Analysis & Investigation Notes</label>
                  <textarea 
                    className={styles.textarea}
                    placeholder="Enter detailed investigation findings, identified root cause, and product quality impact analysis..."
                    value={investigationNotes}
                    onChange={(e) => setInvestigationNotes(e.target.value)}
                    rows={5}
                    required
                  />
                </div>

                <div className={styles.grid2} style={{ margin: 0, gap: '16px' }}>
                  <div>
                    <label className={styles.formLabel}>Assigned QA Investigator</label>
                    <select 
                      className={styles.select}
                      value={investigationInvestigatorId}
                      onChange={(e) => setInvestigationInvestigatorId(e.target.value)}
                    >
                      <option value="">Select Investigator...</option>
                      {users.filter(u => u.role !== 'EMPLOYEE').map(u => (
                        <option key={u.id} value={u.id}>{u.fullName} ({u.role})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={styles.formLabel}>Investigation Status</label>
                    <select 
                      className={styles.select}
                      value={investigationStatus}
                      onChange={(e) => setInvestigationStatus(e.target.value)}
                    >
                      <option value="LOGGED">LOGGED (Initial state)</option>
                      <option value="UNDER_INVESTIGATION">UNDER INVESTIGATION</option>
                      <option value="QA_REVIEW">QA REVIEW</option>
                      <option value="CLOSED">CLOSED (Resolved)</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setShowDeviationInvestigateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
                  Save Investigation Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 9: CAPA SIGN-OFF CLOSURE */}
      {showCapaSignModal && selectedCapaId && capas.find(c => c.id === selectedCapaId) && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent} style={{ maxWidth: '500px' }}>
            <div className={styles.modalHeader}>
              <h3>Execute CAPA E-Sign Closure</h3>
              <button style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer' }} onClick={() => setShowCapaSignModal(false)}>×</button>
            </div>
            <form onSubmit={handleCapaSignOff}>
              <div className={styles.modalBody}>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  You are electronically signing off the completion of CAPA task:<br />
                  <strong style={{ color: '#fff' }}>{capas.find(c => c.id === selectedCapaId)?.title}</strong>
                </div>

                <div className={`${styles.formGroup} ${styles.esignHighlight}`}>
                  <label className={styles.formLabel} style={{ color: 'var(--warning)', fontWeight: '600' }}>
                    Enter Password to Execute E-Signature
                  </label>
                  <input 
                    className={styles.input}
                    type="password" 
                    placeholder="Enter password to sign"
                    value={esignCapaPassword}
                    onChange={(e) => setEsignCapaPassword(e.target.value)}
                    required
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    Under 21 CFR Part 11 rules, this action represents your legal certification that the action plan has been executed completely.
                  </span>
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setShowCapaSignModal(false)}>
                  Cancel
                </button>
                <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} style={{ background: 'var(--warning)', color: '#000' }}>
                  Execute E-Sign & Close CAPA
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 10: EQUIPMENT MAINTENANCE LOG */}
      {showLogMaintenanceModal && selectedEquipmentId && selectedEquipment && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent} style={{ maxWidth: '600px' }}>
            <div className={styles.modalHeader}>
              <h3>Log Calibration / Maintenance Activity</h3>
              <button style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer' }} onClick={() => setShowLogMaintenanceModal(false)}>×</button>
            </div>
            <form onSubmit={handleLogMaintenance}>
              <div className={styles.modalBody}>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  Recording activity for: <strong style={{ color: '#fff' }}>{selectedEquipment.name}</strong>
                  <br />
                  <span style={{ fontSize: '11px' }}>Location: {selectedEquipment.location} | S/N: {selectedEquipment.serialNumber || 'N/A'}</span>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Activity Type</label>
                  <select
                    className={styles.input}
                    value={eqLogActivityType}
                    onChange={(e) => setEqLogActivityType(e.target.value)}
                  >
                    <option value="CALIBRATION">Calibration</option>
                    <option value="PREVENTATIVE_MAINTENANCE">Preventative Maintenance</option>
                    <option value="REPAIR">Repair</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Result</label>
                  <select
                    className={styles.input}
                    value={eqLogResult}
                    onChange={(e) => setEqLogResult(e.target.value)}
                  >
                    <option value="PASS">PASS ✓</option>
                    <option value="FAIL">FAIL ✗ (triggers auto-deviation)</option>
                  </select>
                  {eqLogResult === 'FAIL' && (
                    <span style={{ fontSize: '11px', color: 'var(--danger)', marginTop: '4px', display: 'block' }}>
                      ⚠ A FAIL result will auto-create a MAJOR Deviation and take the equipment OUT_OF_SERVICE.
                    </span>
                  )}
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Activity Notes / Observations</label>
                  <textarea
                    className={styles.input}
                    rows={4}
                    placeholder="Describe the calibration/maintenance performed, observations, measurements..."
                    value={eqLogNotes}
                    onChange={(e) => setEqLogNotes(e.target.value)}
                    required
                    style={{ resize: 'vertical', minHeight: '80px' }}
                  />
                </div>

                <div className={`${styles.formGroup} ${styles.esignHighlight}`}>
                  <label className={styles.formLabel} style={{ color: 'var(--warning)', fontWeight: '600' }}>
                    21 CFR Part 11 Electronic Signature
                  </label>
                  <input
                    className={styles.input}
                    type="password"
                    placeholder="Enter password to E-Sign this record"
                    value={eqLogPassword}
                    onChange={(e) => setEqLogPassword(e.target.value)}
                    required
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    Your electronic signature certifies the accuracy and completeness of this maintenance record per 21 CFR Part 11.
                  </span>
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setShowLogMaintenanceModal(false)}>
                  Cancel
                </button>
                <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
                  Submit E-Signed Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
