export interface GranularPermission {
  key: string;
  domain: 'Documents' | 'Training' | 'CAPA' | 'Deviations' | 'Audits' | 'Administration';
  label: string;
  description: string;
}

export const SYSTEM_PERMISSIONS: GranularPermission[] = [
  // Documents
  { key: 'document.view', domain: 'Documents', label: 'View Effective SOPs', description: 'View released, effective controlled documents' },
  { key: 'document.create', domain: 'Documents', label: 'Create Document Draft', description: 'Create and draft new SOPs & policies' },
  { key: 'document.edit', domain: 'Documents', label: 'Edit Draft SOPs', description: 'Modify draft document content and metadata' },
  { key: 'document.submit', domain: 'Documents', label: 'Submit for Review', description: 'Submit document draft to quality review workflow' },
  { key: 'document.review', domain: 'Documents', label: 'QA Document Review', description: 'Perform independent quality review on submitted documents' },
  { key: 'document.approve', domain: 'Documents', label: 'Approve & Release (Part 11)', description: 'Execute 21 CFR Part 11 e-signature approval for document release' },
  { key: 'document.reject', domain: 'Documents', label: 'Reject Document Draft', description: 'Reject document revision and request rework' },
  { key: 'document.archive', domain: 'Documents', label: 'Archive / Retire SOP', description: 'Archive effective document and mark obsolete' },

  // Training
  { key: 'training.assign', domain: 'Training', label: 'Assign Training Requirements', description: 'Assign SOP training requirements to roles and departments' },
  { key: 'training.complete', domain: 'Training', label: 'Complete Training & Quizzes', description: 'Complete assigned SOP training and pass assessment quiz' },
  { key: 'training.verify', domain: 'Training', label: 'Verify Competency', description: 'Sign off and verify employee practical training competency' },
  { key: 'training.report', domain: 'Training', label: 'Export Training Matrix Report', description: 'Generate and export training matrix compliance reports' },

  // CAPA
  { key: 'capa.create', domain: 'CAPA', label: 'Log CAPA Action', description: 'Create new Corrective & Preventive Action record' },
  { key: 'capa.investigate', domain: 'CAPA', label: 'Perform Root Cause Analysis', description: 'Conduct 5-Why and 8D root cause investigation' },
  { key: 'capa.approve', domain: 'CAPA', label: 'Approve Action Plan', description: 'Approve proposed CAPA action plan' },
  { key: 'capa.close', domain: 'CAPA', label: 'Close CAPA Record', description: 'Verify effectiveness and close CAPA with e-signature' },

  // Deviations
  { key: 'deviation.create', domain: 'Deviations', label: 'Report GxP Deviation', description: 'Report non-conformance or planned deviation' },
  { key: 'deviation.investigate', domain: 'Deviations', label: 'Investigate Deviation', description: 'Investigate process deviation and assess quality impact' },
  { key: 'deviation.approve', domain: 'Deviations', label: 'Approve Deviation Closure', description: 'Approve deviation disposition and close event' },

  // Audits
  { key: 'audit.view', domain: 'Audits', label: 'View Audit Plans & Packs', description: 'Access audit plans, findings, and evidence packs' },
  { key: 'audit.create', domain: 'Audits', label: 'Create & Lead Audit Plan', description: 'Schedule internal and supplier audit plans' },
  { key: 'audit.report', domain: 'Audits', label: 'Export 21 CFR Part 11 Logs', description: 'Export chronological GxP audit trail logs to CSV' },

  // Administration
  { key: 'user.manage', domain: 'Administration', label: 'Manage Team & Assign Roles', description: 'Invite users, assign GxP security roles, and update site clearance' },
  { key: 'role.manage', domain: 'Administration', label: 'Configure Custom Roles & RBAC', description: 'Customize role permission matrices and SoD rules' },
  { key: 'settings.manage', domain: 'Administration', label: 'Configure Organization Settings', description: 'Manage subscription, SSO integration, and MFA policies' },
];

export interface SystemRoleDefinition {
  key: string;
  name: string;
  purpose: string;
  permissions: string[]; // Permission keys
  restrictions: string[];
}

