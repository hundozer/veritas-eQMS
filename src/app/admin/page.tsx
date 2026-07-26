'use client';

import React, { useState, useEffect } from 'react';
import styles from '@/app/page.module.css';

interface TenantMetric {
  id: string;
  name: string;
  createdAt: string;
  userCount: number;
  docCount: number;
  deviationCount: number;
  capaCount: number;
  score: number;
  grade: string;
}

interface PlatformUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  department: string;
  clearance: string;
  tenantId: string;
  tenant: { name: string };
  createdAt: string;
}

interface GlobalRequirement {
  id: string;
  requirementId: string;
  regulationSourceId: string;
  chapter: string;
  section: string | null;
  title: string;
  category: string;
  riskLevel: string;
  requirementText: string;
  expectedEvidence: string;
  applicableAreas: string; // JSON string
  affectedProcesses: string; // JSON string
  status: string;
  changeType: string | null;
}

interface GlobalRegulation {
  id: string;
  regulationId: string;
  title: string;
  authority: string;
  region: string;
  version: string;
  latestAvailableVersion: string | null;
  status: string;
  sourceUrl: string | null;
  requirements: GlobalRequirement[];
}

export default function AdminPage() {
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [isGodMode, setIsGodMode] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [authenticating, setAuthenticating] = useState(false);

  // Nav state
  const [activeTab, setActiveTab] = useState<'overview' | 'tenants' | 'users' | 'regulations' | 'release' | 'audit'>('overview');

  // API Data states
  const [stats, setStats] = useState<any>(null);
  const [tenants, setTenants] = useState<TenantMetric[]>([]);
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [regulations, setRegulations] = useState<GlobalRegulation[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Telemetry search query
  const [searchAudit, setSearchAudit] = useState('');

  // Form states
  const [newTenantName, setNewTenantName] = useState('');
  const [provisioning, setProvisioning] = useState(false);
  const [provisionError, setProvisionError] = useState<string | null>(null);
  const [provisionSuccess, setProvisionSuccess] = useState<string | null>(null);

  // Global requirement form state
  const [editingRequirement, setEditingRequirement] = useState<Partial<GlobalRequirement> | null>(null);
  const [requirementFormOpen, setRequirementFormOpen] = useState(false);
  const [savingReq, setSavingReq] = useState(false);
  const [reqError, setReqError] = useState<string | null>(null);

  // Release publisher state
  const [pubRegulationId, setPubRegulationId] = useState('EU-GMP-VOL4');
  const [pubVersion, setPubVersion] = useState('2026.1');
  const [pubSummary, setPubSummary] = useState('');
  const [publishingUpdate, setPublishingUpdate] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);

  // Load active user session cookie
  useEffect(() => {
    const cookies = document.cookie.split(';');
    const emailCookie = cookies.find(c => c.trim().startsWith('user-email='));
    if (emailCookie) {
      const email = emailCookie.split('=')[1].trim();
      const decodedEmail = decodeURIComponent(email);
      // Validate if it is admin whitelisted
      const lower = decodedEmail.toLowerCase();
      if (lower.endsWith('@simpleafied.app') || lower.endsWith('@simpleafied.eu') || lower.endsWith('@simpleafied.de')) {
        setCurrentUserEmail(decodedEmail);
        setIsGodMode(lower === 'god@simpleafied.app' || lower === 'god@simpleafied.eu' || lower === 'god@simpleafied.de');
      }
    }
  }, []);

  // Fetch admin content when logged in
  useEffect(() => {
    if (currentUserEmail) {
      fetchStats();
      fetchTenants();
      fetchUsers();
      fetchRegulations();
      fetchAuditLogs();
    }
  }, [currentUserEmail]);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/stats');
      if (res.ok) setStats(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchTenants = async () => {
    try {
      const res = await fetch('/api/admin/tenants');
      if (res.ok) setTenants(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users');
      if (res.ok) setUsers(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchRegulations = async () => {
    try {
      const res = await fetch('/api/admin/regulations');
      if (res.ok) setRegulations(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchAuditLogs = async () => {
    try {
      // In a real app, query /api/audit or similar, here we search across audit logs.
      const res = await fetch('/api/audit/export?format=json');
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.logs || []);
      }
    } catch (e) { console.error(e); }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setAuthenticating(true);

    const email = loginEmail.trim();
    if (!email) {
      setLoginError('Email address is required');
      setAuthenticating(false);
      return;
    }

    const lower = email.toLowerCase();
    const isWhitelisted = lower.endsWith('@simpleafied.app') || lower.endsWith('@simpleafied.eu') || lower.endsWith('@simpleafied.de');
    if (!isWhitelisted) {
      setLoginError('Access Denied: Only Simpleafied operators (.app, .eu, .de) can sign in.');
      setAuthenticating(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: loginPassword }),
      });

      if (res.ok) {
        setCurrentUserEmail(email);
        setIsGodMode(lower === 'god@simpleafied.app' || lower === 'god@simpleafied.eu' || lower === 'god@simpleafied.de');
      } else {
        const errJson = await res.json();
        setLoginError(errJson.error?.message || 'Authentication failed');
      }
    } catch (err: any) {
      setLoginError(err.message);
    } finally {
      setAuthenticating(false);
    }
  };

  const handleLogout = () => {
    document.cookie = 'user-email=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    setCurrentUserEmail(null);
    setIsGodMode(false);
    setLoginEmail('');
    setLoginPassword('');
  };

  const handleProvisionTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setProvisionError(null);
    setProvisionSuccess(null);
    setProvisioning(true);

    try {
      const res = await fetch('/api/admin/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTenantName }),
      });

      if (res.ok) {
        setProvisionSuccess(`Corporate tenant "${newTenantName}" provisioned successfully.`);
        setNewTenantName('');
        fetchTenants();
        fetchStats();
      } else {
        const errJson = await res.json();
        setProvisionError(errJson.error?.message || 'Provisioning failed');
      }
    } catch (e: any) {
      setProvisionError(e.message);
    } finally {
      setProvisioning(false);
    }
  };

  const handlePromoteDemote = async (userId: string, targetRole: 'ADMIN' | 'EMPLOYEE') => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, newRole: targetRole }),
      });

      if (res.ok) {
        fetchUsers();
        fetchStats();
      } else {
        const json = await res.json();
        alert(json.error?.message || 'Promotion request failed');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveRequirement = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingReq(true);
    setReqError(null);

    const isEdit = !!editingRequirement?.id;
    const actionType = isEdit ? 'EDIT_REQUIREMENT' : 'CREATE_REQUIREMENT';

    try {
      const res = await fetch('/api/admin/regulations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: actionType,
          payload: editingRequirement,
        }),
      });

      if (res.ok) {
        setRequirementFormOpen(false);
        setEditingRequirement(null);
        fetchRegulations();
      } else {
        const json = await res.json();
        setReqError(json.error?.message || 'Failed to save requirement');
      }
    } catch (err: any) {
      setReqError(err.message);
    } finally {
      setSavingReq(false);
    }
  };

  const handleDeprecateRequirement = async (id: string) => {
    if (!confirm('Are you sure you want to deprecate this regulatory requirement? It will be marked as deprecated in the next update.')) return;

    try {
      const res = await fetch('/api/admin/regulations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'DELETE_REQUIREMENT',
          payload: { id },
        }),
      });

      if (res.ok) {
        fetchRegulations();
      } else {
        const json = await res.json();
        alert(json.error?.message || 'Deprecation failed');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePublishRelease = async (e: React.FormEvent) => {
    e.preventDefault();
    setPublishError(null);
    setPublishSuccess(null);
    setPublishingUpdate(true);

    try {
      const res = await fetch('/api/admin/updates/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          regulationId: pubRegulationId,
          newVersion: pubVersion,
          summary: pubSummary,
        }),
      });

      if (res.ok) {
        setPublishSuccess(`Update package published successfully! Version ${pubVersion} is now available to all tenants.`);
        setPubSummary('');
        fetchRegulations();
        fetchStats();
      } else {
        const json = await res.json();
        setPublishError(json.error?.message || 'Publish release failed');
      }
    } catch (err: any) {
      setPublishError(err.message);
    } finally {
      setPublishingUpdate(false);
    }
  };

  const filteredLogs = auditLogs.filter(log => {
    if (!searchAudit) return true;
    const query = searchAudit.toLowerCase();
    return (
      (log.action && log.action.toLowerCase().includes(query)) ||
      (log.userEmail && log.userEmail.toLowerCase().includes(query)) ||
      (log.objectType && log.objectType.toLowerCase().includes(query)) ||
      (log.status && log.status.toLowerCase().includes(query))
    );
  });

  // Login view if not authenticated as admin whitelisted
  if (!currentUserEmail) {
    return (
      <div className={styles.luxuryCanvas} style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0A0E17' }}>
        <div style={{ maxWidth: '480px', width: '100%', background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.08)', padding: '40px', boxShadow: '0 30px 60px rgba(0,0,0,0.4)' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ fontSize: '11px', fontWeight: '800', letterSpacing: '0.15em', color: '#059669', fontFamily: 'monospace', textTransform: 'uppercase', marginBottom: '8px' }}>
              INTERNAL PLATFORM OPERATIONS
            </div>
            <h2 style={{ fontSize: '26px', fontWeight: '900', color: '#FBFBFA', letterSpacing: '-0.02em', margin: 0 }}>
              Simpleafied Admin
            </h2>
            <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '6px' }}>
              Authorized operations personnel authentication terminal.
            </p>
          </div>

          {loginError && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', padding: '12px 16px', color: '#EF4444', fontSize: '12px', fontFamily: 'monospace', marginBottom: '20px' }}>
              ⚠ {loginError}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', color: '#94A3B8', fontFamily: 'monospace', marginBottom: '8px', textTransform: 'uppercase' }}>
                Operator Email Address
              </label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="operator@simpleafied.app"
                required
                style={{ width: '100%', background: 'rgba(10,14,23,0.5)', border: '1px solid rgba(255,255,255,0.12)', color: '#FBFBFA', padding: '14px', fontSize: '14px', borderRadius: '0px', fontFamily: 'monospace', outline: 'none' }}
              />
            </div>

            <div style={{ marginBottom: '28px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', color: '#94A3B8', fontFamily: 'monospace', marginBottom: '8px', textTransform: 'uppercase' }}>
                Secret Security Key
              </label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••••••••••"
                required
                style={{ width: '100%', background: 'rgba(10,14,23,0.5)', border: '1px solid rgba(255,255,255,0.12)', color: '#FBFBFA', padding: '14px', fontSize: '14px', borderRadius: '0px', fontFamily: 'monospace', outline: 'none' }}
              />
            </div>

            <button
              type="submit"
              disabled={authenticating}
              style={{
                width: '100%',
                background: '#059669',
                color: '#FBFBFA',
                border: 'none',
                padding: '16px',
                fontSize: '13px',
                fontWeight: '700',
                fontFamily: 'monospace',
                letterSpacing: '0.08em',
                cursor: authenticating ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {authenticating ? 'VERIFYING SECURITY TOKENS…' : 'INITIALIZE ADMIN SESSION →'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.luxuryCanvas} style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#0A0E17', color: '#FBFBFA' }}>
      
      {/* Platform Ops Header */}
      <header style={{ background: '#070A10', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '16px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '10px', fontWeight: '800', letterSpacing: '0.12em', color: '#059669', fontFamily: 'monospace' }}>
              SIMPLEAFIED SYSTEM OPERATIONS
            </div>
            <h1 style={{ fontSize: '18px', fontWeight: '900', color: '#FBFBFA', margin: 0, letterSpacing: '-0.01em' }}>
              Command Center
            </h1>
          </div>
          {isGodMode && (
            <span style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#EF4444', fontSize: '10px', fontWeight: '800', letterSpacing: '0.08em', padding: '3px 8px', fontFamily: 'monospace' }}>
              ⚡ GOD MODE ACTIVE
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: '#94A3B8', fontFamily: 'monospace' }}>OPERATOR ID</div>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#FBFBFA', fontFamily: 'monospace' }}>{currentUserEmail}</div>
          </div>
          <button
            onClick={handleLogout}
            style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: '#94A3B8', padding: '8px 16px', fontSize: '11px', fontFamily: 'monospace', fontWeight: '700', cursor: 'pointer' }}
          >
            END SESSION
          </button>
        </div>
      </header>

      {/* Admin Tab Navigation */}
      <div style={{ display: 'flex', background: '#0F172A', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 40px' }}>
        {[
          { id: 'overview', label: '📊 SYSTEM OVERVIEW' },
          { id: 'tenants', label: '🏢 TENANTS REGISTRY' },
          { id: 'users', label: '👥 USER & ACCESS' },
          { id: 'regulations', label: '📚 REGULATORY AUTHORITY' },
          { id: 'release', label: '🚀 RELEASE MANAGER' },
          { id: 'audit', label: '🛡️ SECURITY AUDIT TRAIL' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              padding: '16px 24px',
              fontSize: '11px',
              fontWeight: '700',
              fontFamily: 'monospace',
              letterSpacing: '0.05em',
              background: activeTab === tab.id ? '#0A0E17' : 'transparent',
              color: activeTab === tab.id ? '#059669' : '#94A3B8',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid #059669' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Admin Area */}
      <main style={{ flex: 1, padding: '40px' }}>
        
        {/* 1. OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div>
            <h3 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '24px', letterSpacing: '-0.01em' }}>Platform Telemetry</h3>
            
            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', marginBottom: '40px' }}>
              {[
                { title: 'TOTAL TENANTS', val: stats?.tenantCount ?? '—', desc: 'Corporate organizations active' },
                { title: 'TOTAL USERS', val: stats?.userCount ?? '—', desc: 'Registered platform users' },
                { title: 'SOP DOCUMENTS', val: stats?.documentCount ?? '—', desc: 'Controlled files in catalog' },
                { title: 'SYSTEM AUDIT LOGS', val: stats?.auditLogCount ?? '—', desc: '21 CFR Part 11 transaction logs' },
              ].map((kpi, idx) => (
                <div key={idx} style={{ background: '#0F172A', border: '1px solid rgba(255,255,255,0.06)', padding: '24px' }}>
                  <div style={{ fontSize: '10px', fontWeight: '700', color: '#94A3B8', fontFamily: 'monospace', letterSpacing: '0.08em', marginBottom: '8px' }}>{kpi.title}</div>
                  <div style={{ fontSize: '32px', fontWeight: '900', color: '#FBFBFA', fontFamily: 'monospace', marginBottom: '4px' }}>{kpi.val}</div>
                  <div style={{ fontSize: '12px', color: '#64748B' }}>{kpi.desc}</div>
                </div>
              ))}
            </div>

            {/* Health & Database details */}
            <div style={{ background: '#0F172A', border: '1px solid rgba(255,255,255,0.06)', padding: '24px', marginBottom: '40px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: '700', letterSpacing: '0.06em', fontFamily: 'monospace', color: '#94A3B8', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px' }}>
                DATABASE INSTANCE DETAILS
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#64748B', fontFamily: 'monospace' }}>TELEMETRY STATUS</div>
                  <div style={{ fontSize: '15px', fontWeight: '700', color: '#059669', marginTop: '4px' }}>● {stats?.databaseStatus ?? 'CONNECTED'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#64748B', fontFamily: 'monospace' }}>DATACENTER REGION</div>
                  <div style={{ fontSize: '15px', fontWeight: '700', color: '#FBFBFA', marginTop: '4px' }}>{stats?.region ?? 'AWS eu-central-1'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#64748B', fontFamily: 'monospace' }}>PLATFORM UPTIME SLA</div>
                  <div style={{ fontSize: '15px', fontWeight: '700', color: '#FBFBFA', marginTop: '4px' }}>{stats?.systemUptime ?? '99.99%'}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. TENANTS REGISTRY */}
        {activeTab === 'tenants' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '40px' }}>
              {/* List */}
              <div>
                <h3 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '24px', letterSpacing: '-0.01em' }}>Registered Customer Organizations</h3>
                <div style={{ background: '#0F172A', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)' }}>
                        {['Tenant ID', 'Company Name', 'Created Date', 'Users', 'SOPs', 'Maturity Baseline'].map(h => (
                          <th key={h} style={{ padding: '16px 20px', textAlign: 'left', fontWeight: '700', fontFamily: 'monospace', color: '#94A3B8', fontSize: '11px' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tenants.map(tenant => (
                        <tr key={tenant.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding: '16px 20px', fontFamily: 'monospace', color: '#94A3B8', fontSize: '11px' }}>{tenant.id.substring(0, 8)}...</td>
                          <td style={{ padding: '16px 20px', fontWeight: '800' }}>{tenant.name}</td>
                          <td style={{ padding: '16px 20px', color: '#94A3B8' }}>{new Date(tenant.createdAt).toLocaleDateString()}</td>
                          <td style={{ padding: '16px 20px', fontFamily: 'monospace' }}>{tenant.userCount}</td>
                          <td style={{ padding: '16px 20px', fontFamily: 'monospace' }}>{tenant.docCount}</td>
                          <td style={{ padding: '16px 20px' }}>
                            <span style={{
                              padding: '4px 10px',
                              fontSize: '11px',
                              fontWeight: '700',
                              fontFamily: 'monospace',
                              background: tenant.score >= 90 ? 'rgba(4,120,87,0.12)' : 'rgba(245,158,11,0.12)',
                              color: tenant.score >= 90 ? '#047857' : '#D97706',
                              border: `1px solid ${tenant.score >= 90 ? 'rgba(4,120,87,0.3)' : 'rgba(245,158,11,0.3)'}`,
                            }}>
                              {tenant.score}% ({tenant.grade})
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Provisioning Form */}
              <div>
                <h3 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '24px', letterSpacing: '-0.01em' }}>Provision Workspace</h3>
                <div style={{ background: '#0F172A', border: '1px solid rgba(255,255,255,0.06)', padding: '24px' }}>
                  {provisionError && (
                    <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', padding: '12px', fontSize: '12px', color: '#EF4444', fontFamily: 'monospace', marginBottom: '16px' }}>
                      {provisionError}
                    </div>
                  )}
                  {provisionSuccess && (
                    <div style={{ background: 'rgba(5,150,105,0.1)', border: '1px solid rgba(5,150,105,0.2)', padding: '12px', fontSize: '12px', color: '#10B981', fontFamily: 'monospace', marginBottom: '16px' }}>
                      {provisionSuccess}
                    </div>
                  )}

                  <form onSubmit={handleProvisionTenant}>
                    <div style={{ marginBottom: '20px' }}>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#94A3B8', fontFamily: 'monospace', marginBottom: '8px', textTransform: 'uppercase' }}>
                        Tenant/Company Name
                      </label>
                      <input
                        type="text"
                        value={newTenantName}
                        onChange={(e) => setNewTenantName(e.target.value)}
                        placeholder="e.g. BioHelix Therapeutics"
                        required
                        style={{ width: '100%', background: 'rgba(10,14,23,0.5)', border: '1px solid rgba(255,255,255,0.12)', color: '#FBFBFA', padding: '12px', fontSize: '13px' }}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={provisioning}
                      style={{
                        width: '100%',
                        background: '#059669',
                        color: '#FBFBFA',
                        border: 'none',
                        padding: '12px',
                        fontSize: '12px',
                        fontFamily: 'monospace',
                        fontWeight: '700',
                        cursor: provisioning ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {provisioning ? 'PROVISIONING…' : '⚡ INITIALIZE CORPORATE TENANT'}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. USER MANAGEMENT TAB */}
        {activeTab === 'users' && (
          <div>
            <h3 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '12px', letterSpacing: '-0.01em' }}>Platform Accounts Registry</h3>
            <p style={{ fontSize: '13px', color: '#94A3B8', marginBottom: '24px' }}>
              Overview of all active accounts in the database. Simpleafied whitelisted domains (`.app`, `.eu`, `.de`) can be promoted to Platform Admin.
            </p>

            <div style={{ background: '#0F172A', border: '1px solid rgba(255,255,255,0.06)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)' }}>
                    {['Name', 'Email Address', 'Tenant Workspace', 'GxP Department', 'Platform Role', 'Admin Privileges', 'Operator Designation'].map(h => (
                      <th key={h} style={{ padding: '16px 20px', textAlign: 'left', fontWeight: '700', fontFamily: 'monospace', color: '#94A3B8', fontSize: '11px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => {
                    const isCandidate = u.email.endsWith('@simpleafied.app') || u.email.endsWith('@simpleafied.eu') || u.email.endsWith('@simpleafied.de');
                    const isUserAdmin = u.role === 'ADMIN';

                    return (
                      <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '16px 20px', fontWeight: '700' }}>{u.fullName}</td>
                        <td style={{ padding: '16px 20px', fontFamily: 'monospace', color: '#94A3B8' }}>{u.email}</td>
                        <td style={{ padding: '16px 20px' }}>{u.tenant?.name || 'Global'}</td>
                        <td style={{ padding: '16px 20px', fontFamily: 'monospace', color: '#94A3B8', fontSize: '11px' }}>{u.department}</td>
                        <td style={{ padding: '16px 20px', fontFamily: 'monospace' }}>{u.role}</td>
                        <td style={{ padding: '16px 20px' }}>
                          {isUserAdmin ? (
                            <span style={{ color: '#10B981', fontWeight: '700', fontSize: '12px' }}>✓ ACTIVE ADMIN</span>
                          ) : isCandidate ? (
                            <span style={{ color: '#D97706', fontWeight: '700', fontSize: '12px' }}>⚠ ELIGIBLE CANDIDATE</span>
                          ) : (
                            <span style={{ color: '#64748B' }}>No (Customer)</span>
                          )}
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                          {isCandidate ? (
                            isGodMode ? (
                              isUserAdmin ? (
                                <button
                                  onClick={() => handlePromoteDemote(u.id, 'EMPLOYEE')}
                                  style={{ background: '#DC2626', color: '#FFF', border: 'none', padding: '6px 12px', fontSize: '11px', fontFamily: 'monospace', fontWeight: '700', cursor: 'pointer' }}
                                >
                                  REVOKE ADMIN
                                </button>
                              ) : (
                                <button
                                  onClick={() => handlePromoteDemote(u.id, 'ADMIN')}
                                  style={{ background: '#059669', color: '#FFF', border: 'none', padding: '6px 12px', fontSize: '11px', fontFamily: 'monospace', fontWeight: '700', cursor: 'pointer' }}
                                >
                                  DESIGNATE ADMIN
                                </button>
                              )
                            ) : (
                              <span style={{ fontSize: '11px', color: '#64748B', fontFamily: 'monospace' }}>Promotions require God Mode</span>
                            )
                          ) : (
                            <span style={{ fontSize: '11px', color: '#64748B', fontFamily: 'monospace' }}>Domain restriction active</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. REGULATORY AUTHORITY (MOAT EDITOR) */}
        {activeTab === 'regulations' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div>
                <h3 style={{ fontSize: '20px', fontWeight: '800', margin: 0, letterSpacing: '-0.01em' }}>Global Regulations Database</h3>
                <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '4px' }}>
                  Manage the core regulatory taxonomy and requirements seeded globally across all tenants.
                </p>
              </div>
              <button
                onClick={() => {
                  const firstReg = regulations[0];
                  setEditingRequirement({
                    regulationSourceId: firstReg?.id || '',
                    requirementId: `EU-GMP-CH${regulations[0]?.requirements.length + 1 || 1}-001`,
                    chapter: 'Chapter 4: Documentation',
                    section: '4.1',
                    title: '',
                    category: 'Documentation',
                    riskLevel: 'MAJOR',
                    requirementText: '',
                    expectedEvidence: '',
                    applicableAreas: '["Quality Assurance"]',
                    affectedProcesses: '["Document Management"]',
                  });
                  setReqError(null);
                  setRequirementFormOpen(true);
                }}
                style={{ background: '#059669', color: '#FFF', border: 'none', padding: '12px 24px', fontSize: '12px', fontFamily: 'monospace', fontWeight: '700', cursor: 'pointer' }}
              >
                + ADD REQUIREMENT
              </button>
            </div>

            {/* List */}
            {regulations.map(reg => (
              <div key={reg.id} style={{ marginBottom: '40px', border: '1px solid rgba(255,255,255,0.06)', background: '#0F172A', padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '16px', marginBottom: '20px' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: '#059669', fontWeight: '700', fontFamily: 'monospace' }}>{reg.authority}</span>
                    <h4 style={{ fontSize: '18px', fontWeight: '800', margin: '4px 0 0', color: '#FBFBFA' }}>{reg.title}</h4>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '11px', color: '#94A3B8', fontFamily: 'monospace' }}>VERSION: {reg.version}</div>
                    {reg.latestAvailableVersion && (
                      <div style={{ fontSize: '11px', color: '#D97706', fontFamily: 'monospace', marginTop: '2px' }}>PENDING: {reg.latestAvailableVersion}</div>
                    )}
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid rgba(255,255,255,0.06)', color: '#94A3B8', fontFamily: 'monospace' }}>
                        {['Code', 'Chapter / Section', 'Title', 'Risk', 'Category', 'Modified State', 'Actions'].map(h => (
                          <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: '700' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {reg.requirements.map(reqItem => (
                        <tr key={reqItem.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding: '12px 12px', fontFamily: 'monospace', fontWeight: '700', color: '#059669' }}>{reqItem.requirementId}</td>
                          <td style={{ padding: '12px 12px' }}>
                            <div style={{ fontWeight: '700' }}>{reqItem.chapter}</div>
                            <div style={{ color: '#94A3B8', fontSize: '11px' }}>Sec: {reqItem.section}</div>
                          </td>
                          <td style={{ padding: '12px 12px', fontWeight: '700' }}>{reqItem.title}</td>
                          <td style={{ padding: '12px 12px', fontFamily: 'monospace' }}>
                            <span style={{
                              color: reqItem.riskLevel === 'CRITICAL' ? '#EF4444' : reqItem.riskLevel === 'MAJOR' ? '#F59E0B' : '#3B82F6',
                            }}>{reqItem.riskLevel}</span>
                          </td>
                          <td style={{ padding: '12px 12px', color: '#94A3B8' }}>{reqItem.category}</td>
                          <td style={{ padding: '12px 12px', fontFamily: 'monospace' }}>
                            {reqItem.changeType ? (
                              <span style={{
                                padding: '2px 6px',
                                fontSize: '10px',
                                background: reqItem.changeType === 'NEW' ? 'rgba(4,120,87,0.15)' : 'rgba(59,130,246,0.15)',
                                color: reqItem.changeType === 'NEW' ? '#10B981' : '#3B82F6',
                              }}>{reqItem.changeType} (PENDING PUBLISH)</span>
                            ) : (
                              <span style={{ color: '#64748B' }}>RELEASED</span>
                            )}
                          </td>
                          <td style={{ padding: '12px 12px' }}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                onClick={() => {
                                  setEditingRequirement(reqItem);
                                  setReqError(null);
                                  setRequirementFormOpen(true);
                                }}
                                style={{ background: '#0F172A', color: '#FFF', border: '1px solid rgba(255,255,255,0.15)', padding: '4px 10px', fontSize: '11px', cursor: 'pointer' }}
                              >
                                EDIT
                              </button>
                              <button
                                onClick={() => handleDeprecateRequirement(reqItem.id)}
                                style={{ background: 'transparent', color: '#EF4444', border: 'none', padding: '4px 8px', fontSize: '11px', cursor: 'pointer' }}
                              >
                                DEPRECATE
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}

            {/* Editor Modal */}
            {requirementFormOpen && editingRequirement && (
              <div className={styles.modalOverlay} style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 100 }}>
                <div className={styles.modalContent} style={{ maxWidth: '700px', background: '#0F172A', border: '1px solid rgba(255,255,255,0.1)', color: '#FBFBFA', padding: '32px' }}>
                  <h3 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '20px' }}>
                    {editingRequirement.id ? 'Edit Global Requirement' : 'Add New Global Requirement'}
                  </h3>

                  {reqError && (
                    <div style={{ padding: '12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444', fontSize: '12px', fontFamily: 'monospace', marginBottom: '16px' }}>
                      {reqError}
                    </div>
                  )}

                  <form onSubmit={handleSaveRequirement}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', fontFamily: 'monospace', marginBottom: '6px' }}>REQUIREMENT ID</label>
                        <input
                          type="text"
                          disabled={!!editingRequirement.id}
                          value={editingRequirement.requirementId || ''}
                          onChange={(e) => setEditingRequirement({ ...editingRequirement, requirementId: e.target.value })}
                          required
                          style={{ width: '100%', background: '#0A0E17', border: '1px solid rgba(255,255,255,0.12)', color: '#FFF', padding: '10px', fontSize: '13px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', fontFamily: 'monospace', marginBottom: '6px' }}>SECTION</label>
                        <input
                          type="text"
                          value={editingRequirement.section || ''}
                          onChange={(e) => setEditingRequirement({ ...editingRequirement, section: e.target.value })}
                          placeholder="e.g. 4.1"
                          style={{ width: '100%', background: '#0A0E17', border: '1px solid rgba(255,255,255,0.12)', color: '#FFF', padding: '10px', fontSize: '13px' }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', fontFamily: 'monospace', marginBottom: '6px' }}>CHAPTER</label>
                        <input
                          type="text"
                          value={editingRequirement.chapter || ''}
                          onChange={(e) => setEditingRequirement({ ...editingRequirement, chapter: e.target.value })}
                          placeholder="e.g. Chapter 4: Documentation"
                          required
                          style={{ width: '100%', background: '#0A0E17', border: '1px solid rgba(255,255,255,0.12)', color: '#FFF', padding: '10px', fontSize: '13px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', fontFamily: 'monospace', marginBottom: '6px' }}>TITLE</label>
                        <input
                          type="text"
                          value={editingRequirement.title || ''}
                          onChange={(e) => setEditingRequirement({ ...editingRequirement, title: e.target.value })}
                          required
                          style={{ width: '100%', background: '#0A0E17', border: '1px solid rgba(255,255,255,0.12)', color: '#FFF', padding: '10px', fontSize: '13px' }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', fontFamily: 'monospace', marginBottom: '6px' }}>CATEGORY</label>
                        <select
                          value={editingRequirement.category || 'Quality System'}
                          onChange={(e) => setEditingRequirement({ ...editingRequirement, category: e.target.value })}
                          style={{ width: '100%', background: '#0A0E17', border: '1px solid rgba(255,255,255,0.12)', color: '#FFF', padding: '10px', fontSize: '13px' }}
                        >
                          {['Quality System', 'Documentation', 'Personnel', 'Production', 'Laboratory Control', 'Supplier Management', 'Validation', 'Data Integrity'].map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', fontFamily: 'monospace', marginBottom: '6px' }}>RISK LEVEL</label>
                        <select
                          value={editingRequirement.riskLevel || 'MAJOR'}
                          onChange={(e) => setEditingRequirement({ ...editingRequirement, riskLevel: e.target.value })}
                          style={{ width: '100%', background: '#0A0E17', border: '1px solid rgba(255,255,255,0.12)', color: '#FFF', padding: '10px', fontSize: '13px' }}
                        >
                          {['CRITICAL', 'MAJOR', 'MINOR', 'INFORMATIONAL'].map(r => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                      <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', fontFamily: 'monospace', marginBottom: '6px' }}>REQUIREMENT TEXT</label>
                      <textarea
                        value={editingRequirement.requirementText || ''}
                        onChange={(e) => setEditingRequirement({ ...editingRequirement, requirementText: e.target.value })}
                        required
                        rows={4}
                        style={{ width: '100%', background: '#0A0E17', border: '1px solid rgba(255,255,255,0.12)', color: '#FFF', padding: '10px', fontSize: '13px', fontFamily: 'sans-serif' }}
                      />
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                      <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', fontFamily: 'monospace', marginBottom: '6px' }}>EXPECTED EVIDENCE</label>
                      <textarea
                        value={editingRequirement.expectedEvidence || ''}
                        onChange={(e) => setEditingRequirement({ ...editingRequirement, expectedEvidence: e.target.value })}
                        required
                        rows={3}
                        style={{ width: '100%', background: '#0A0E17', border: '1px solid rgba(255,255,255,0.12)', color: '#FFF', padding: '10px', fontSize: '13px', fontFamily: 'sans-serif' }}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setRequirementFormOpen(false);
                          setEditingRequirement(null);
                        }}
                        style={{ background: '#334155', border: 'none', color: '#FFF', padding: '10px 20px', fontSize: '12px', fontFamily: 'monospace', cursor: 'pointer' }}
                      >
                        CANCEL
                      </button>
                      <button
                        type="submit"
                        disabled={savingReq}
                        style={{ background: '#059669', border: 'none', color: '#FFF', padding: '10px 24px', fontSize: '12px', fontFamily: 'monospace', fontWeight: '700', cursor: 'pointer' }}
                      >
                        {savingReq ? 'SAVING…' : 'SAVE REQUIREMENT'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 5. RELEASE MANAGER */}
        {activeTab === 'release' && (
          <div>
            <h3 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '24px', letterSpacing: '-0.01em' }}>Trigger Regulatory Releases</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '40px' }}>
              {/* Form */}
              <div style={{ background: '#0F172A', border: '1px solid rgba(255,255,255,0.06)', padding: '32px' }}>
                {publishSuccess && (
                  <div style={{ padding: '16px', background: 'rgba(5,150,105,0.1)', border: '1px solid rgba(5,150,105,0.3)', color: '#10B981', fontSize: '13px', fontFamily: 'monospace', marginBottom: '24px' }}>
                    {publishSuccess}
                  </div>
                )}
                {publishError && (
                  <div style={{ padding: '16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', fontSize: '13px', fontFamily: 'monospace', marginBottom: '24px' }}>
                    {publishError}
                  </div>
                )}

                <form onSubmit={handlePublishRelease}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', fontFamily: 'monospace', marginBottom: '8px' }}>TARGET REGULATION SOURCE</label>
                      <select
                        value={pubRegulationId}
                        onChange={(e) => setPubRegulationId(e.target.value)}
                        style={{ width: '100%', background: '#070A10', border: '1px solid rgba(255,255,255,0.12)', color: '#FFF', padding: '12px', fontSize: '13px' }}
                      >
                        {regulations.map(reg => (
                          <option key={reg.regulationId} value={reg.regulationId}>{reg.title} ({reg.version})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', fontFamily: 'monospace', marginBottom: '8px' }}>NEW VERSION STRING</label>
                      <input
                        type="text"
                        value={pubVersion}
                        onChange={(e) => setPubVersion(e.target.value)}
                        required
                        style={{ width: '100%', background: '#070A10', border: '1px solid rgba(255,255,255,0.12)', color: '#FFF', padding: '12px', fontSize: '13px', fontFamily: 'monospace' }}
                      />
                    </div>
                  </div>

                  <div style={{ marginBottom: '32px' }}>
                    <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', fontFamily: 'monospace', marginBottom: '8px' }}>RELEASE SUMMARY (CHANGE MANIFEST)</label>
                    <textarea
                      value={pubSummary}
                      onChange={(e) => setPubSummary(e.target.value)}
                      placeholder="Specify what chapters or sections have been updated or deprecated in this release..."
                      required
                      rows={5}
                      style={{ width: '100%', background: '#070A10', border: '1px solid rgba(255,255,255,0.12)', color: '#FFF', padding: '12px', fontSize: '13px', fontFamily: 'sans-serif', lineHeight: '1.6' }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={publishingUpdate}
                    style={{
                      background: '#059669',
                      color: '#FFF',
                      border: 'none',
                      padding: '16px 32px',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                      fontWeight: '800',
                      letterSpacing: '0.08em',
                      cursor: publishingUpdate ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {publishingUpdate ? 'COMPILING & DEPLOYING UPDATE PACKAGE…' : '🚀 PUBLISH REGULATORY UPDATE PACKAGE'}
                  </button>
                </form>
              </div>

              {/* Explainer */}
              <div style={{ background: '#0F172A', border: '1px solid rgba(255,255,255,0.06)', padding: '24px' }}>
                <h4 style={{ fontSize: '12px', fontWeight: '800', letterSpacing: '0.06em', fontFamily: 'monospace', color: '#94A3B8', marginBottom: '16px' }}>
                  HOW REGULATORY PUBLICATION WORKS
                </h4>
                <p style={{ fontSize: '12px', color: '#94A3B8', lineHeight: '1.6' }}>
                  When you publish an update package:
                </p>
                <ol style={{ fontSize: '12px', color: '#94A3B8', paddingLeft: '16px', lineHeight: '1.8' }}>
                  <li>Any global requirement edited or created in the <strong>Regulatory Authority</strong> tab since the last release is automatically compiled into a structured changelog.</li>
                  <li>The version is updated globally in the database.</li>
                  <li>An update package entry is created with status <code>AVAILABLE</code>.</li>
                  <li>Each tenant&apos;s Veritas instance immediately flags <strong>UPDATE AVAILABLE</strong> in their command center.</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {/* 6. SECURITY AUDIT TRAIL */}
        {activeTab === 'audit' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div>
                <h3 style={{ fontSize: '20px', fontWeight: '800', margin: 0, letterSpacing: '-0.01em' }}>Platform Transaction Registry</h3>
                <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '4px' }}>
                  Cross-tenant security logging engine complying with 21 CFR Part 11 auditing mandates.
                </p>
              </div>
              <input
                type="text"
                value={searchAudit}
                onChange={(e) => setSearchAudit(e.target.value)}
                placeholder="Search audit trail..."
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: '#FFF', padding: '10px 16px', fontSize: '13px', width: '300px' }}
              />
            </div>

            <div style={{ background: '#0F172A', border: '1px solid rgba(255,255,255,0.06)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)' }}>
                    {['Timestamp', 'User Email', 'Role', 'Action', 'Object Type', 'Status', 'IP Address'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '700', fontFamily: 'monospace', color: '#94A3B8', fontSize: '10px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.slice(0, 50).map((log: any, idx: number) => (
                    <tr key={log.id || idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#94A3B8' }}>{new Date(log.timestamp).toLocaleString()}</td>
                      <td style={{ padding: '12px 16px', fontWeight: '700' }}>{log.userEmail}</td>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#94A3B8' }}>{log.userRole}</td>
                      <td style={{ padding: '12px 16px', fontWeight: '700', color: '#059669' }}>{log.action}</td>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace' }}>{log.objectType}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          color: log.status === 'Success' ? '#10B981' : '#EF4444',
                          fontWeight: '700',
                        }}>{log.status.toUpperCase()}</span>
                      </td>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#64748B' }}>{log.sourceIp || '127.0.0.1'}</td>
                    </tr>
                  ))}
                  {filteredLogs.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: '#94A3B8', fontFamily: 'monospace' }}>
                        No matching audit records located.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
