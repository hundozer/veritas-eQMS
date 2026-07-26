import React, { useState } from 'react';
import styles from '@/app/page.module.css';

interface OnboardingWizardModalProps {
  onClose: () => void;
  onComplete: (userEmail: string) => void;
}

export function OnboardingWizardModal({ onClose, onComplete }: OnboardingWizardModalProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Account Admin
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  const [password, setPassword] = useState('');

  // Step 2: Organization Setup
  const [companyName, setCompanyName] = useState('');
  const [legalEntityName, setLegalEntityName] = useState('');
  const [country, setCountry] = useState('Germany');
  const [region, setRegion] = useState('European Union');
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>(['Biotechnology']);
  const [companySize, setCompanySize] = useState('11-50');
  const [website, setWebsite] = useState('');

  // Step 3: Regulatory Environment
  const [selectedFrameworks, setSelectedFrameworks] = useState<string[]>(['European GMP', 'FDA 21 CFR Part 11']);

  // Step 4: Operational Complexity
  const [selectedOperations, setSelectedOperations] = useState<string[]>(['Manufacturing', 'Testing Laboratory']);
  const [currentQualitySystem, setCurrentQualitySystem] = useState('Spreadsheets');

  // Step 6: Team Roster Invites
  const [teamMembers, setTeamMembers] = useState<Array<{ fullName: string; email: string; role: string; department: string }>>([
    { fullName: 'Dr. Sarah Jenkins', email: 'sarah.jenkins@company.com', role: 'QUALITY_ASSURANCE', department: 'QA' },
  ]);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('QUALITY_ASSURANCE');

  // Step 7: Activated Modules
  const [activatedModules, setActivatedModules] = useState<string[]>([
    'documents', 'training', 'capa', 'deviations', 'change-control', 'audits', 'intelligence'
  ]);

  // Step 8: Regulatory Monitoring
  const [monitoredRegulations, setMonitoredRegulations] = useState<string[]>(['EU GMP Volume 4']);

  // Step 9: Migration Options
  const [importOption, setImportOption] = useState('SEED_STARTER');

  const toggleIndustry = (ind: string) => {
    setSelectedIndustries(prev => prev.includes(ind) ? prev.filter(i => i !== ind) : [...prev, ind]);
  };

  const toggleFramework = (fw: string) => {
    setSelectedFrameworks(prev => prev.includes(fw) ? prev.filter(f => f !== fw) : [...prev, fw]);
  };

  const toggleOperation = (op: string) => {
    setSelectedOperations(prev => prev.includes(op) ? prev.filter(o => o !== op) : [...prev, op]);
  };

  const toggleModule = (mod: string) => {
    setActivatedModules(prev => prev.includes(mod) ? prev.filter(m => m !== mod) : [...prev, mod]);
  };

  const addTeamMember = () => {
    if (newMemberEmail) {
      setTeamMembers(prev => [...prev, {
        fullName: newMemberName || newMemberEmail.split('@')[0],
        email: newMemberEmail,
        role: newMemberRole,
        department: 'QA',
      }]);
      setNewMemberName('');
      setNewMemberEmail('');
    }
  };

  const handleFinishOnboarding = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch('/api/onboarding/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          businessEmail,
          password,
          companyName,
          legalEntityName: legalEntityName || companyName,
          country,
          region,
          industries: selectedIndustries,
          companySize,
          website,
          regulatoryFrameworks: selectedFrameworks,
          operations: selectedOperations,
          currentQualitySystem,
          teamMembers,
          activatedModules,
          monitoredRegulations,
          importOption,
        }),
      });

      const json = await res.json();
      if (res.ok) {
        onComplete(businessEmail);
      } else {
        setError(json.error?.message || 'Failed to initialize workspace');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(10, 14, 23, 0.85)', backdropFilter: 'blur(16px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '24px' }}>
      <div style={{ background: '#FFFFFF', border: '1px solid rgba(10, 14, 23, 0.2)', maxWidth: '780px', width: '100%', padding: '40px', color: '#0A0E17', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif', boxShadow: '0 30px 80px rgba(0,0,0,0.4)', maxHeight: '90vh', overflowY: 'auto' }}>
        
        {/* Wizard Header & Progress Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(10, 14, 23, 0.12)', paddingBottom: '20px', marginBottom: '24px' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.12em', color: '#047857', textTransform: 'uppercase', fontFamily: 'monospace', marginBottom: '4px' }}>
              ● VERITAS ENTERPRISE INITIALIZATION • STEP {step} OF 10
            </div>
            <h2 style={{ fontSize: '24px', fontWeight: '800', margin: 0, letterSpacing: '-0.02em', color: '#0A0E17' }}>
              {step === 1 && '1. Primary Quality Administrator Account'}
              {step === 2 && '2. Organization & Corporate Profile'}
              {step === 3 && '3. Regulatory Environment Scope'}
              {step === 4 && '4. Operational Complexity & Quality System'}
              {step === 5 && '5. Quality Organization Structure'}
              {step === 6 && '6. Team Roster & Initial Invites'}
              {step === 7 && '7. Veritas Module Activation Matrix'}
              {step === 8 && '8. Regulatory Intelligence Monitoring'}
              {step === 9 && '9. Data Migration & QMS Import'}
              {step === 10 && '10. Compliance Readiness Assessment'}
            </h2>
          </div>

          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid rgba(10, 14, 23, 0.2)', color: '#0A0E17', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: '700', cursor: 'pointer' }}>
            ×
          </button>
        </div>

        {/* Progress Bar Visualizer */}
        <div style={{ display: 'flex', gap: '4px', height: '4px', background: 'rgba(10,14,23,0.08)', marginBottom: '32px' }}>
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                background: i + 1 <= step ? '#047857' : 'transparent',
                transition: 'background 0.2s ease',
              }}
            />
          ))}
        </div>

        {error && (
          <div style={{ background: '#FEE2E2', border: '1px solid #EF4444', color: '#991B1B', padding: '14px', fontSize: '13px', fontFamily: 'monospace', marginBottom: '24px' }}>
            ⚠️ Onboarding Error: {error}
          </div>
        )}

        {/* STEP 1: ACCOUNT ADMIN */}
        {step === 1 && (
          <div>
            <div style={{ fontSize: '13px', color: '#64748B', lineHeight: '1.6', marginBottom: '24px' }}>
              Create your primary System Owner and Quality Administrator account. This identity will execute initial GxP compliance releases and hold primary system clearance.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '18px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', fontFamily: 'monospace', color: '#0A0E17', marginBottom: '6px' }}>FIRST NAME</label>
                <input type="text" placeholder="Dr. Eleanor" value={firstName} onChange={e => setFirstName(e.target.value)} style={{ width: '100%', padding: '12px', border: '1px solid rgba(10,14,23,0.2)', fontSize: '14px', background: '#FBFBFA' }} required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', fontFamily: 'monospace', color: '#0A0E17', marginBottom: '6px' }}>LAST NAME</label>
                <input type="text" placeholder="Vance" value={lastName} onChange={e => setLastName(e.target.value)} style={{ width: '100%', padding: '12px', border: '1px solid rgba(10,14,23,0.2)', fontSize: '14px', background: '#FBFBFA' }} required />
              </div>
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', fontFamily: 'monospace', color: '#0A0E17', marginBottom: '6px' }}>CORPORATE BUSINESS EMAIL</label>
              <input type="email" placeholder="eleanor.vance@heliosbio.eu" value={businessEmail} onChange={e => setBusinessEmail(e.target.value)} style={{ width: '100%', padding: '12px', border: '1px solid rgba(10,14,23,0.2)', fontSize: '14px', background: '#FBFBFA' }} required />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', fontFamily: 'monospace', color: '#0A0E17', marginBottom: '6px' }}>ACCOUNT PASSWORD</label>
              <input type="password" placeholder="••••••••••••" value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%', padding: '12px', border: '1px solid rgba(10,14,23,0.2)', fontSize: '14px', background: '#FBFBFA' }} required />
            </div>
          </div>
        )}

        {/* STEP 2: ORGANIZATION SETUP */}
        {step === 2 && (
          <div>
            <div style={{ fontSize: '13px', color: '#64748B', lineHeight: '1.6', marginBottom: '24px' }}>
              Configure your corporate entity and primary regulated industry domain.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '18px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', fontFamily: 'monospace', color: '#0A0E17', marginBottom: '6px' }}>COMPANY NAME</label>
                <input type="text" placeholder="Helios BioPharma Inc." value={companyName} onChange={e => setCompanyName(e.target.value)} style={{ width: '100%', padding: '12px', border: '1px solid rgba(10,14,23,0.2)', fontSize: '14px', background: '#FBFBFA' }} required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', fontFamily: 'monospace', color: '#0A0E17', marginBottom: '6px' }}>LEGAL ENTITY NAME</label>
                <input type="text" placeholder="Helios BioPharma GmbH & Co. KG" value={legalEntityName} onChange={e => setLegalEntityName(e.target.value)} style={{ width: '100%', padding: '12px', border: '1px solid rgba(10,14,23,0.2)', fontSize: '14px', background: '#FBFBFA' }} />
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', fontFamily: 'monospace', color: '#0A0E17', marginBottom: '8px' }}>REGULATED SECTOR (SELECT ALL THAT APPLY)</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                {['Biotechnology', 'Pharmaceutical', 'Medical Cannabis', 'Laboratory Testing', 'Nutraceuticals', 'Research Organization'].map(ind => (
                  <button
                    key={ind}
                    type="button"
                    onClick={() => toggleIndustry(ind)}
                    style={{
                      padding: '10px',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                      fontWeight: '700',
                      border: '1px solid rgba(10,14,23,0.2)',
                      background: selectedIndustries.includes(ind) ? '#0A0E17' : '#FBFBFA',
                      color: selectedIndustries.includes(ind) ? '#FBFBFA' : '#0A0E17',
                      cursor: 'pointer',
                    }}
                  >
                    {selectedIndustries.includes(ind) ? '✓ ' : ''}{ind}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: REGULATORY FRAMEWORKS */}
        {step === 3 && (
          <div>
            <div style={{ fontSize: '13px', color: '#64748B', lineHeight: '1.6', marginBottom: '24px' }}>
              Select the governing regulatory frameworks that apply to your operations. Veritas will automatically load required compliance rules, taxonomy, and workflows.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
              {[
                { id: 'European GMP', label: 'European GMP (EudraLex Vol 4)', detail: 'Full EU GMP Annex 1-19 validation & PQS' },
                { id: 'FDA 21 CFR Part 11', label: 'FDA 21 CFR Part 11', detail: 'Electronic signatures, audit trails & WORM logs' },
                { id: 'EU GDP', label: 'EU GDP (Good Distribution Practice)', detail: 'Cold chain, distribution & transport validation' },
                { id: 'ISO 13485', label: 'ISO 13485 / ISO 9001', detail: 'Medical device quality management system' },
                { id: 'ISO 17025', label: 'ISO 17025 Laboratory Testing', detail: 'Analytical laboratory competence & calibration' },
                { id: 'GACP', label: 'GACP (Good Agricultural Practice)', detail: 'Botanical & raw material cultivation' },
              ].map(fw => (
                <div
                  key={fw.id}
                  onClick={() => toggleFramework(fw.id)}
                  style={{
                    padding: '16px',
                    border: selectedFrameworks.includes(fw.id) ? '2px solid #047857' : '1px solid rgba(10,14,23,0.15)',
                    background: selectedFrameworks.includes(fw.id) ? '#F0FDF4' : '#FBFBFA',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: '13px', fontWeight: '800', color: selectedFrameworks.includes(fw.id) ? '#047857' : '#0A0E17' }}>
                    {selectedFrameworks.includes(fw.id) ? '✓ ' : ''}{fw.label}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px', fontFamily: 'monospace' }}>
                    {fw.detail}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 4: OPERATIONAL COMPLEXITY */}
        {step === 4 && (
          <div>
            <div style={{ fontSize: '13px', color: '#64748B', lineHeight: '1.6', marginBottom: '24px' }}>
              Define your site operational scope and current quality management infrastructure.
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', fontFamily: 'monospace', color: '#0A0E17', marginBottom: '8px' }}>SITE OPERATIONS PERFORMED</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                {['Manufacturing', 'Testing Laboratory', 'Cultivation', 'Research', 'Distribution', 'Packaging'].map(op => (
                  <button
                    key={op}
                    type="button"
                    onClick={() => toggleOperation(op)}
                    style={{
                      padding: '10px',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                      fontWeight: '700',
                      border: '1px solid rgba(10,14,23,0.2)',
                      background: selectedOperations.includes(op) ? '#0A0E17' : '#FBFBFA',
                      color: selectedOperations.includes(op) ? '#FBFBFA' : '#0A0E17',
                      cursor: 'pointer',
                    }}
                  >
                    {selectedOperations.includes(op) ? '✓ ' : ''}{op}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', fontFamily: 'monospace', color: '#0A0E17', marginBottom: '6px' }}>CURRENT QUALITY SYSTEM</label>
              <select value={currentQualitySystem} onChange={e => setCurrentQualitySystem(e.target.value)} style={{ width: '100%', padding: '12px', border: '1px solid rgba(10,14,23,0.2)', fontSize: '13px', background: '#FBFBFA', fontFamily: 'monospace' }}>
                <option value="Spreadsheets">Spreadsheets & Paper Logs</option>
                <option value="SharePoint">SharePoint & File Servers</option>
                <option value="Legacy QMS">Legacy On-Premise QMS</option>
                <option value="Commercial eQMS">Commercial eQMS System</option>
              </select>
            </div>
          </div>
        )}

        {/* STEP 5: QUALITY STRUCTURE ROLES */}
        {step === 5 && (
          <div>
            <div style={{ fontSize: '13px', color: '#64748B', lineHeight: '1.6', marginBottom: '24px' }}>
              Veritas configures role-based access control (RBAC) and GxP signature authority levels for your team.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
              {[
                { role: 'Quality Manager', clearance: 'Full Quality Control & System Administration' },
                { role: 'Quality Assurance (QA)', clearance: 'Document Approvals, CAPA, Deviations & Audits' },
                { role: 'Quality Control (QC)', clearance: 'Laboratory Sampling, Testing & OOS Investigations' },
                { role: 'Production Manager', clearance: 'Batch Processing Records & Facility Controls' },
                { role: 'Regulatory Affairs', clearance: 'Regulatory Intelligence & EU GMP Mapping' },
                { role: 'Employee', clearance: 'Assigned Training Quizzes & Standard Tasks' },
              ].map(r => (
                <div key={r.role} style={{ padding: '14px', border: '1px solid rgba(10,14,23,0.12)', background: '#FBFBFA' }}>
                  <div style={{ fontSize: '13px', fontWeight: '800', color: '#047857' }}>{r.role}</div>
                  <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px', fontFamily: 'monospace' }}>{r.clearance}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 6: INVITE TEAM MEMBERS */}
        {step === 6 && (
          <div>
            <div style={{ fontSize: '13px', color: '#64748B', lineHeight: '1.6', marginBottom: '20px' }}>
              Add key quality personnel to your organization roster.
            </div>

            <div style={{ border: '1px solid rgba(10,14,23,0.12)', padding: '16px', background: '#FBFBFA', marginBottom: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '10px', alignItems: 'end' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontFamily: 'monospace', fontWeight: '700' }}>NAME</label>
                  <input type="text" placeholder="Dr. Sarah Jenkins" value={newMemberName} onChange={e => setNewMemberName(e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid rgba(10,14,23,0.2)', fontSize: '12px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontFamily: 'monospace', fontWeight: '700' }}>WORK EMAIL</label>
                  <input type="email" placeholder="sarah@heliosbio.eu" value={newMemberEmail} onChange={e => setNewMemberEmail(e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid rgba(10,14,23,0.2)', fontSize: '12px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontFamily: 'monospace', fontWeight: '700' }}>ROLE</label>
                  <select value={newMemberRole} onChange={e => setNewMemberRole(e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid rgba(10,14,23,0.2)', fontSize: '12px' }}>
                    <option value="QUALITY_ASSURANCE">Quality Assurance</option>
                    <option value="QUALITY_CONTROL">Quality Control</option>
                    <option value="PRODUCTION_MANAGER">Production Manager</option>
                    <option value="REGULATORY_AFFAIRS">Regulatory Affairs</option>
                  </select>
                </div>
                <button type="button" onClick={addTeamMember} style={{ background: '#0A0E17', color: '#FBFBFA', border: 'none', padding: '8px 14px', fontSize: '11px', fontFamily: 'monospace', fontWeight: '700', cursor: 'pointer' }}>
                  + ADD
                </button>
              </div>
            </div>

            <div style={{ border: '1px solid rgba(10,14,23,0.12)', padding: '16px' }}>
              <div style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: '700', color: '#64748B', marginBottom: '10px' }}>INVITED TEAM ROSTER ({teamMembers.length}):</div>
              {teamMembers.map((m, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(10,14,23,0.06)', fontSize: '12px' }}>
                  <div><strong>{m.fullName}</strong> ({m.email})</div>
                  <div style={{ fontFamily: 'monospace', color: '#047857' }}>{m.role}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 7: MODULE ACTIVATION MATRIX */}
        {step === 7 && (
          <div>
            <div style={{ fontSize: '13px', color: '#64748B', lineHeight: '1.6', marginBottom: '24px' }}>
              Select which Veritas GxP modules to activate for your organization.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
              {[
                { id: 'documents', name: 'Document Control', detail: '21 CFR Part 11 SOP revision & electronic signatures' },
                { id: 'training', name: 'Training Hub', detail: 'Role-based matrices & automatic retraining' },
                { id: 'capa', name: 'CAPA & Quality Events', detail: '5-Why root cause analysis & corrective action tracking' },
                { id: 'deviations', name: 'Deviations Workflow', detail: 'Excursion logging, containment & investigation' },
                { id: 'change-control', name: 'Change Control', detail: 'Multi-department impact analysis & approval workflows' },
                { id: 'audits', name: 'GxP Audits', detail: 'Internal & supplier inspection planning and reports' },
                { id: 'intelligence', name: 'Regulatory Intelligence', detail: 'EU GMP Volume 4 knowledge graph & monitoring' },
                { id: 'equipment', name: 'Equipment Maintenance', detail: 'Instrument calibration logs & out-of-service alerts' },
              ].map(m => (
                <div
                  key={m.id}
                  onClick={() => toggleModule(m.id)}
                  style={{
                    padding: '14px',
                    border: activatedModules.includes(m.id) ? '2px solid #047857' : '1px solid rgba(10,14,23,0.12)',
                    background: activatedModules.includes(m.id) ? '#F0FDF4' : '#FBFBFA',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: '13px', fontWeight: '800', color: activatedModules.includes(m.id) ? '#047857' : '#0A0E17' }}>
                    {activatedModules.includes(m.id) ? '✓ ' : ''}{m.name}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px', fontFamily: 'monospace' }}>
                    {m.detail}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 8: REGULATORY INTELLIGENCE SETUP */}
        {step === 8 && (
          <div>
            <div style={{ fontSize: '13px', color: '#64748B', lineHeight: '1.6', marginBottom: '24px' }}>
              Connect your environment to the structured EU GMP Regulatory Engine.
            </div>

            <div style={{ padding: '20px', background: '#F0FDF4', border: '1px solid #16A34A', marginBottom: '24px' }}>
              <div style={{ fontSize: '13px', fontWeight: '800', color: '#15803D', marginBottom: '6px' }}>
                ✓ EU GMP VOLUME 4 AUTOMATICALLY PROVISIONED
              </div>
              <div style={{ fontSize: '12px', color: '#166534', lineHeight: '1.6', fontFamily: 'monospace' }}>
                Veritas will load all 9 core chapters of EU GMP Volume 4, requirement taxonomy, and inspector evidence checklists for {companyName}.
              </div>
            </div>
          </div>
        )}

        {/* STEP 9: DATA MIGRATION */}
        {step === 9 && (
          <div>
            <div style={{ fontSize: '13px', color: '#64748B', lineHeight: '1.6', marginBottom: '24px' }}>
              Select initial data seeding preferences for your compliance environment.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              {[
                { id: 'SEED_STARTER', title: 'Auto-Generate Starter GxP SOP Library', detail: 'Creates SOP-QA-001 Quality Management System Policy & starter training matrix.' },
                { id: 'IMPORT_PDF', title: 'Import Existing PDF / DOCX SOP Documents', detail: 'Upload your existing quality documents for automatic parsing.' },
                { id: 'BLANK', title: 'Start with Fresh Blank Workspace', detail: 'Initialize an empty environment for manual setup.' },
              ].map(opt => (
                <div
                  key={opt.id}
                  onClick={() => setImportOption(opt.id)}
                  style={{
                    padding: '16px',
                    border: importOption === opt.id ? '2px solid #047857' : '1px solid rgba(10,14,23,0.12)',
                    background: importOption === opt.id ? '#F0FDF4' : '#FBFBFA',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: '13px', fontWeight: '800', color: importOption === opt.id ? '#047857' : '#0A0E17' }}>
                    {importOption === opt.id ? '● ' : '○ '}{opt.title}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px', fontFamily: 'monospace' }}>
                    {opt.detail}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 10: BASELINE ASSESSMENT */}
        {step === 10 && (
          <div>
            <div style={{ padding: '24px', background: '#F0FDF4', border: '1px solid #16A34A', marginBottom: '24px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: '700', color: '#165231', letterSpacing: '0.1em' }}>
                INITIAL COMPLIANCE READINESS SCORE
              </div>
              <div style={{ fontSize: '48px', fontWeight: '800', color: '#047857', margin: '8px 0' }}>
                94% READY
              </div>
              <div style={{ fontSize: '13px', color: '#166534', fontFamily: 'monospace' }}>
                Regulated compliance environment configured for {companyName || 'your organization'}.
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '12px', fontFamily: 'monospace', marginBottom: '24px' }}>
              <div style={{ padding: '16px', border: '1px solid rgba(10,14,23,0.12)', background: '#FBFBFA' }}>
                <div style={{ color: '#64748B' }}>APPLICABLE FRAMEWORKS</div>
                <div style={{ fontWeight: '800', color: '#0A0E17', marginTop: '4px' }}>{selectedFrameworks.join(', ')}</div>
              </div>
              <div style={{ padding: '16px', border: '1px solid rgba(10,14,23,0.12)', background: '#FBFBFA' }}>
                <div style={{ color: '#64748B' }}>ACTIVATED MODULES</div>
                <div style={{ fontWeight: '800', color: '#0A0E17', marginTop: '4px' }}>{activatedModules.length} Modules Active</div>
              </div>
            </div>
          </div>
        )}

        {/* Wizard Controls Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(10,14,23,0.12)', paddingTop: '20px' }}>
          {step > 1 ? (
            <button type="button" onClick={() => setStep(prev => prev - 1)} style={{ background: '#F1F5F9', border: '1px solid rgba(10,14,23,0.2)', padding: '12px 24px', fontSize: '12px', fontFamily: 'monospace', fontWeight: '700', cursor: 'pointer' }}>
              ← BACK
            </button>
          ) : <div />}

          {step < 10 ? (
            <button
              type="button"
              onClick={() => {
                if (step === 1 && (!businessEmail || !firstName)) {
                  setError('Please fill in First Name and Business Email');
                  return;
                }
                if (step === 2 && !companyName) {
                  setError('Please enter your Company Name');
                  return;
                }
                setError(null);
                setStep(prev => prev + 1);
              }}
              style={{ background: '#0A0E17', color: '#FBFBFA', border: 'none', padding: '12px 28px', fontSize: '12px', fontFamily: 'monospace', fontWeight: '700', cursor: 'pointer' }}
            >
              CONTINUE TO STEP {step + 1} →
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinishOnboarding}
              disabled={loading}
              style={{ background: '#047857', color: '#FFFFFF', border: 'none', padding: '14px 32px', fontSize: '13px', fontFamily: 'monospace', fontWeight: '800', cursor: 'pointer', letterSpacing: '0.05em' }}
            >
              {loading ? 'INITIALIZING WORKSPACE...' : '⚡ ENTER VERITAS COMMAND CENTER →'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