export const DEFAULT_SYSTEM_ROLES: SystemRoleDefinition[] = [
  {
    key: 'PLATFORM_ADMIN',
    name: 'Platform Administrator',
    purpose: 'Internal Simpleafied platform maintenance & tenant health monitoring',
    permissions: ['settings.manage', 'audit.view'],
    restrictions: ['Cannot access customer regulated GxP data by default without explicit authorization log'],
  },
  {
    key: 'OWNER',
    name: 'Organization Owner',
    purpose: 'Business owner of the Veritas workspace & tenant configuration',
    permissions: ['user.manage', 'role.manage', 'settings.manage', 'document.view', 'training.report', 'audit.view', 'audit.report'],
    restrictions: ['Cannot automatically approve regulated records unless assigned as Approver'],
  },
  {
    key: 'QUALITY_MANAGER',
    name: 'Quality Manager',
    purpose: 'Highest operational compliance authority owning the eQMS',
    permissions: [
      'document.view', 'document.create', 'document.edit', 'document.submit', 'document.review', 'document.approve', 'document.reject', 'document.archive',
      'training.assign', 'training.verify', 'training.report',
      'capa.create', 'capa.investigate', 'capa.approve', 'capa.close',
      'deviation.create', 'deviation.investigate', 'deviation.approve',
      'audit.view', 'audit.create', 'audit.report', 'user.manage'
    ],
    restrictions: ['Subject to Segregation of Duties checks (cannot approve own documents)'],
  },
  {
    key: 'QA_REVIEWER',
    name: 'QA Reviewer',
    purpose: 'Independent quality review of controlled documents and CAPAs',
    permissions: ['document.view', 'document.review', 'document.reject', 'training.verify', 'capa.investigate', 'deviation.investigate', 'audit.view'],
    restrictions: ['Cannot modify system settings or create custom roles'],
  },
  {
    key: 'DOCUMENT_OWNER',
    name: 'Document Owner',
    purpose: 'Author and owner of controlled SOPs and policy drafts',
    permissions: ['document.view', 'document.create', 'document.edit', 'document.submit', 'training.complete'],
    restrictions: ['Cannot approve own documents for release'],
  },
  {
    key: 'DEPARTMENT_MANAGER',
    name: 'Department Manager',
    purpose: 'Manages department operations, member training, and task tracking',
    permissions: ['document.view', 'training.assign', 'training.report', 'deviation.create', 'capa.create'],
    restrictions: ['Cannot alter QMS release workflows or system configuration'],
  },
  {
    key: 'TRAINING_COORDINATOR',
    name: 'Training Coordinator',
    purpose: 'Manages organization training matrix, completion tracking, and reports',
    permissions: ['document.view', 'training.assign', 'training.verify', 'training.report'],
    restrictions: ['Cannot edit or approve controlled document contents'],
  },
  {
    key: 'INVESTIGATOR',
    name: 'Investigator',
    purpose: 'Conducts deviation and CAPA root cause investigations',
    permissions: ['document.view', 'capa.investigate', 'deviation.investigate', 'deviation.create'],
    restrictions: ['Cannot approve or close own investigations'],
  },
  {
    key: 'APPROVER',
    name: 'Approver',
    purpose: 'Executes 21 CFR Part 11 compliant electronic signature release approvals',
    permissions: ['document.view', 'document.review', 'document.approve', 'document.reject', 'capa.approve', 'deviation.approve'],
    restrictions: ['Cannot modify approved content post-signature'],
  },
  {
    key: 'EMPLOYEE',
    name: 'Employee',
    purpose: 'Standard user viewing effective SOPs and completing required training',
    permissions: ['document.view', 'training.complete', 'deviation.create'],
    restrictions: ['No approval or drafting permissions'],
  },
  {
    key: 'EXTERNAL_AUDITOR',
    name: 'External Auditor',
    purpose: 'Temporary read-only restricted access during regulatory inspections',
    permissions: ['document.view', 'training.report', 'audit.view', 'audit.report'],
    restrictions: ['Read-only. Expiration date strictly enforced. No modification permissions'],
  },
  {
    key: 'SUPPLIER',
    name: 'Supplier',
    purpose: 'External vendor portal for uploading CoA certificates and material specs',
    permissions: ['document.view'],
    restrictions: ['Restricted to assigned supplier folder scope'],
  },
  {
    key: 'CONSULTANT',
    name: 'Consultant',
    purpose: 'Temporary specialized access with configurable expiration date',
    permissions: ['document.view', 'document.create', 'document.edit', 'document.submit'],
    restrictions: ['Mandatory expiration date enforced'],
  },
];

// Segregation of Duties (SoD) Conflict Checker
export function checkSegregationOfDuties(params: {
  userId: string;
  action: 'document.approve' | 'capa.close' | 'deviation.approve';
  resource: {
    ownerId?: string;
    assignedToId?: string;
    detectedById?: string;
    investigatorId?: string;
  };
}): { allowed: boolean; warningMessage?: string } {
  const { userId, action, resource } = params;

  if (action === 'document.approve' && resource.ownerId === userId) {
    return {
      allowed: false,
      warningMessage: 'Segregation of Duties (SoD) Conflict: You cannot approve your own document draft. An independent QA Reviewer or Approver must execute release.',
    };
  }

  if (action === 'capa.close' && resource.assignedToId === userId) {
    return {
      allowed: false,
      warningMessage: 'Segregation of Duties (SoD) Conflict: You cannot close a CAPA action assigned to yourself. Quality Manager verification required.',
    };
  }

  if (action === 'deviation.approve' && (resource.detectedById === userId || resource.investigatorId === userId)) {
    return {
      allowed: false,
      warningMessage: 'Segregation of Duties (SoD) Conflict: You cannot approve a deviation that you logged or investigated.',
    };
  }

  return { allowed: true };
}

// ABAC Policy Evaluator
export function evaluateAbacPolicy(params: {
  user: {
    id: string;
    role: string;
    department: string;
    site: string;
    clearance: string;
    accountStatus: string;
    expiresAt?: Date | string | null;
  };
  resource: {
    department?: string;
    site?: string;
    classification?: string;
    status?: string;
  };
  permissionKey: string;
}): boolean {
  const { user, resource, permissionKey } = params;

  // 1. Account Status Check
  if (user.accountStatus !== 'ACTIVE') return false;

  // 2. Expiration Date Check (For Consultants / External Auditors)
  if (user.expiresAt && new Date(user.expiresAt) < new Date()) {
    return false;
  }

  // 3. Document Status Lifecycle Guard (Regular Employees only view EFFECTIVE documents)
  if (user.role === 'EMPLOYEE' && resource.status && resource.status !== 'EFFECTIVE') {
    return false;
  }

  // 4. Security Clearance Attribute Check
  if (resource.classification === 'RESTRICTED' && user.clearance !== 'RESTRICTED') {
    return false;
  }

  // 5. Site / Facility Attribute Check (If resource is site-scoped)
  if (resource.site && user.site !== resource.site && user.role !== 'OWNER' && user.role !== 'QUALITY_MANAGER' && user.role !== 'PLATFORM_ADMIN') {
    return false;
  }

  return true;
}
