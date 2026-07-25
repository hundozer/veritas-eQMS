'use client';

import { useState, useEffect, useCallback } from 'react';
import styles from './page.module.css';
import { AppShell, useThemeMode } from '@/ui';
import type { NavGroup } from '@/ui';
import dynamic from 'next/dynamic';

const DashboardAnalytics = dynamic(() => import('@/components/DashboardAnalytics'), { ssr: false });
import { DEFAULT_SYSTEM_ROLES, SYSTEM_PERMISSIONS } from '@/lib/permissions';
import {
  Dashboard as DashboardIcon,
  Description as DescriptionIcon,
  School as SchoolIcon,
  PublishedWithChanges as ChangeIcon,
  Report as ReportIcon,
  History as HistoryIcon,
  Build as BuildIcon,
  LocalShipping as SupplierIcon
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
  tenant?: {
    id?: string;
    name: string;
  };
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

interface SupplierAudit {
  id: string;
  supplierId: string;
  auditorId: string;
  auditor: User;
  auditDate: string;
  auditType: string;
  findings: string;
  result: string;
  esignSignatureId: string | null;
  createdAt: string;
}

interface MaterialReceipt {
  id: string;
  supplierId: string;
  materialName: string;
  lotNumber: string;
  quantityReceived: number;
  unit: string;
  inspectionStatus: string;
  inspectedById: string;
  inspectedBy: User;
  notes: string | null;
  receivedAt: string;
  createdAt: string;
}

interface Supplier {
  id: string;
  name: string;
  contactEmail: string | null;
  contactPhone: string | null;
  category: string;
  status: string;
  riskClassification: string;
  qualificationDate: string;
  reEvaluationDueDate: string;
  notes: string | null;
  createdAt: string;
  audits: SupplierAudit[];
  materialReceipts: MaterialReceipt[];
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
  // Mode: Landing Page vs eQMS Workspace App
  const [viewMode, setViewMode] = useState<'landing' | 'app'>('landing');

  // Navigation
  const [activeTab, setActiveTab] = useState<'dashboard' | 'documents' | 'training' | 'audit' | 'audits-management' | 'users-management' | 'change-control' | 'quality-events' | 'equipment' | 'suppliers'>('dashboard');

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
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [healthScore, setHealthScore] = useState<any>(null);
  const [auditPlans, setAuditPlans] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);

  // Selected Detail views
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [selectedTrainingId, setSelectedTrainingId] = useState<string | null>(null);
  const [selectedCRId, setSelectedCRId] = useState<string | null>(null);
  const [selectedDeviationId, setSelectedDeviationId] = useState<string | null>(null);
  const [selectedCapaId, setSelectedCapaId] = useState<string | null>(null);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | null>(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);

  // Forms / Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showTrainingModal, setShowTrainingModal] = useState(false);
  const [showCreateSupplierModal, setShowCreateSupplierModal] = useState(false);
  const [showAuditSupplierModal, setShowAuditSupplierModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showInviteUserModal, setShowInviteUserModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [showDemoPersonas, setShowDemoPersonas] = useState(false);

  // User Management State
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteFullName, setInviteFullName] = useState('');
  const [inviteRole, setInviteRole] = useState('EMPLOYEE');
  const [inviteDept, setInviteDept] = useState('QA');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editRole, setEditRole] = useState('EMPLOYEE');
  const [editDept, setEditDept] = useState('QA');

  // Auth / Login Form State
  const [loginEmail, setLoginEmail] = useState('');

  // Company Registration & Onboarding Form State
  const [regCompanyName, setRegCompanyName] = useState('');
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regDepartment, setRegDepartment] = useState('QA');
  const [regRole, setRegRole] = useState('OWNER');
  const [regGxPStandard, setRegGxPStandard] = useState('21 CFR Part 11 / ISO 13485');

  // Supplier Form State
  const [newSupName, setNewSupName] = useState('');
  const [newSupEmail, setNewSupEmail] = useState('');
  const [newSupPhone, setNewSupPhone] = useState('');
  const [newSupCategory, setNewSupCategory] = useState('RAW_MATERIAL');
  const [newSupRisk, setNewSupRisk] = useState('CRITICAL');
  const [newSupNotes, setNewSupNotes] = useState('');
  const [newSupInterval, setNewSupInterval] = useState('365');

  // Supplier Audit Form State
  const [auditType, setAuditType] = useState('ROUTINE_ANNUAL');
  const [auditFindings, setAuditFindings] = useState('');
  const [auditResult, setAuditResult] = useState('PASS');
  const [auditPassword, setAuditPassword] = useState('');

  // Material Receipt Form State
  const [recMaterialName, setRecMaterialName] = useState('');
  const [recLotNumber, setRecLotNumber] = useState('');
  const [recQty, setRecQty] = useState('100');
  const [recUnit, setRecUnit] = useState('units');
  const [recInspectionStatus, setRecInspectionStatus] = useState('PASSED');
  const [recNotes, setRecNotes] = useState('');
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

  // Attached Physical File State
  const [docFileBase64, setDocFileBase64] = useState<string | null>(null);
  const [docFileName, setDocFileName] = useState('');
  const [docFileSize, setDocFileSize] = useState('');
  const [docFileHash, setDocFileHash] = useState('');

  const handleDocFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setDocFileName(file.name);
    setDocFileSize(`${(file.size / 1024).toFixed(1)} KB`);

    // Calculate SHA-256 Hash
    try {
      const arrayBuffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      setDocFileHash(hashHex);

      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Strip data url prefix e.g. "data:application/pdf;base64,"
        const base64 = result.split(',')[1] || result;
        setDocFileBase64(base64);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('File hash calculation error:', err);
    }
  };

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

  // Load tenant users on start & verify active session
  useEffect(() => {
    fetch('/api/users')
      .then((res) => res.json())
      .then((data) => {
        if (data.users) {
          setUsers(data.users);
          // Check for active user session cookie
          const match = document.cookie.match(/user-email=([^;]+)/);
          if (match) {
            const email = decodeURIComponent(match[1]);
            const activeUser = data.users.find((u: User) => u.email === email);
            if (activeUser) {
              setCurrentUser(activeUser);
              setViewMode('app');
            } else {
              setCurrentUser(null);
              setViewMode('landing');
            }
          } else {
            setCurrentUser(null);
            setViewMode('landing');
          }
        }
      })
      .catch((err) => {
        console.error('Failed to load users:', err);
        setCurrentUser(null);
        setViewMode('landing');
      });
  }, []);

  // Handle Sign Out / Logout
  const handleSignOut = () => {
    document.cookie = 'user-email=; path=/; max-age=0';
    setCurrentUser(null);
    setViewMode('landing');
    setSuccessMessage('Signed out successfully.');
    setTimeout(() => setSuccessMessage(null), 4000);
  };

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

      // Fetch Suppliers
      const supRes = await fetch('/api/suppliers', {
        headers: { 'x-user-email': currentUser.email },
      });
      const supData = await supRes.json();
      if (supData.suppliers) setSuppliers(supData.suppliers);

      // Fetch Veritas Intelligence Compliance Health
      const intelRes = await fetch('/api/intelligence', {
        headers: { 'x-user-email': currentUser.email },
      });
      const intelData = await intelRes.json();
      if (intelData.health) setHealthScore(intelData.health);

      // Fetch Audit Plans
      const auditPlanRes = await fetch('/api/audits', {
        headers: { 'x-user-email': currentUser.email },
      });
      const auditPlanData = await auditPlanRes.json();
      if (auditPlanData.auditPlans) setAuditPlans(auditPlanData.auditPlans);

      // Fetch Notifications
      const notifRes = await fetch('/api/notifications', {
        headers: { 'x-user-email': currentUser.email },
      });
      const notifData = await notifRes.json();
      if (notifData.notifications) setNotifications(notifData.notifications);
    } catch (err) {
      console.error('Fetch data error:', err);
    }
  }, [currentUser, auditActionFilter, auditTypeFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Invite new employee & assign role
  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || !inviteFullName || !currentUser) return;

    try {
      setErrorMessage('');
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': currentUser.email,
        },
        body: JSON.stringify({
          email: inviteEmail,
          fullName: inviteFullName,
          role: inviteRole,
          department: inviteDept,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error?.message || 'Failed to invite user');
        return;
      }

      setSuccessMessage(`User ${inviteFullName} successfully invited as ${inviteRole} in ${inviteDept}`);
      setShowInviteUserModal(false);
      setInviteEmail('');
      setInviteFullName('');
      fetchData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error inviting team member');
    }
  };

  // Update existing user role & department
  const handleUpdateUserRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser || !currentUser) return;

    try {
      setErrorMessage('');
      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': currentUser.email,
        },
        body: JSON.stringify({
          role: editRole,
          department: editDept,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error?.message || 'Failed to update user role');
        return;
      }

      setSuccessMessage(`Role for ${editingUser.fullName} updated to ${editRole} (${editDept})`);
      setShowEditUserModal(false);
      setEditingUser(null);
      fetchData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error updating user role');
    }
  };

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
          contentBase64: docFileBase64 || 'JVBERi0xLjQKJcfsj6IKMSAwIG9iagogIDw8L1R5cGUvQ2F0YWxvZy9QYWdlcyAyIDAgUj4+CmVuZG9iagoyIDAgb2JqCiAgPDwvVHlwZS9QYWdlcy9LaWRzWzMgMCBSXS9Db3VudCAxPj4KZW5kb2JqCjMgMCBvYmoKICA8PC9UeXBlL1BhZ2UvUGFyZW50IDIgMCBSL01lZGlhQm94WzAgMCA1OTUgODQyXS9Db250ZW50cyA0IDAgUj4+CmVuZG9iago0IDAgb2JqCiAgPDwvTGVuZ3RoIDU5Pj5zdHJlYW0KQlQKICAvRjEgMjQgVGYKICA3MCA3MDAgVGQKICAoVmVyaXRhcyBlUU1TIC0gR3hQIERvY3VtZW50KSBUagogRVQKZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgNQowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMTkgMDAwMDAgbiAKMDAwMDAwMDA3MCAwMDAwMCBuIAowMDAwMDAwMTI3IDAwMDAwIGYgCjAwMDAwMDAyMDkgMDAwMDAgbiAKdHJhaWxlcgowMDAwMDAwMjg4Cg==',
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMessage(`Document "${data.document.title}" created successfully!`);
        setShowCreateModal(false);
        setNewTitle('');
        setNewDesc('');
        setNewClassification('CONTROLLED');
        setNewRequiredRoles('EMPLOYEE');
        setNewRequiresQuiz(false);
        setDocFileBase64(null);
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

  // Register new supplier
  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupName.trim()) return;

    try {
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': currentUser?.email || '',
        },
        body: JSON.stringify({
          name: newSupName,
          contactEmail: newSupEmail,
          contactPhone: newSupPhone,
          category: newSupCategory,
          riskClassification: newSupRisk,
          reEvaluationIntervalDays: newSupInterval,
          notes: newSupNotes,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMessage(`Supplier "${data.supplier.name}" registered successfully.`);
        setShowCreateSupplierModal(false);
        setNewSupName('');
        setNewSupEmail('');
        setNewSupPhone('');
        setNewSupNotes('');
        fetchData();
      } else {
        setErrorMessage(data.error?.message || 'Failed to register supplier');
      }
      setTimeout(() => { setSuccessMessage(null); setErrorMessage(null); }, 5000);
    } catch (err: any) {
      setErrorMessage(err.message);
      setTimeout(() => setErrorMessage(null), 5000);
    }
  };

  // Log Supplier Audit (E-Signed)
  const handleAuditSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierId || !auditFindings.trim() || !auditPassword) return;

    try {
      const res = await fetch(`/api/suppliers/${selectedSupplierId}/audits`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': currentUser?.email || '',
        },
        body: JSON.stringify({
          auditType,
          findings: auditFindings,
          result: auditResult,
          signaturePassword: auditPassword,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMessage(`Audit logged successfully! Status updated to ${data.newStatus}.`);
        setShowAuditSupplierModal(false);
        setAuditFindings('');
        setAuditPassword('');
        fetchData();
      } else {
        setErrorMessage(data.error?.message || 'Audit submission failed');
      }
      setTimeout(() => { setSuccessMessage(null); setErrorMessage(null); }, 5000);
    } catch (err: any) {
      setErrorMessage(err.message);
      setTimeout(() => setErrorMessage(null), 5000);
    }
  };

  // Log Material Receipt & Inspection
  const handleMaterialReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierId || !recMaterialName.trim() || !recLotNumber.trim()) return;

    try {
      const res = await fetch(`/api/suppliers/${selectedSupplierId}/receipts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': currentUser?.email || '',
        },
        body: JSON.stringify({
          materialName: recMaterialName,
          lotNumber: recLotNumber,
          quantityReceived: recQty,
          unit: recUnit,
          inspectionStatus: recInspectionStatus,
          notes: recNotes,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        let msg = `Material receipt logged for Lot ${data.receipt.lotNumber}.`;
        if (data.createdDeviationId) {
          msg += ` ⚠ Auto-deviation created for rejected material inspection.`;
        }
        setSuccessMessage(msg);
        setShowReceiptModal(false);
        setRecMaterialName('');
        setRecLotNumber('');
        setRecNotes('');
        fetchData();
      } else {
        setErrorMessage(data.error?.message || 'Failed to log material receipt');
      }
      setTimeout(() => { setSuccessMessage(null); setErrorMessage(null); }, 5000);
    } catch (err: any) {
      setErrorMessage(err.message);
      setTimeout(() => setErrorMessage(null), 5000);
    }
  };

  // Onboard New Company / Organization
  const handleRegisterCompany = async (e: React.FormEvent): Promise<boolean> => {
    e.preventDefault();
    if (!regCompanyName.trim() || !regFullName.trim() || !regEmail.trim()) return false;

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: regCompanyName,
          fullName: regFullName,
          email: regEmail,
          department: regDepartment,
          role: regRole,
          GxPStandard: regGxPStandard,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMessage(`Organization "${data.tenant.name}" created! Default GxP SOPs generated.`);
        setCurrentUser(data.user);
        setShowRegisterModal(false);
        setRegCompanyName('');
        setRegFullName('');
        setRegEmail('');
        fetchData();
        return true;
      } else {
        setErrorMessage(data.error?.message || 'Registration failed');
        return false;
      }
    } catch (err: any) {
      setErrorMessage(err.message);
      return false;
    } finally {
      setTimeout(() => { setSuccessMessage(null); setErrorMessage(null); }, 5000);
    }
  };

  // Login / Switch User Session
  const handleLoginUser = async (targetEmail: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail }),
      });

      const data = await res.json();
      if (res.ok) {
        setCurrentUser(data.user);
        setShowLoginModal(false);
        setSuccessMessage(`Switched active session to ${data.user.fullName} (${data.user.role})`);
        fetchData();
        return true;
      } else {
        setErrorMessage(data.error?.message || 'Login failed');
        return false;
      }
    } catch (err: any) {
      setErrorMessage(err.message);
      return false;
    } finally {
      setTimeout(() => { setSuccessMessage(null); setErrorMessage(null); }, 5000);
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
  const selectedSupplier = suppliers.find((sup) => sup.id === selectedSupplierId) || null;

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
        { id: 'quality-events', label: 'Quality Events (CAPA)', route: 'quality-events', icon: <ReportIcon /> },
        { id: 'equipment', label: 'Equipment Cal.', route: 'equipment', icon: <BuildIcon /> },
        { id: 'suppliers', label: 'Suppliers (AVL)', route: 'suppliers', icon: <SupplierIcon /> },
        { id: 'audits-management', label: 'GxP Audits', route: 'audits-management', icon: <HistoryIcon /> },
        ...(currentUser?.role && (currentUser.role === 'ADMIN' || currentUser.role === 'OWNER') ? [
          { id: 'users-management', label: 'User Access & ABAC/RBAC', route: 'users-management', icon: <SchoolIcon /> }
        ] : []),
        ...(currentUser?.role && (currentUser.role === 'ADMIN' || currentUser.role === 'AUDITOR' || currentUser.role === 'OWNER') ? [
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

          <button
            className={`${styles.btn} ${styles.btnSecondary}`}
            onClick={() => setShowLoginModal(true)}
            style={{ fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            👤 <strong>{currentUser.fullName}</strong> ({currentUser.role})
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>▾ Switch</span>
          </button>

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
      case 'change-control': return 'Change Request Workflows';
      case 'quality-events': return 'GxP Deviations & CAPA Workflow';
      case 'equipment': return 'Equipment Calibration & Maintenance';
      case 'suppliers': return 'Supplier Quality & Approved Vendor List';
      case 'audits-management': return 'Internal & Supplier Audit Planning';
      case 'users-management': return 'User Access Policy & ABAC/RBAC Roster';
      case 'audit': return 'GxP 21 CFR Part 11 Audit Trail Logs';
      default: return 'Veritas eQMS';
    }
  };

  if (viewMode === 'landing') {
    return (
      <div style={{ minHeight: '100vh', background: '#0B0E14', color: '#fff', fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column' }}>
        {/* Navigation Header */}
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 40px', borderBottom: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)', background: 'rgba(11,14,20,0.85)', position: 'sticky', top: 0, zIndex: 100 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', color: '#000', fontSize: '20px', boxShadow: '0 0 16px rgba(16,185,129,0.4)' }}>
              V
            </div>
            <div>
              <div style={{ fontSize: '20px', fontWeight: '800', letterSpacing: '-0.5px' }}>VERITAS</div>
              <div style={{ fontSize: '10px', color: '#10B981', letterSpacing: '1px', textTransform: 'uppercase', fontWeight: '600' }}>Life Sciences eQMS</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button
              className={`${styles.btn} ${styles.btnSecondary}`}
              onClick={() => setShowLoginModal(true)}
              style={{ fontSize: '13px', padding: '8px 18px' }}
            >
              🔑 Member Sign In
            </button>
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={() => setShowRegisterModal(true)}
              style={{ fontSize: '13px', padding: '8px 22px', background: '#10B981', color: '#000', fontWeight: '700', boxShadow: '0 0 16px rgba(16,185,129,0.3)' }}
            >
              🏢 Register Organization
            </button>
          </div>
        </header>

        {/* Hero Section */}
        <section style={{ padding: '90px 40px 60px', maxWidth: '1200px', margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 18px', borderRadius: '20px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10B981', fontSize: '13px', fontWeight: '600', marginBottom: '28px' }}>
            ⚡ 21 CFR Part 11 & ISO 13485:2016 Compliant Architecture
          </div>

          <h1 style={{ fontSize: '56px', fontWeight: '900', lineHeight: '1.1', letterSpacing: '-1.5px', marginBottom: '24px', background: 'linear-gradient(180deg, #FFFFFF 0%, #9CA3AF 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Achieve 100% Audit Readiness &<br />Accelerate Time-to-Market
          </h1>

          <p style={{ fontSize: '18px', color: 'var(--text-muted)', maxWidth: '820px', margin: '0 auto 40px', lineHeight: '1.6' }}>
            Veritas replaces fragmented paper and legacy software with an automated, 21 CFR Part 11 compliant eQMS engineered specifically for Biotech, Pharma, and Medical Device innovators.
          </p>

          {/* Primary Registration / Login CTA Gating */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '18px', marginBottom: '64px', flexWrap: 'wrap' }}>
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={() => setShowRegisterModal(true)}
              style={{ fontSize: '16px', padding: '16px 36px', background: '#10B981', color: '#000', fontWeight: '800', borderRadius: '10px', boxShadow: '0 0 30px rgba(16,185,129,0.45)', cursor: 'pointer' }}
            >
              🏢 Provision Organization & Register →
            </button>
            <button
              className={`${styles.btn} ${styles.btnSecondary}`}
              onClick={() => setShowLoginModal(true)}
              style={{ fontSize: '16px', padding: '16px 32px', borderRadius: '10px', cursor: 'pointer' }}
            >
              🔑 Sign In to Existing Workspace
            </button>
          </div>

          {/* Compliance & ROI Metric Banner */}
          <div className="glass" style={{ padding: '28px 36px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '24px', textAlign: 'left' }}>
            <div>
              <div style={{ fontSize: '32px', fontWeight: '800', color: '#10B981' }}>21 CFR Part 11</div>
              <div style={{ fontSize: '13px', color: '#E5E7EB', fontWeight: '600', marginTop: '4px' }}>FDA Electronic Signatures</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Immutable SHA-256 audit logs</div>
            </div>
            <div>
              <div style={{ fontSize: '32px', fontWeight: '800', color: '#38BDF8' }}>ISO 13485:2016</div>
              <div style={{ fontSize: '13px', color: '#E5E7EB', fontWeight: '600', marginTop: '4px' }}>Medical Device QMS</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Automated design & risk controls</div>
            </div>
            <div>
              <div style={{ fontSize: '32px', fontWeight: '800', color: '#A855F7' }}>90% Faster</div>
              <div style={{ fontSize: '13px', color: '#E5E7EB', fontWeight: '600', marginTop: '4px' }}>SOP Release Cycles</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Automated approval routing</div>
            </div>
            <div>
              <div style={{ fontSize: '32px', fontWeight: '800', color: '#F59E0B' }}>0 Paper Risk</div>
              <div style={{ fontSize: '13px', color: '#E5E7EB', fontWeight: '600', marginTop: '4px' }}>Continuous Audit Readiness</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>1-Click FDA CSV export</div>
            </div>
          </div>
        </section>

        {/* Core Value Pillars Section */}
        <section style={{ padding: '70px 40px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: '52px' }}>
            <span style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#10B981', fontWeight: '700' }}>Comprehensive GxP Capabilities</span>
            <h2 style={{ fontSize: '36px', fontWeight: '800', marginTop: '8px' }}>
              Built to Solve Life Science Compliance Bottlenecks
            </h2>
            <p style={{ fontSize: '16px', color: 'var(--text-muted)', maxWidth: '680px', margin: '12px auto 0' }}>
              Eliminate manual spreadsheets, email sign-offs, and audit anxiety with purpose-built GxP workflows.
            </p>
          </div>

          <div className={styles.grid3} style={{ gap: '28px' }}>
            {/* Value Pillar 1 */}
            <div className={`${styles.card} ${styles.cardGlow}`}>
              <div style={{ fontSize: '32px', marginBottom: '14px' }}>📄</div>
              <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '10px' }}>Document Control & E-Signatures</h3>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                Complete document lifecycle management (Draft → In Review → Effective → Obsolete). Includes SHA-256 integrity checksums, role-based access clearance, and 21 CFR Part 11 compliant electronic signatures.
              </p>
            </div>

            {/* Value Pillar 2 */}
            <div className={`${styles.card} ${styles.cardGlow}`}>
              <div style={{ fontSize: '32px', marginBottom: '14px' }}>🎓</div>
              <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '10px' }}>Automated Training & Quiz Verification</h3>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                Maintain role-based training matrices seamlessly. Releasing an SOP automatically triggers employee training tasks with mandatory knowledge assessment quizzes before sign-off.
              </p>
            </div>

            {/* Value Pillar 3 */}
            <div className={`${styles.card} ${styles.cardGlow}`}>
              <div style={{ fontSize: '32px', marginBottom: '14px' }}>⚡</div>
              <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '10px' }}>Quality Events, Deviations & CAPA</h3>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                Log GxP non-conformances, perform 8D and 5-Why root cause investigations, assign corrective/preventive actions (CAPA), and track closures with electronic signature verification.
              </p>
            </div>

            {/* Value Pillar 4 */}
            <div className={`${styles.card} ${styles.cardGlow}`}>
              <div style={{ fontSize: '32px', marginBottom: '14px' }}>📦</div>
              <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '10px' }}>Supplier Quality Management (AVL)</h3>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                Approved Vendor List (AVL) with risk tiering (Critical/Major/Minor), annual vendor audit logs with Part 11 e-signatures, and incoming raw material inspection with auto-quarantine.
              </p>
            </div>

            {/* Value Pillar 5 */}
            <div className={`${styles.card} ${styles.cardGlow}`}>
              <div style={{ fontSize: '32px', marginBottom: '14px' }}>🔧</div>
              <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '10px' }}>Equipment Calibration & Maintenance</h3>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                Centralized equipment registry tracking calibration due dates, maintenance history, and automatic deviation generation whenever an instrument fails calibration.
              </p>
            </div>

            {/* Value Pillar 6 */}
            <div className={`${styles.card} ${styles.cardGlow}`}>
              <div style={{ fontSize: '32px', marginBottom: '14px' }}>🛡️</div>
              <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '10px' }}>21 CFR Part 11 Audit Trail Logs</h3>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                Immutable, chronological system audit logging recording timestamp, user ID, role, IP address, action, and JSON payload. Export audit trails to CSV instantly during FDA/EMA inspections.
              </p>
            </div>
          </div>
        </section>

        {/* Feature Comparison Matrix Section */}
        <section style={{ padding: '60px 40px', maxWidth: '1100px', margin: '0 auto', width: '100%' }}>
          <h2 style={{ fontSize: '30px', fontWeight: '800', textAlign: 'center', marginBottom: '12px' }}>
            Why Leading Life Sciences Teams Choose Veritas
          </h2>
          <p style={{ fontSize: '15px', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '36px' }}>
            Compare modern eQMS automation against legacy paper processes and generic cloud storage.
          </p>

          <div className="glass" style={{ borderRadius: '16px', padding: '24px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th style={{ width: '35%' }}>Capability / Feature</th>
                  <th style={{ width: '35%', color: '#10B981' }}>✨ Veritas eQMS</th>
                  <th style={{ width: '30%', color: 'var(--text-muted)' }}>Legacy / Manual Paper</th>
                </tr>
              </thead>
              <tbody>
                <tr className={styles.tableRow}>
                  <td><strong>FDA 21 CFR Part 11 Compliance</strong></td>
                  <td style={{ color: '#10B981', fontWeight: '600' }}>✓ Out-of-the-box (E-Sign + Hashes)</td>
                  <td style={{ color: '#F87171' }}>✗ High Risk / Manual Signatures</td>
                </tr>
                <tr className={styles.tableRow}>
                  <td><strong>SOP Release & Training Integration</strong></td>
                  <td style={{ color: '#10B981', fontWeight: '600' }}>✓ Automatic Training & Quizzes</td>
                  <td style={{ color: '#F87171' }}>✗ Manual Email Tracking</td>
                </tr>
                <tr className={styles.tableRow}>
                  <td><strong>Audit Trail Verification</strong></td>
                  <td style={{ color: '#10B981', fontWeight: '600' }}>✓ Immutable, 1-Click CSV Export</td>
                  <td style={{ color: '#F87171' }}>✗ Fragmented Binder Logs</td>
                </tr>
                <tr className={styles.tableRow}>
                  <td><strong>Supplier Quality & Material Quarantine</strong></td>
                  <td style={{ color: '#10B981', fontWeight: '600' }}>✓ Automated Deviation on Rejection</td>
                  <td style={{ color: '#F87171' }}>✗ Unlinked Inspection Sheets</td>
                </tr>
                <tr className={styles.tableRow}>
                  <td><strong>Deployment & Provisioning Time</strong></td>
                  <td style={{ color: '#10B981', fontWeight: '600' }}>✓ Instant Multi-Tenant Onboarding</td>
                  <td style={{ color: '#F87171' }}>✗ 6 to 12 Months Implementation</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Final Registration Banner */}
        <section style={{ padding: '80px 40px', background: 'radial-gradient(circle at 50% 50%, rgba(16,185,129,0.12) 0%, rgba(11,14,20,1) 80%)', borderTop: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '38px', fontWeight: '900', marginBottom: '16px' }}>
              Ready to Upgrade Your Quality System?
            </h2>
            <p style={{ fontSize: '17px', color: 'var(--text-muted)', marginBottom: '36px', lineHeight: '1.6' }}>
              Register your organization today and automatically seed your workspace with compliant SOP templates compliant with 21 CFR Part 11 and ISO 13485.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={() => setShowRegisterModal(true)}
                style={{ fontSize: '16px', padding: '16px 36px', background: '#10B981', color: '#000', fontWeight: '800', borderRadius: '10px' }}
              >
                🏢 Provision Organization & Register
              </button>
              <button
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={() => setShowLoginModal(true)}
                style={{ fontSize: '16px', padding: '16px 32px', borderRadius: '10px' }}
              >
                🔑 Sign In
              </button>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer style={{ padding: '30px 40px', borderTop: '1px solid rgba(255,255,255,0.08)', textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>
          Veritas eQMS — 21 CFR Part 11 & ISO 13485 Compliant Quality System | Secured by Neon PostgreSQL
        </footer>

        {/* Registration & Login Modals */}
        {showLoginModal && (
          <div className={styles.modalOverlay}>
            <div className={styles.modalContent} style={{ maxWidth: '520px' }}>
              <div className={styles.modalHeader}>
                <h3>Sign In to Veritas Workspace</h3>
                <button style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer' }} onClick={() => setShowLoginModal(false)}>×</button>
              </div>
              <div className={styles.modalBody}>
                {/* Enterprise SSO Buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnSecondary}`}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '12px', fontSize: '13px', background: 'rgba(255,255,255,0.04)' }}
                    onClick={() => alert('Microsoft 365 Enterprise SSO initiated. Contact your QA Admin to enable Azure AD Integration.')}
                  >
                    <svg width="18" height="18" viewBox="0 0 23 23"><path fill="#f35325" d="M1 1h10v10H1z"/><path fill="#81bc06" d="M12 1h10v10H12z"/><path fill="#05a6f0" d="M1 12h10v10H1z"/><path fill="#ffba08" d="M12 12h10v10H12z"/></svg>
                    Sign in with Microsoft 365 (Azure AD)
                  </button>
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnSecondary}`}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '12px', fontSize: '13px', background: 'rgba(255,255,255,0.04)' }}
                    onClick={() => alert('Google Workspace SSO initiated. Contact your QA Admin to enable Google Cloud Identity.')}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
                    Sign in with Google Workspace
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '20px 0', color: 'var(--text-muted)', fontSize: '12px' }}>
                  <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
                  <span>OR SIGN IN WITH EMAIL</span>
                  <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
                </div>

                {/* Standard Email Authentication Form */}
                <form onSubmit={async (e) => { e.preventDefault(); if (loginEmail) { const ok = await handleLoginUser(loginEmail); if (ok) setViewMode('app'); } }}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Work Email Address</label>
                    <input
                      className={styles.input}
                      type="email"
                      placeholder="user@company.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Password / MFA Code</label>
                    <input
                      className={styles.input}
                      type="password"
                      placeholder="••••••••••••"
                      defaultValue="demo123456"
                    />
                  </div>

                  <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} style={{ width: '100%', marginTop: '8px', padding: '12px', background: '#10B981', color: '#000', fontWeight: '700' }}>
                    🔒 Secure Sign In (21 CFR Part 11)
                  </button>
                </form>

                {/* Collapsible Sandbox Demo Persona Switcher (Development Only) */}
                <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <button
                    type="button"
                    onClick={() => setShowDemoPersonas(!showDemoPersonas)}
                    style={{ background: 'transparent', border: 'none', color: '#94A3B8', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', margin: '0 auto' }}
                  >
                    🧪 {showDemoPersonas ? 'Hide Sandbox Test Personas' : 'Development Sandbox: Switch Test Personas ▾'}
                  </button>

                  {showDemoPersonas && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '14px', background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <span style={{ fontSize: '11px', color: '#F59E0B', fontWeight: '700', textTransform: 'uppercase' }}>⚠️ Demo / Sandbox Persona Accounts</span>
                      {users.map((u) => (
                        <div
                          key={u.id}
                          onClick={() => { handleLoginUser(u.email); setViewMode('app'); }}
                          style={{
                            padding: '10px 12px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: currentUser?.email === u.email ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.02)',
                            border: currentUser?.email === u.email ? '1px solid #10B981' : '1px solid rgba(255,255,255,0.06)',
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: '600', fontSize: '13px' }}>{u.fullName}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{u.email} ({u.department})</div>
                          </div>
                          <span className={styles.currentBadge} style={{ fontSize: '10px' }}>{u.role}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setShowLoginModal(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {showRegisterModal && (
          <div className={styles.modalOverlay}>
            <div className={styles.modalContent} style={{ maxWidth: '650px' }}>
              <div className={styles.modalHeader}>
                <h3>Onboard New Organization & Quality Owner</h3>
                <button style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer' }} onClick={() => setShowRegisterModal(false)}>×</button>
              </div>
              <form onSubmit={async (e) => { const ok = await handleRegisterCompany(e); if (ok) setViewMode('app'); }}>
                <div className={styles.modalBody}>
                  {errorMessage && (
                    <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid #EF4444', color: '#F87171', padding: '10px 14px', borderRadius: '6px', fontSize: '13px', marginBottom: '16px' }}>
                      ⚠ {errorMessage}
                    </div>
                  )}
                  <div style={{ padding: '12px 16px', background: 'rgba(16,185,129,0.08)', borderRadius: '8px', border: '1px solid rgba(16,185,129,0.2)', marginBottom: '20px' }}>
                    <div style={{ fontWeight: '600', color: '#10B981', fontSize: '14px' }}>✨ Instant GxP Workspace Provisioning</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Registering creates your tenant organization and auto-generates your starter SOP library compliant with 21 CFR Part 11 and ISO 13485.
                    </div>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Company / Organization Name</label>
                    <input
                      className={styles.input}
                      type="text"
                      placeholder="e.g. Nova Therapeutics Inc."
                      value={regCompanyName}
                      onChange={(e) => setRegCompanyName(e.target.value)}
                      required
                    />
                  </div>

                  <div className={styles.grid2} style={{ margin: 0, gap: '12px' }}>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Quality Owner Full Name</label>
                      <input
                        className={styles.input}
                        type="text"
                        placeholder="e.g. Dr. Sarah Jenkins"
                        value={regFullName}
                        onChange={(e) => setRegFullName(e.target.value)}
                        required
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Work Email</label>
                      <input
                        className={styles.input}
                        type="email"
                        placeholder="sarah@novatx.com"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className={styles.grid3} style={{ margin: 0, gap: '12px' }}>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Department</label>
                      <select
                        className={styles.input}
                        value={regDepartment}
                        onChange={(e) => setRegDepartment(e.target.value)}
                      >
                        <option value="QA">Quality Assurance (QA)</option>
                        <option value="QC">Quality Control (QC)</option>
                        <option value="PRODUCTION">Manufacturing</option>
                        <option value="REGULATORY">Regulatory Affairs</option>
                      </select>
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>User Role</label>
                      <select
                        className={styles.input}
                        value={regRole}
                        onChange={(e) => setRegRole(e.target.value)}
                      >
                        <option value="OWNER">System Owner (Full Admin)</option>
                        <option value="ADMIN">QA Administrator</option>
                        <option value="AUDITOR">Auditor</option>
                      </select>
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Primary Standard</label>
                      <select
                        className={styles.input}
                        value={regGxPStandard}
                        onChange={(e) => setRegGxPStandard(e.target.value)}
                      >
                        <option value="21 CFR Part 11 / ISO 13485">21 CFR Part 11 & ISO 13485</option>
                        <option value="EU Annex 11 / GMP">EU Annex 11 & GMP</option>
                        <option value="ISO 9001 / GAMP 5">ISO 9001 & GAMP 5</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className={styles.modalFooter}>
                  <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setShowRegisterModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
                    Provision GxP Organization
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

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
            {/* Veritas Intelligence Health & Attention Center */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px', marginBottom: '24px' }}>
              {/* Veritas Intelligence Score */}
              <div className={`${styles.card} ${styles.cardGlow}`} style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(15,23,42,0.6) 100%)', border: '1px solid rgba(16,185,129,0.25)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#10B981', fontWeight: '700' }}>🛡️ Veritas Intelligence</span>
                  <span style={{ fontSize: '11px', background: 'rgba(16,185,129,0.15)', color: '#10B981', padding: '2px 8px', borderRadius: '4px', fontWeight: '700' }}>
                    {healthScore?.grade || 'A+'}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <div style={{ fontSize: '48px', fontWeight: '900', color: '#10B981', letterSpacing: '-1px' }}>
                    {healthScore?.overallScore ?? 98}%
                  </div>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Compliance Health</span>
                </div>

                <div style={{ fontSize: '13px', fontWeight: '600', color: '#E2E8F0', marginTop: '6px' }}>
                  {healthScore?.statusLabel || '100% Audit Ready — Continuous Compliance'}
                </div>

                <div style={{ marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                  Active Engine Check: FDA 21 CFR Part 11, EU Annex 11, ISO 13485:2016
                </div>
              </div>

              {/* What Requires My Attention Today? */}
              <div className={styles.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div className={styles.cardTitle} style={{ margin: 0 }}>⚡ What Requires My Attention Today?</div>
                  <a href="/api/reports/export?module=documents" target="_blank" className={`${styles.btn} ${styles.btnSecondary}`} style={{ fontSize: '12px', padding: '4px 10px' }}>
                    📥 Export GxP Audit Log (CSV)
                  </a>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
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
                    <div style={{ fontSize: '11px', color: '#EF4444', fontWeight: '700', textTransform: 'uppercase' }}>Open CAPAs</div>
                    <div style={{ fontSize: '24px', fontWeight: '800', color: '#FFF', marginTop: '4px' }}>{capas.filter(c => c.status !== 'CLOSED').length}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Active Actions</div>
                  </div>

                  <div style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)', padding: '12px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '11px', color: '#A855F7', fontWeight: '700', textTransform: 'uppercase' }}>Calibrations Due</div>
                    <div style={{ fontSize: '24px', fontWeight: '800', color: '#FFF', marginTop: '4px' }}>{equipmentList.filter(e => e.status === 'CALIBRATION_DUE').length}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Instruments</div>
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
                       (currentUser?.role === 'OWNER' || currentUser?.role === 'APPROVER' || currentUser?.role === 'ADMIN') && (
                        <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setShowApproveModal(true)}>
                          Execute E-Sign & Release
                        </button>
                      )}
                      
                      {selectedDoc.status === 'EFFECTIVE' && (
                        <a 
                          href={`/api/documents/${selectedDoc.id}/pdf`} 
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
                            ✓ Quiz Passed ({tr.quizResult?.score ?? 100}%)
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
                      Linked Docs: {cr.documents.map(d => (d.document?.title || 'Document').split(':')[0]).join(', ')}
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
                                <div style={{ fontWeight: '600' }}>{d.document?.title || 'Document'}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                  Current Status: <span style={{ color: d.document?.status === 'EFFECTIVE' ? '#10B981' : 'var(--warning)' }}>{d.document?.status || 'DRAFT'}</span>
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

        {/* TAB 8: SUPPLIERS (APPROVED VENDOR LIST) */}
        {activeTab === 'suppliers' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h2>Approved Vendor List (AVL) & Supplier Quality</h2>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Manage qualified vendors, audit records, risk classifications, and incoming material inspections (21 CFR 820.50 / ISO 13485).
                </span>
              </div>
              {(currentUser?.role === 'ADMIN' || currentUser?.role === 'OWNER' || currentUser?.department === 'QA') && (
                <button 
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  onClick={() => setShowCreateSupplierModal(true)}
                >
                  + Register New Supplier
                </button>
              )}
            </div>

            {/* Split Pane: Left = Supplier List, Right = Supplier Detail */}
            <div className={styles.grid2}>
              {/* Left Column: Supplier List */}
              <div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {suppliers.length > 0 ? (
                    suppliers.map((sup) => (
                      <div
                        key={sup.id}
                        className={styles.card}
                        onClick={() => setSelectedSupplierId(sup.id)}
                        style={{
                          cursor: 'pointer',
                          borderColor: selectedSupplierId === sup.id ? 'var(--secondary)' : 'rgba(255,255,255,0.06)'
                        }}
                      >
                        <div className={styles.cardTitle}>
                          <span>{sup.name}</span>
                          <span className={`${styles.badge} ${
                            sup.status === 'APPROVED' ? styles.badgeEffective :
                            sup.status === 'CONDITIONALLY_APPROVED' ? styles.badgeReview :
                            sup.status === 'DISQUALIFIED' ? styles.badgeObsolete : styles.badgeDraft
                          }`}>
                            {sup.status}
                          </span>
                        </div>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                          Category: <strong>{sup.category}</strong> | Risk: <strong style={{
                            color: sup.riskClassification === 'CRITICAL' ? 'var(--danger)' :
                                   sup.riskClassification === 'MAJOR' ? 'var(--warning)' : '#10B981'
                          }}>{sup.riskClassification}</strong>
                        </p>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
                          <span>Audits: {sup.audits?.length || 0} | Receipts: {sup.materialReceipts?.length || 0}</span>
                          <span style={{
                            color: new Date(sup.reEvaluationDueDate) < new Date() ? 'var(--danger)' : 'var(--text-muted)'
                          }}>
                            Re-eval: {new Date(sup.reEvaluationDueDate).toLocaleDateString()}
                            {new Date(sup.reEvaluationDueDate) < new Date() && ' ⚠ OVERDUE'}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="glass" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No suppliers registered yet.
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Selected Supplier Detail View */}
              <div>
                {selectedSupplier ? (
                  <div>
                    <h2>Supplier Detail: {selectedSupplier.name}</h2>
                    <div className={styles.card} style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      
                      {/* Header Info */}
                      <div className={styles.cardTitle}>
                        <span>{selectedSupplier.id} — {selectedSupplier.name}</span>
                        <span className={`${styles.badge} ${
                          selectedSupplier.status === 'APPROVED' ? styles.badgeEffective :
                          selectedSupplier.status === 'CONDITIONALLY_APPROVED' ? styles.badgeReview :
                          selectedSupplier.status === 'DISQUALIFIED' ? styles.badgeObsolete : styles.badgeDraft
                        }`}>
                          {selectedSupplier.status}
                        </span>
                      </div>

                      {/* Metadata Grid */}
                      <div className={styles.grid3} style={{ margin: 0, gap: '12px' }}>
                        <div>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Category</span>
                          <div style={{ fontWeight: '600' }}>{selectedSupplier.category}</div>
                        </div>
                        <div>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Risk Classification</span>
                          <div style={{
                            fontWeight: '700',
                            color: selectedSupplier.riskClassification === 'CRITICAL' ? 'var(--danger)' :
                                   selectedSupplier.riskClassification === 'MAJOR' ? 'var(--warning)' : '#10B981'
                          }}>
                            {selectedSupplier.riskClassification}
                          </div>
                        </div>
                        <div>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Contact Email</span>
                          <div style={{ fontWeight: '600', fontSize: '13px' }}>{selectedSupplier.contactEmail || 'N/A'}</div>
                        </div>
                      </div>

                      <div className={styles.grid3} style={{ margin: 0, gap: '12px' }}>
                        <div>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Qualified Date</span>
                          <div style={{ fontWeight: '600' }}>{new Date(selectedSupplier.qualificationDate).toLocaleDateString()}</div>
                        </div>
                        <div>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Re-Evaluation Due</span>
                          <div style={{
                            fontWeight: '600',
                            color: new Date(selectedSupplier.reEvaluationDueDate) < new Date() ? 'var(--danger)' : '#10B981'
                          }}>
                            {new Date(selectedSupplier.reEvaluationDueDate).toLocaleDateString()}
                            {new Date(selectedSupplier.reEvaluationDueDate) < new Date() && ' (OVERDUE)'}
                          </div>
                        </div>
                        <div>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Contact Phone</span>
                          <div style={{ fontWeight: '600', fontSize: '13px' }}>{selectedSupplier.contactPhone || 'N/A'}</div>
                        </div>
                      </div>

                      {selectedSupplier.notes && (
                        <div className="glass" style={{ padding: '12px 16px', background: 'rgba(0,0,0,0.15)' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Vendor Quality Notes</span>
                          <p style={{ fontSize: '13px', margin: 0 }}>{selectedSupplier.notes}</p>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div style={{ display: 'flex', gap: '12px' }}>
                        {(currentUser?.role === 'ADMIN' || currentUser?.role === 'OWNER' || currentUser?.role === 'AUDITOR') && (
                          <button
                            className={`${styles.btn} ${styles.btnPrimary}`}
                            onClick={() => setShowAuditSupplierModal(true)}
                          >
                            📋 Log Supplier Audit (E-Sign)
                          </button>
                        )}
                        <button
                          className={`${styles.btn} ${styles.btnSecondary}`}
                          onClick={() => setShowReceiptModal(true)}
                        >
                          📦 Log Material Inspection
                        </button>
                      </div>

                      {/* Audit Log History */}
                      <div>
                        <h4 style={{ marginBottom: '8px' }}>Supplier Audit History</h4>
                        {selectedSupplier.audits && selectedSupplier.audits.length > 0 ? (
                          <div className={styles.tableWrapper}>
                            <table className={styles.table}>
                              <thead>
                                <tr>
                                  <th>Audit Date</th>
                                  <th>Type</th>
                                  <th>Result</th>
                                  <th>Auditor</th>
                                  <th>E-Sign</th>
                                </tr>
                              </thead>
                              <tbody>
                                {selectedSupplier.audits.map((a) => (
                                  <tr key={a.id} className={styles.tableRow}>
                                    <td>{new Date(a.auditDate).toLocaleDateString()}</td>
                                    <td>
                                      <span className={`${styles.badge} ${styles.badgeDraft}`} style={{ fontSize: '10px' }}>
                                        {a.auditType}
                                      </span>
                                    </td>
                                    <td>
                                      <span style={{
                                        fontWeight: '700',
                                        color: a.result === 'PASS' ? '#10B981' :
                                               a.result === 'CONDITIONAL_PASS' ? 'var(--warning)' : 'var(--danger)'
                                      }}>{a.result}</span>
                                    </td>
                                    <td>{a.auditor?.fullName || 'Unknown'}</td>
                                    <td>
                                      {a.esignSignatureId ? (
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
                            No audits logged yet for this supplier.
                          </div>
                        )}
                      </div>

                      {/* Material Inspection Receipts */}
                      <div>
                        <h4 style={{ marginBottom: '8px' }}>Incoming Material Inspection Log</h4>
                        {selectedSupplier.materialReceipts && selectedSupplier.materialReceipts.length > 0 ? (
                          <div className={styles.tableWrapper}>
                            <table className={styles.table}>
                              <thead>
                                <tr>
                                  <th>Receipt Date</th>
                                  <th>Material Name</th>
                                  <th>Lot Number</th>
                                  <th>Qty</th>
                                  <th>Inspection Status</th>
                                  <th>Inspected By</th>
                                </tr>
                              </thead>
                              <tbody>
                                {selectedSupplier.materialReceipts.map((mr) => (
                                  <tr key={mr.id} className={styles.tableRow}>
                                    <td>{new Date(mr.receivedAt).toLocaleDateString()}</td>
                                    <td style={{ fontWeight: '600' }}>{mr.materialName}</td>
                                    <td><code>{mr.lotNumber}</code></td>
                                    <td>{mr.quantityReceived} {mr.unit}</td>
                                    <td>
                                      <span className={`${styles.badge} ${
                                        mr.inspectionStatus === 'PASSED' ? styles.badgeEffective :
                                        mr.inspectionStatus === 'QUARANTINE' ? styles.badgeReview : styles.badgeObsolete
                                      }`}>
                                        {mr.inspectionStatus}
                                      </span>
                                    </td>
                                    <td>{mr.inspectedBy?.fullName || 'QC Staff'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="glass" style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                            No material receipts logged for this supplier.
                          </div>
                        )}
                      </div>

                    </div>
                  </div>
                ) : (
                  <div className="glass" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', marginTop: '16px' }}>
                    Select a supplier from the Approved Vendor List to view qualification status, audit history, and incoming material receipts.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB: GxP AUDITS MANAGEMENT */}
        {activeTab === 'audits-management' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2>Internal & Supplier Audit Planning (GxP / ISO 13485)</h2>
              <a href="/api/reports/export?module=capa" target="_blank" className={`${styles.btn} ${styles.btnSecondary}`}>
                📥 Export Audit Readiness Report (CSV)
              </a>
            </div>

            <div className={styles.grid2}>
              {/* Scheduled Audit Plans */}
              <div className={styles.card}>
                <div className={styles.cardTitle}>Scheduled Audit Plans</div>
                <div className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Title / Scope</th>
                        <th>Type</th>
                        <th>Scheduled Date</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditPlans && auditPlans.length > 0 ? (
                        auditPlans.map((ap) => (
                          <tr key={ap.id} className={styles.tableRow}>
                            <td>
                              <div style={{ fontWeight: '600' }}>{ap.title}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{ap.scope}</div>
                            </td>
                            <td><span className={styles.currentBadge}>{ap.auditType}</span></td>
                            <td>{new Date(ap.scheduledDate).toLocaleDateString()}</td>
                            <td>
                              <span className={`${styles.badge} ${
                                ap.status === 'CLOSED' ? styles.badgeEffective :
                                ap.status === 'IN_PROGRESS' ? styles.badgeReview : styles.badgeDraft
                              }`}>
                                {ap.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                            No active audit plans scheduled.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Audit Findings & CAPA Linkages */}
              <div className={styles.card}>
                <div className={styles.cardTitle}>Regulatory Audit Findings & Evidence</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div className="glass" style={{ padding: '16px', borderRadius: '8px', background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)' }}>
                    <div style={{ fontWeight: '600', color: '#10B981', fontSize: '13px' }}>✓ EU GMP Annex 11 Clause 4 Readiness Check</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      All software change control records, document control versioning, and electronic signature manifests are verified and ready for regulatory inspection.
                    </div>
                  </div>

                  <div className="glass" style={{ padding: '16px', borderRadius: '8px', background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.2)' }}>
                    <div style={{ fontWeight: '600', color: '#3B82F6', fontSize: '13px' }}>✓ FDA 21 CFR Part 11 Audit Trail Integrity</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Immutable system audit trail logging active. SHA-256 integrity checksums verified across all document versions and e-signatures.
                    </div>
                  </div>
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
                <h2>Organization User Access, RBAC & ABAC Policy Management</h2>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Manage team members, site clearances, 13 default GxP security roles, and Segregation of Duties (SoD) policies.
                </p>
              </div>
              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={() => setShowInviteUserModal(true)}
                style={{ background: '#10B981', color: '#000', fontWeight: '700' }}
              >
                ➕ Invite Team Member & Assign Role
              </button>
            </div>

            {/* Segregation of Duties (SoD) Compliance Guard Banner */}
            <div className="glass" style={{ padding: '16px 20px', borderRadius: '12px', background: 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(15,23,42,0.6) 100%)', border: '1px solid rgba(16,185,129,0.25)', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px' }}>🛡️</span>
                <div>
                  <div style={{ fontWeight: '700', color: '#10B981', fontSize: '14px' }}>Segregation of Duties (SoD) Conflict Guard Active</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Veritas automatically enforces EU Annex 11 & 21 CFR Part 11 SoD policies: Authors cannot approve their own SOPs, investigators cannot close their own CAPAs, and deviation logs require independent QA sign-off.
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
                      <th>Actions</th>
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
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              className={`${styles.btn} ${styles.btnSecondary}`}
                              style={{ fontSize: '11px', padding: '4px 8px' }}
                              onClick={() => {
                                setEditingUser(u);
                                setEditRole(u.role);
                                setEditDept(u.department);
                                setShowEditUserModal(true);
                              }}
                            >
                              ✏️ Reassign Role
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Visual Permission Matrix (Roles × Permissions Grid) */}
            <div className={styles.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div className={styles.cardTitle} style={{ margin: 0 }}>📊 Visual Permission Matrix (13 System Roles × Permissions)</div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Configurable by Organization Owners</span>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
                Interactive security grid mapping all 13 default GxP system roles against granular permission scopes across Documents, Training, CAPA, Deviations, Audits, and System Administration.
              </p>

              <div className={styles.tableWrapper} style={{ maxHeight: '550px', overflowY: 'auto' }}>
                <table className={styles.table} style={{ fontSize: '12px' }}>
                  <thead>
                    <tr>
                      <th style={{ position: 'sticky', left: 0, background: '#0B0E14', zIndex: 10, minWidth: '180px' }}>Granular Permission</th>
                      {DEFAULT_SYSTEM_ROLES.map((r) => (
                        <th key={r.key} style={{ textAlign: 'center', minWidth: '95px', padding: '8px 4px' }}>
                          <div style={{ fontSize: '11px', fontWeight: '700', color: '#E2E8F0' }}>{r.name}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {SYSTEM_PERMISSIONS.map((perm) => (
                      <tr key={perm.key} className={styles.tableRow}>
                        <td style={{ position: 'sticky', left: 0, background: '#0B0E14', zIndex: 5, fontWeight: '600' }}>
                          <div>{perm.label}</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}><code>{perm.key}</code></div>
                        </td>
                        {DEFAULT_SYSTEM_ROLES.map((role) => {
                          const hasPerm = role.permissions.includes(perm.key);
                          return (
                            <td key={`${role.key}-${perm.key}`} style={{ textAlign: 'center' }}>
                              {hasPerm ? (
                                <span style={{ color: '#10B981', fontWeight: '800', fontSize: '15px' }}>✓</span>
                              ) : (
                                <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '14px' }}>-</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
                      If omitted, a standard 21 CFR Part 11 template PDF will be auto-generated for this document draft.
                    </span>
                  )}
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
                {errorMessage && (
                  <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid #EF4444', color: '#F87171', padding: '10px 14px', borderRadius: '6px', fontSize: '13px', marginBottom: '16px' }}>
                    ⚠ {errorMessage}
                  </div>
                )}
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

      {/* MODAL 11: REGISTER SUPPLIER */}
      {showCreateSupplierModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent} style={{ maxWidth: '600px' }}>
            <div className={styles.modalHeader}>
              <h3>Register New Supplier / Vendor</h3>
              <button style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer' }} onClick={() => setShowCreateSupplierModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreateSupplier}>
              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Supplier / Vendor Name</label>
                  <input
                    className={styles.input}
                    type="text"
                    placeholder="e.g. BioChem Solutions Inc."
                    value={newSupName}
                    onChange={(e) => setNewSupName(e.target.value)}
                    required
                  />
                </div>

                <div className={styles.grid2} style={{ margin: 0, gap: '12px' }}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Supplier Category</label>
                    <select
                      className={styles.input}
                      value={newSupCategory}
                      onChange={(e) => setNewSupCategory(e.target.value)}
                    >
                      <option value="RAW_MATERIAL">Raw Material Supplier</option>
                      <option value="PACKAGING">Packaging Vendor</option>
                      <option value="CONTRACT_LAB">Contract Testing Lab</option>
                      <option value="SOFTWARE">Software / SaaS Vendor</option>
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Risk Classification</label>
                    <select
                      className={styles.input}
                      value={newSupRisk}
                      onChange={(e) => setNewSupRisk(e.target.value)}
                    >
                      <option value="CRITICAL">CRITICAL (High Impact)</option>
                      <option value="MAJOR">MAJOR (Medium Impact)</option>
                      <option value="MINOR">MINOR (Low Impact)</option>
                    </select>
                  </div>
                </div>

                <div className={styles.grid2} style={{ margin: 0, gap: '12px' }}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Contact Email</label>
                    <input
                      className={styles.input}
                      type="email"
                      placeholder="qa@supplier.com"
                      value={newSupEmail}
                      onChange={(e) => setNewSupEmail(e.target.value)}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Contact Phone</label>
                    <input
                      className={styles.input}
                      type="text"
                      placeholder="+1 (555) 000-0000"
                      value={newSupPhone}
                      onChange={(e) => setNewSupPhone(e.target.value)}
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Re-Evaluation Interval (Days)</label>
                  <input
                    className={styles.input}
                    type="number"
                    value={newSupInterval}
                    onChange={(e) => setNewSupInterval(e.target.value)}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Vendor Quality Notes</label>
                  <textarea
                    className={styles.input}
                    rows={3}
                    placeholder="Quality agreement details, scope of supply, initial notes..."
                    value={newSupNotes}
                    onChange={(e) => setNewSupNotes(e.target.value)}
                    style={{ resize: 'vertical' }}
                  />
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setShowCreateSupplierModal(false)}>
                  Cancel
                </button>
                <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
                  Register Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 12: LOG SUPPLIER AUDIT (E-SIGNED) */}
      {showAuditSupplierModal && selectedSupplierId && selectedSupplier && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent} style={{ maxWidth: '600px' }}>
            <div className={styles.modalHeader}>
              <h3>Log Supplier Quality Audit</h3>
              <button style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer' }} onClick={() => setShowAuditSupplierModal(false)}>×</button>
            </div>
            <form onSubmit={handleAuditSupplier}>
              <div className={styles.modalBody}>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  Auditing Supplier: <strong style={{ color: '#fff' }}>{selectedSupplier.name}</strong> ({selectedSupplier.id})
                </div>

                <div className={styles.grid2} style={{ margin: 0, gap: '12px' }}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Audit Type</label>
                    <select
                      className={styles.input}
                      value={auditType}
                      onChange={(e) => setAuditType(e.target.value)}
                    >
                      <option value="ROUTINE_ANNUAL">Routine Annual Audit</option>
                      <option value="INITIAL_QUALIFICATION">Initial Qualification Audit</option>
                      <option value="FOR_CAUSE">For-Cause Audit</option>
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Audit Result</label>
                    <select
                      className={styles.input}
                      value={auditResult}
                      onChange={(e) => setAuditResult(e.target.value)}
                    >
                      <option value="PASS">PASS ✓ (Updates status to APPROVED)</option>
                      <option value="CONDITIONAL_PASS">CONDITIONAL PASS ⚠ (CONDITIONALLY APPROVED)</option>
                      <option value="FAIL">FAIL ✗ (DISQUALIFIED)</option>
                    </select>
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Audit Findings & Summary</label>
                  <textarea
                    className={styles.input}
                    rows={4}
                    placeholder="Document audit scope, findings, major/minor observations, CAPA requirements..."
                    value={auditFindings}
                    onChange={(e) => setAuditFindings(e.target.value)}
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
                    placeholder="Enter password to sign audit report"
                    value={auditPassword}
                    onChange={(e) => setAuditPassword(e.target.value)}
                    required
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    Signing certifies that this supplier audit was conducted according to GxP vendor qualification procedures.
                  </span>
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setShowAuditSupplierModal(false)}>
                  Cancel
                </button>
                <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
                  Submit E-Signed Audit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 13: LOG MATERIAL INSPECTION */}
      {showReceiptModal && selectedSupplierId && selectedSupplier && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent} style={{ maxWidth: '600px' }}>
            <div className={styles.modalHeader}>
              <h3>Log Incoming Material Inspection</h3>
              <button style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer' }} onClick={() => setShowReceiptModal(false)}>×</button>
            </div>
            <form onSubmit={handleMaterialReceipt}>
              <div className={styles.modalBody}>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  Material Source: <strong style={{ color: '#fff' }}>{selectedSupplier.name}</strong>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Material Name / Description</label>
                  <input
                    className={styles.input}
                    type="text"
                    placeholder="e.g. DMEM High Glucose Media (500mL)"
                    value={recMaterialName}
                    onChange={(e) => setRecMaterialName(e.target.value)}
                    required
                  />
                </div>

                <div className={styles.grid3} style={{ margin: 0, gap: '12px' }}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Lot / Batch Number</label>
                    <input
                      className={styles.input}
                      type="text"
                      placeholder="LOT-2026-X"
                      value={recLotNumber}
                      onChange={(e) => setRecLotNumber(e.target.value)}
                      required
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Quantity</label>
                    <input
                      className={styles.input}
                      type="number"
                      value={recQty}
                      onChange={(e) => setRecQty(e.target.value)}
                      required
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Unit</label>
                    <input
                      className={styles.input}
                      type="text"
                      placeholder="kg, L, bottles, units"
                      value={recUnit}
                      onChange={(e) => setRecUnit(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>QC Inspection Result</label>
                  <select
                    className={styles.input}
                    value={recInspectionStatus}
                    onChange={(e) => setRecInspectionStatus(e.target.value)}
                  >
                    <option value="PASSED">PASSED ✓ (Released to Inventory)</option>
                    <option value="QUARANTINE">QUARANTINE ⚠ (Pending Testing)</option>
                    <option value="REJECTED">REJECTED ✗ (Auto-triggers Deviation)</option>
                  </select>
                  {recInspectionStatus === 'REJECTED' && (
                    <span style={{ fontSize: '11px', color: 'var(--danger)', marginTop: '4px', display: 'block' }}>
                      ⚠ Rejecting an incoming material batch will auto-create a Quality Deviation.
                    </span>
                  )}
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>QC Inspection Notes / CoA Verification</label>
                  <textarea
                    className={styles.input}
                    rows={3}
                    placeholder="CoA verification notes, physical inspection observations..."
                    value={recNotes}
                    onChange={(e) => setRecNotes(e.target.value)}
                    style={{ resize: 'vertical' }}
                  />
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setShowReceiptModal(false)}>
                  Cancel
                </button>
                <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
                  Log Inspection Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL 14: PERSONA SWITCHER / LOGIN */}
      {showLoginModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent} style={{ maxWidth: '520px' }}>
            <div className={styles.modalHeader}>
              <h3>Sign In to Veritas Workspace</h3>
              <button style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer' }} onClick={() => setShowLoginModal(false)}>×</button>
            </div>
            <div className={styles.modalBody}>
              {/* Enterprise SSO Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnSecondary}`}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '12px', fontSize: '13px', background: 'rgba(255,255,255,0.04)' }}
                  onClick={() => alert('Microsoft 365 Enterprise SSO initiated. Contact your QA Admin to enable Azure AD Integration.')}
                >
                  <svg width="18" height="18" viewBox="0 0 23 23"><path fill="#f35325" d="M1 1h10v10H1z"/><path fill="#81bc06" d="M12 1h10v10H12z"/><path fill="#05a6f0" d="M1 12h10v10H1z"/><path fill="#ffba08" d="M12 12h10v10H12z"/></svg>
                  Sign in with Microsoft 365 (Azure AD)
                </button>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnSecondary}`}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '12px', fontSize: '13px', background: 'rgba(255,255,255,0.04)' }}
                  onClick={() => alert('Google Workspace SSO initiated. Contact your QA Admin to enable Google Cloud Identity.')}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
                  Sign in with Google Workspace
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '20px 0', color: 'var(--text-muted)', fontSize: '12px' }}>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
                <span>OR SIGN IN WITH EMAIL</span>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
              </div>

              {/* Standard Email Authentication Form */}
              <form onSubmit={async (e) => { e.preventDefault(); if (loginEmail) { const ok = await handleLoginUser(loginEmail); if (ok) setViewMode('app'); } }}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Work Email Address</label>
                  <input
                    className={styles.input}
                    type="email"
                    placeholder="user@company.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Password / MFA Code</label>
                  <input
                    className={styles.input}
                    type="password"
                    placeholder="••••••••••••"
                    defaultValue="demo123456"
                  />
                </div>

                <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} style={{ width: '100%', marginTop: '8px', padding: '12px', background: '#10B981', color: '#000', fontWeight: '700' }}>
                  🔒 Secure Sign In (21 CFR Part 11)
                </button>
              </form>

              {/* Collapsible Sandbox Demo Persona Switcher (Development Only) */}
              <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <button
                  type="button"
                  onClick={() => setShowDemoPersonas(!showDemoPersonas)}
                  style={{ background: 'transparent', border: 'none', color: '#94A3B8', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', margin: '0 auto' }}
                >
                  🧪 {showDemoPersonas ? 'Hide Sandbox Test Personas' : 'Development Sandbox: Switch Test Personas ▾'}
                </button>

                {showDemoPersonas && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '14px', background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontSize: '11px', color: '#F59E0B', fontWeight: '700', textTransform: 'uppercase' }}>⚠️ Demo / Sandbox Persona Accounts</span>
                    {users.map((u) => (
                      <div
                        key={u.id}
                        onClick={() => { handleLoginUser(u.email); setViewMode('app'); }}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          background: currentUser?.email === u.email ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.02)',
                          border: currentUser?.email === u.email ? '1px solid #10B981' : '1px solid rgba(255,255,255,0.06)',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: '600', fontSize: '13px' }}>{u.fullName}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{u.email} ({u.department})</div>
                        </div>
                        <span className={styles.currentBadge} style={{ fontSize: '10px' }}>{u.role}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setShowLoginModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 15: ORGANIZATION REGISTRATION & ONBOARDING */}
      {showRegisterModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent} style={{ maxWidth: '650px' }}>
            <div className={styles.modalHeader}>
              <h3>Onboard New Organization & Quality Owner</h3>
              <button style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer' }} onClick={() => setShowRegisterModal(false)}>×</button>
            </div>
            <form onSubmit={handleRegisterCompany}>
              <div className={styles.modalBody}>
                <div style={{ padding: '12px 16px', background: 'rgba(16,185,129,0.08)', borderRadius: '8px', border: '1px solid rgba(16,185,129,0.2)', marginBottom: '20px' }}>
                  <div style={{ fontWeight: '600', color: '#10B981', fontSize: '14px' }}>✨ Instant GxP Workspace Provisioning</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Registering creates your tenant organization and auto-generates your starter SOP library compliant with 21 CFR Part 11 and ISO 13485.
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Company / Organization Name</label>
                  <input
                    className={styles.input}
                    type="text"
                    placeholder="e.g. Nova Therapeutics Inc."
                    value={regCompanyName}
                    onChange={(e) => setRegCompanyName(e.target.value)}
                    required
                  />
                </div>

                <div className={styles.grid2} style={{ margin: 0, gap: '12px' }}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Quality Owner Full Name</label>
                    <input
                      className={styles.input}
                      type="text"
                      placeholder="e.g. Dr. Sarah Jenkins"
                      value={regFullName}
                      onChange={(e) => setRegFullName(e.target.value)}
                      required
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Work Email</label>
                    <input
                      className={styles.input}
                      type="email"
                      placeholder="sarah@novatx.com"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className={styles.grid3} style={{ margin: 0, gap: '12px' }}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Department</label>
                    <select
                      className={styles.input}
                      value={regDepartment}
                      onChange={(e) => setRegDepartment(e.target.value)}
                    >
                      <option value="QA">Quality Assurance (QA)</option>
                      <option value="QC">Quality Control (QC)</option>
                      <option value="PRODUCTION">Manufacturing</option>
                      <option value="REGULATORY">Regulatory Affairs</option>
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>User Role</label>
                    <select
                      className={styles.input}
                      value={regRole}
                      onChange={(e) => setRegRole(e.target.value)}
                    >
                      <option value="OWNER">System Owner (Full Admin)</option>
                      <option value="ADMIN">QA Administrator</option>
                      <option value="AUDITOR">Auditor</option>
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Primary Standard</label>
                    <select
                      className={styles.input}
                      value={regGxPStandard}
                      onChange={(e) => setRegGxPStandard(e.target.value)}
                    >
                      <option value="21 CFR Part 11 / ISO 13485">21 CFR Part 11 & ISO 13485</option>
                      <option value="EU Annex 11 / GMP">EU Annex 11 & GMP</option>
                      <option value="ISO 9001 / GAMP 5">ISO 9001 & GAMP 5</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setShowRegisterModal(false)}>
                  Cancel
                </button>
                <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
                  Provision GxP Organization
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

        {/* MODAL 16: INVITE TEAM MEMBER */}
        {showInviteUserModal && (
          <div className={styles.modalOverlay}>
            <div className={styles.modalContent} style={{ maxWidth: '600px' }}>
              <div className={styles.modalHeader}>
                <h3>Invite New Employee & Assign Role</h3>
                <button style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer' }} onClick={() => setShowInviteUserModal(false)}>×</button>
              </div>
              <form onSubmit={handleInviteUser}>
                <div className={styles.modalBody}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Full Name</label>
                    <input
                      className={styles.input}
                      type="text"
                      placeholder="e.g. Dr. Alex Mercer"
                      value={inviteFullName}
                      onChange={(e) => setInviteFullName(e.target.value)}
                      required
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Work Email</label>
                    <input
                      className={styles.input}
                      type="email"
                      placeholder="alex.mercer@biotech.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className={styles.grid2} style={{ margin: 0, gap: '12px' }}>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Assigned GxP Role</label>
                      <select
                        className={styles.input}
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value)}
                      >
                        <option value="EMPLOYEE">Employee (Standard User)</option>
                        <option value="QUALITY_MANAGER">Quality Manager (QMS Owner)</option>
                        <option value="QA_REVIEWER">QA Reviewer (Independent Review)</option>
                        <option value="DOCUMENT_OWNER">Document Owner (Author)</option>
                        <option value="DEPARTMENT_MANAGER">Department Manager</option>
                        <option value="TRAINING_COORDINATOR">Training Coordinator</option>
                        <option value="INVESTIGATOR">Investigator (Deviation / CAPA)</option>
                        <option value="APPROVER">Approver (21 CFR Part 11 Signatory)</option>
                        <option value="ADMIN">QA Administrator</option>
                        <option value="OWNER">Organization Owner</option>
                        <option value="EXTERNAL_AUDITOR">External Auditor (Temporary Read-Only)</option>
                        <option value="SUPPLIER">Supplier (External Vendor Portal)</option>
                        <option value="CONSULTANT">Consultant (Temporary Scope)</option>
                      </select>
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Department</label>
                      <select
                        className={styles.input}
                        value={inviteDept}
                        onChange={(e) => setInviteDept(e.target.value)}
                      >
                        <option value="QA">Quality Assurance (QA)</option>
                        <option value="QC">Quality Control (QC)</option>
                        <option value="PRODUCTION">Manufacturing</option>
                        <option value="REGULATORY">Regulatory Affairs</option>
                        <option value="ENGINEERING">Engineering & Calibration</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className={styles.modalFooter}>
                  <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setShowInviteUserModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} style={{ background: '#10B981', color: '#000', fontWeight: '700' }}>
                    ➕ Send Invitation & Assign Role
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 17: REASSIGN USER ROLE */}
        {showEditUserModal && editingUser && (
          <div className={styles.modalOverlay}>
            <div className={styles.modalContent} style={{ maxWidth: '550px' }}>
              <div className={styles.modalHeader}>
                <h3>Reassign GxP Role: {editingUser.fullName}</h3>
                <button style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer' }} onClick={() => setShowEditUserModal(false)}>×</button>
              </div>
              <form onSubmit={handleUpdateUserRole}>
                <div className={styles.modalBody}>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                    Target Email: <strong>{editingUser.email}</strong>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Assigned Role</label>
                    <select
                      className={styles.input}
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value)}
                    >
                      <option value="EMPLOYEE">Employee (Document Consumer / Trainee)</option>
                      <option value="APPROVER">Approver (Signatory)</option>
                      <option value="QUALITY_MANAGER">Quality Manager</option>
                      <option value="ADMIN">QA Administrator</option>
                      <option value="AUDITOR">Auditor (Read-Only Compliance)</option>
                      <option value="OWNER">Organization Owner</option>
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Department</label>
                    <select
                      className={styles.input}
                      value={editDept}
                      onChange={(e) => setEditDept(e.target.value)}
                    >
                      <option value="QA">Quality Assurance (QA)</option>
                      <option value="QC">Quality Control (QC)</option>
                      <option value="PRODUCTION">Manufacturing</option>
                      <option value="REGULATORY">Regulatory Affairs</option>
                      <option value="ENGINEERING">Engineering & Calibration</option>
                    </select>
                  </div>
                </div>
                <div className={styles.modalFooter}>
                  <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setShowEditUserModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
                    💾 Save Role Assignment
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </AppShell>
    );
  }


