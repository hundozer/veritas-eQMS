import React, { useState, useEffect } from 'react';
import styles from '@/app/page.module.css';

interface RegulatoryRequirement {
  id: string;
  requirementId: string;
  chapter: string;
  section: string | null;
  title: string;
  category: string;
  riskLevel: 'CRITICAL' | 'MAJOR' | 'MINOR' | 'INFORMATIONAL';
  requirementText: string;
  expectedEvidence: string;
  applicableAreas: string; // JSON string
  affectedProcesses: string; // JSON string
  status: string;
  aiExtracted: boolean;
  relationships: Array<{
    id: string;
    targetType: string;
    targetId: string;
    targetTitle: string;
    relationshipType: string;
  }>;
}

interface IntelligenceData {
  sources: any[];
  requirements: RegulatoryRequirement[];
  metrics: {
    totalRequirements: number;
    criticalRiskCount: number;
    highMajorRiskCount: number;
    withoutEvidenceCount: number;
    mappedRequirementsCount: number;
    coveragePercentage: number;
    byChapterStats: Record<string, number>;
  };
  taxonomy: {
    chapters: string[];
    qualityAreas: string[];
    riskCategories: string[];
  };
  availableQmsEntities: {
    documents: Array<{ id: string; title: string; status: string }>;
    capas: Array<{ id: string; title: string; status: string }>;
    deviations: Array<{ id: string; title: string; status: string }>;
    audits: Array<{ id: string; title: string; status: string }>;
  };
}

export function RegulatoryIntelligenceModule({ currentUser }: { currentUser: any }) {
  const [activeSubTab, setActiveSubTab] = useState<'dashboard' | 'library' | 'repository' | 'taxonomy' | 'graph' | 'import' | 'updates'>('dashboard');
  const [data, setData] = useState<IntelligenceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedChapter, setSelectedChapter] = useState('ALL');
  const [selectedRisk, setSelectedRisk] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Graph linking modal state
  const [linkingReqId, setLinkingReqId] = useState<string | null>(null);
  const [linkTargetType, setLinkTargetType] = useState('DOCUMENT');
  const [linkTargetId, setLinkTargetId] = useState('');

  // Import form state
  const [importDocName, setImportDocName] = useState('');
  const [importText, setImportText] = useState('');
  const [importChapter, setImportChapter] = useState('Chapter 4: Documentation');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  // Update check state
  const [updateData, setUpdateData] = useState<any>(null);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [applyingUpdate, setApplyingUpdate] = useState(false);

  const fetchRequirements = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedChapter !== 'ALL') params.set('chapter', selectedChapter);
      if (selectedRisk !== 'ALL') params.set('riskLevel', selectedRisk);
      if (searchQuery) params.set('search', searchQuery);

      const headers: Record<string, string> = {};
      if (currentUser?.email) {
        headers['x-user-email'] = currentUser.email;
      }

      const res = await fetch(`/api/intelligence/requirements?${params.toString()}`, { headers });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error?.message || 'Failed to load regulatory data');
      }

      setData(json);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequirements();
  }, [selectedChapter, selectedRisk, searchQuery]);

  const handleLinkEntity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkingReqId || !linkTargetId) return;

    let targetTitle = 'QMS Entity';
    if (data?.availableQmsEntities) {
      if (linkTargetType === 'DOCUMENT') {
        const item = data.availableQmsEntities.documents.find(d => d.id === linkTargetId);
        if (item) targetTitle = item.title;
      } else if (linkTargetType === 'CAPA') {
        const item = data.availableQmsEntities.capas.find(c => c.id === linkTargetId);
        if (item) targetTitle = item.title;
      } else if (linkTargetType === 'DEVIATION') {
        const item = data.availableQmsEntities.deviations.find(d => d.id === linkTargetId);
        if (item) targetTitle = item.title;
      } else if (linkTargetType === 'AUDIT') {
        const item = data.availableQmsEntities.audits.find(a => a.id === linkTargetId);
        if (item) targetTitle = item.title;
      }
    }

    try {
      const res = await fetch('/api/intelligence/relationships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CREATE',
          requirementId: linkingReqId,
          targetType: linkTargetType,
          targetId: linkTargetId,
          targetTitle,
          relationshipType: 'REQUIRES',
        }),
      });

      if (res.ok) {
        setLinkingReqId(null);
        setLinkTargetId('');
        fetchRequirements();
      }
    } catch (err) {
      console.error('Failed to link relationship:', err);
    }
  };

  const handleUnlinkEntity = async (relationshipId: string) => {
    try {
      const res = await fetch('/api/intelligence/relationships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'DELETE',
          relationshipId,
        }),
      });

      if (res.ok) {
        fetchRequirements();
      }
    } catch (err) {
      console.error('Failed to unlink relationship:', err);
    }
  };

  const handleImportDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importDocName || !importText) return;

    try {
      setImporting(true);
      setImportResult(null);
      const res = await fetch('/api/intelligence/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentName: importDocName,
          documentText: importText,
          chapter: importChapter,
        }),
      });

      const json = await res.json();
      if (res.ok) {
        setImportResult(json.message);
        setImportDocName('');
        setImportText('');
        fetchRequirements();
      } else {
        setImportResult(`Import Error: ${json.error?.message || 'Failed to process document'}`);
      }
    } catch (err: any) {
      setImportResult(`Error: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  const handleApproveRequirement = async (reqId: string) => {
    try {
      const reqItem = data?.requirements.find(r => r.id === reqId);
      if (!reqItem) return;

      const res = await fetch('/api/intelligence/requirements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requirementId: reqItem.requirementId,
          chapter: reqItem.chapter,
          section: reqItem.section,
          title: reqItem.title,
          category: reqItem.category,
          riskLevel: reqItem.riskLevel,
          requirementText: reqItem.requirementText,
          expectedEvidence: reqItem.expectedEvidence,
          applicableAreas: reqItem.applicableAreas,
          affectedProcesses: reqItem.affectedProcesses,
          status: 'APPROVED',
        }),
      });

      if (res.ok) {
        fetchRequirements();
      }
    } catch (err) {
      console.error('Approve requirement error:', err);
    }
  };

  return (
    <div style={{ padding: '24px 32px', background: '#FBFBFA', minHeight: '100vh', color: '#0A0E17', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif' }}>
      
      {/* Module Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(10, 14, 23, 0.12)', paddingBottom: '20px', marginBottom: '28px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: '700', letterSpacing: '0.12em', color: '#047857', fontFamily: 'monospace', textTransform: 'uppercase', marginBottom: '6px' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#047857' }} />
            REGULATORY KNOWLEDGE ENGINE • EU GMP VOLUME 4
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: '800', margin: 0, letterSpacing: '-0.03em', color: '#0A0E17' }}>
            Regulatory Intelligence
          </h1>
          <div style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>
            Structured EU GMP regulatory knowledge model & knowledge graph mapping.
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ padding: '8px 16px', background: '#FFFFFF', border: '1px solid rgba(10,14,23,0.12)', fontSize: '11px', fontFamily: 'monospace', color: '#0A0E17' }}>
            AUTHORITY: <strong style={{ color: '#047857' }}>European Commission (EMA)</strong>
          </div>
          <div style={{ padding: '8px 16px', background: '#FFFFFF', border: '1px solid rgba(10,14,23,0.12)', fontSize: '11px', fontFamily: 'monospace', color: '#0A0E17' }}>
            REGION: <strong>European Union</strong>
          </div>
        </div>
      </div>

      {/* Sub-tab Navigation */}
      <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid rgba(10, 14, 23, 0.12)', marginBottom: '28px' }}>
        {[
          { id: 'dashboard', label: '📊 Regulatory Dashboard' },
          { id: 'library', label: '📚 Regulatory Library' },
          { id: 'repository', label: '📜 Requirement Repository' },
          { id: 'taxonomy', label: '🏷️ Quality Taxonomy' },
          { id: 'graph', label: '🕸️ Knowledge Graph' },
          { id: 'import', label: '📥 Regulatory PDF Import' },
          { id: 'updates', label: '🔄 Version & Updates' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as any)}
            style={{
              padding: '12px 20px',
              fontSize: '12px',
              fontWeight: '700',
              fontFamily: 'monospace',
              background: activeSubTab === tab.id ? '#0A0E17' : 'transparent',
              color: activeSubTab === tab.id ? '#FBFBFA' : '#64748B',
              border: '1px solid rgba(10,14,23,0.12)',
              borderBottom: 'none',
              cursor: 'pointer',
              letterSpacing: '0.04em',
              transition: 'all 0.15s ease',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'monospace', color: '#64748B' }}>
          Loading EU GMP Regulatory Knowledge Base...
        </div>
      )}

      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #EF4444', color: '#991B1B', padding: '16px', marginBottom: '24px', fontSize: '13px', fontFamily: 'monospace' }}>
          ⚠️ Regulatory Engine Error: {error}
        </div>
      )}

      {!loading && data && (
        <>
          {/* TAB 1: REGULATORY DASHBOARD */}
          {activeSubTab === 'dashboard' && (
            <div>
              {/* Metrics Header Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '32px' }}>
                <div style={{ background: '#FFFFFF', border: '1px solid rgba(10,14,23,0.15)', padding: '20px' }}>
                  <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    EU GMP REQUIREMENTS
                  </div>
                  <div style={{ fontSize: '32px', fontWeight: '800', color: '#0A0E17', marginTop: '6px' }}>
                    {data.metrics.totalRequirements}
                  </div>
                  <div style={{ fontSize: '11px', color: '#047857', marginTop: '4px', fontFamily: 'monospace' }}>
                    Chapters 1 – 9 Seeded
                  </div>
                </div>

                <div style={{ background: '#FFFFFF', border: '1px solid rgba(10,14,23,0.15)', padding: '20px' }}>
                  <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    CRITICAL RISK ITEMS
                  </div>
                  <div style={{ fontSize: '32px', fontWeight: '800', color: '#991B1B', marginTop: '6px' }}>
                    {data.metrics.criticalRiskCount}
                  </div>
                  <div style={{ fontSize: '11px', color: '#991B1B', marginTop: '4px', fontFamily: 'monospace' }}>
                    Requires Immediate Verification
                  </div>
                </div>

                <div style={{ background: '#FFFFFF', border: '1px solid rgba(10,14,23,0.15)', padding: '20px' }}>
                  <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    MAJOR / HIGH RISK
                  </div>
                  <div style={{ fontSize: '32px', fontWeight: '800', color: '#D97706', marginTop: '6px' }}>
                    {data.metrics.highMajorRiskCount}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px', fontFamily: 'monospace' }}>
                    Standard Regulatory Oversight
                  </div>
                </div>

                <div style={{ background: '#FFFFFF', border: '1px solid rgba(10,14,23,0.15)', padding: '20px' }}>
                  <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    UNMAPPED EVIDENCE
                  </div>
                  <div style={{ fontSize: '32px', fontWeight: '800', color: '#475569', marginTop: '6px' }}>
                    {data.metrics.withoutEvidenceCount}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px', fontFamily: 'monospace' }}>
                    Needs Document Mapping
                  </div>
                </div>

                <div style={{ background: '#FFFFFF', border: '1px solid rgba(10,14,23,0.15)', padding: '20px' }}>
                  <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    COMPLIANCE COVERAGE
                  </div>
                  <div style={{ fontSize: '32px', fontWeight: '800', color: '#047857', marginTop: '6px' }}>
                    {data.metrics.coveragePercentage}%
                  </div>
                  <div style={{ fontSize: '11px', color: '#047857', marginTop: '4px', fontFamily: 'monospace' }}>
                    {data.metrics.mappedRequirementsCount} / {data.metrics.totalRequirements} Mapped
                  </div>
                </div>
              </div>

              {/* Requirements By Chapter Breakdown Table */}
              <div style={{ background: '#FFFFFF', border: '1px solid rgba(10,14,23,0.15)', padding: '28px', marginBottom: '32px' }}>
                <div style={{ fontSize: '12px', fontWeight: '700', letterSpacing: '0.1em', color: '#047857', fontFamily: 'monospace', textTransform: 'uppercase', marginBottom: '16px' }}>
                  REQUIREMENT DISTRIBUTION BY EU GMP CHAPTER
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                  {Object.entries(data.metrics.byChapterStats).map(([chapterName, count]) => (
                    <div key={chapterName} style={{ border: '1px solid rgba(10,14,23,0.08)', padding: '16px', background: '#FBFBFA' }}>
                      <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#64748B', marginBottom: '4px' }}>
                        {chapterName.split(':')[0]}
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: '800', color: '#0A0E17', marginBottom: '8px' }}>
                        {chapterName.split(':')[1] || chapterName}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', fontFamily: 'monospace' }}>
                        <span style={{ color: '#475569' }}>Total Requirements:</span>
                        <span style={{ fontWeight: '800', color: '#047857' }}>{count} Statements</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: REGULATORY LIBRARY */}
          {activeSubTab === 'library' && (
            <div>
              <div style={{ background: '#FFFFFF', border: '1px solid rgba(10,14,23,0.15)', padding: '28px', marginBottom: '28px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(10,14,23,0.1)', paddingBottom: '16px', marginBottom: '20px' }}>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#047857', fontFamily: 'monospace', letterSpacing: '0.1em' }}>● PRIMARY REGULATORY SOURCE</div>
                    <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#0A0E17', margin: '4px 0 0' }}>
                      EU GMP Volume 4 — Medicinal Products for Human & Veterinary Use
                    </h2>
                  </div>
                  <span style={{ background: '#047857', color: '#FFFFFF', padding: '6px 14px', fontSize: '11px', fontWeight: '700', fontFamily: 'monospace' }}>
                    STATUS: ACTIVE REGULATION
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', fontSize: '12px', fontFamily: 'monospace', color: '#475569', marginBottom: '24px' }}>
                  <div>
                    <div style={{ color: '#64748B' }}>REGULATORY AUTHORITY</div>
                    <div style={{ fontWeight: '800', color: '#0A0E17', marginTop: '4px' }}>European Commission / EMA</div>
                  </div>
                  <div>
                    <div style={{ color: '#64748B' }}>JURISDICTION / REGION</div>
                    <div style={{ fontWeight: '800', color: '#0A0E17', marginTop: '4px' }}>European Union (EU/EEA)</div>
                  </div>
                  <div>
                    <div style={{ color: '#64748B' }}>CHAPTER SCOPE</div>
                    <div style={{ fontWeight: '800', color: '#0A0E17', marginTop: '4px' }}>Chapters 1 through 9</div>
                  </div>
                  <div>
                    <div style={{ color: '#64748B' }}>LAST REVIEWED DATE</div>
                    <div style={{ fontWeight: '800', color: '#0A0E17', marginTop: '4px' }}>2026-07-26 (Veritas Verified)</div>
                  </div>
                </div>

                <div style={{ fontSize: '12px', color: '#64748B', lineHeight: '1.6', background: '#FBFBFA', border: '1px solid rgba(10,14,23,0.08)', padding: '16px' }}>
                  <strong>Scope Note:</strong> EU GMP Volume 4 contains governing quality requirements for medicinal product manufacturing, testing, and batch release across EU member states. Future expansions will incorporate Annex 1 (Sterile Products), Annex 11 (Computerised Systems), Annex 15 (Qualification and Validation), Annex 16 (QP Release), and ICH Guidelines.
                </div>
              </div>

              {/* Chapter Index */}
              <div style={{ background: '#FFFFFF', border: '1px solid rgba(10,14,23,0.15)', padding: '28px' }}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#047857', fontFamily: 'monospace', letterSpacing: '0.1em', marginBottom: '16px' }}>
                  CHAPTER INDEX (EU GMP VOLUME 4)
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  {data.taxonomy.chapters.map((ch, idx) => {
                    const reqCount = data.requirements.filter(r => r.chapter === ch).length;
                    return (
                      <div key={ch} style={{ border: '1px solid rgba(10,14,23,0.1)', padding: '16px', background: '#FBFBFA', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#047857', fontWeight: '700' }}>
                            CHAPTER 0{idx + 1}
                          </div>
                          <div style={{ fontSize: '14px', fontWeight: '800', color: '#0A0E17', marginTop: '2px' }}>
                            {ch}
                          </div>
                        </div>
                        <button
                          onClick={() => { setSelectedChapter(ch); setActiveSubTab('repository'); }}
                          style={{ background: '#0A0E17', color: '#FBFBFA', border: 'none', padding: '8px 14px', fontSize: '11px', fontFamily: 'monospace', fontWeight: '700', cursor: 'pointer' }}
                        >
                          VIEW {reqCount} REQS →
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: REQUIREMENT REPOSITORY */}
          {activeSubTab === 'repository' && (
            <div>
              {/* Repository Filter Bar */}
              <div style={{ background: '#FFFFFF', border: '1px solid rgba(10,14,23,0.15)', padding: '20px', marginBottom: '24px', display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '11px', fontFamily: 'monospace', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>
                    SEARCH REQUIREMENTS
                  </label>
                  <input
                    type="text"
                    placeholder="Search by ID, title, text, or expected evidence..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid rgba(10,14,23,0.2)', fontSize: '13px', background: '#FBFBFA' }}
                  />
                </div>

                <div style={{ width: '260px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontFamily: 'monospace', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>
                    EU GMP CHAPTER
                  </label>
                  <select
                    value={selectedChapter}
                    onChange={(e) => setSelectedChapter(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid rgba(10,14,23,0.2)', fontSize: '12px', background: '#FBFBFA', fontFamily: 'monospace' }}
                  >
                    <option value="ALL">All Chapters (1 – 9)</option>
                    {data.taxonomy.chapters.map(ch => (
                      <option key={ch} value={ch}>{ch}</option>
                    ))}
                  </select>
                </div>

                <div style={{ width: '180px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontFamily: 'monospace', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>
                    RISK LEVEL
                  </label>
                  <select
                    value={selectedRisk}
                    onChange={(e) => setSelectedRisk(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid rgba(10,14,23,0.2)', fontSize: '12px', background: '#FBFBFA', fontFamily: 'monospace' }}
                  >
                    <option value="ALL">All Risk Levels</option>
                    <option value="CRITICAL">Critical</option>
                    <option value="MAJOR">Major</option>
                    <option value="MINOR">Minor</option>
                  </select>
                </div>
              </div>

              {/* Requirement Cards Ledger */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {data.requirements.length === 0 && (
                  <div style={{ background: '#FFFFFF', border: '1px solid rgba(10,14,23,0.15)', padding: '40px', textAlign: 'center', color: '#64748B', fontFamily: 'monospace' }}>
                    No EU GMP requirements match the selected search filters.
                  </div>
                )}

                {data.requirements.map((req) => {
                  const applicableAreas: string[] = JSON.parse(req.applicableAreas || '[]');
                  const affectedProcesses: string[] = JSON.parse(req.affectedProcesses || '[]');

                  return (
                    <div key={req.id} style={{ background: '#FFFFFF', border: '1px solid rgba(10,14,23,0.15)', padding: '24px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(10,14,23,0.08)', paddingBottom: '14px', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: '800', background: '#0A0E17', color: '#FBFBFA', padding: '4px 10px' }}>
                            {req.requirementId}
                          </span>
                          <span style={{ fontSize: '12px', fontFamily: 'monospace', color: '#047857', fontWeight: '700' }}>
                            {req.chapter}
                          </span>
                          <span style={{ fontSize: '11px', fontFamily: 'monospace', background: 'rgba(10,14,23,0.06)', padding: '3px 8px', color: '#475569' }}>
                            {req.category}
                          </span>
                          {req.aiExtracted && (
                            <span style={{ fontSize: '10px', fontFamily: 'monospace', background: '#FEF3C7', color: '#92400E', padding: '3px 8px', fontWeight: '700' }}>
                              ⚡ AI EXTRACTED CANDIDATE
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              fontFamily: 'monospace',
                              fontWeight: '800',
                              padding: '4px 10px',
                              background: req.riskLevel === 'CRITICAL' ? '#FEE2E2' : req.riskLevel === 'MAJOR' ? '#FEF3C7' : '#E0E7FF',
                              color: req.riskLevel === 'CRITICAL' ? '#991B1B' : req.riskLevel === 'MAJOR' ? '#92400E' : '#3730A3',
                            }}
                          >
                            RISK: {req.riskLevel}
                          </span>

                          {req.status === 'PENDING_REVIEW' && (
                            <button
                              onClick={() => handleApproveRequirement(req.id)}
                              style={{ background: '#047857', color: '#FFFFFF', border: 'none', padding: '6px 12px', fontSize: '11px', fontFamily: 'monospace', fontWeight: '700', cursor: 'pointer' }}
                            >
                              ✓ APPROVE REQUIREMENT
                            </button>
                          )}
                        </div>
                      </div>

                      <h3 style={{ fontSize: '17px', fontWeight: '800', color: '#0A0E17', margin: '0 0 12px' }}>
                        {req.title}
                      </h3>

                      <div style={{ fontSize: '14px', color: '#334155', lineHeight: '1.6', marginBottom: '18px', background: '#FBFBFA', border: '1px solid rgba(10,14,23,0.06)', padding: '14px' }}>
                        <strong>Requirement Statement:</strong> {req.requirementText}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '12px', marginBottom: '16px' }}>
                        <div>
                          <div style={{ fontFamily: 'monospace', fontWeight: '700', color: '#047857', marginBottom: '4px' }}>
                            🔍 EXPECTED INSPECTION EVIDENCE:
                          </div>
                          <div style={{ color: '#475569', lineHeight: '1.5' }}>
                            {req.expectedEvidence}
                          </div>
                        </div>

                        <div>
                          <div style={{ fontFamily: 'monospace', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>
                            APPLICABLE AREAS & AFFECTED PROCESSES:
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {applicableAreas.map((area) => (
                              <span key={area} style={{ fontSize: '10px', fontFamily: 'monospace', background: '#E2E8F0', padding: '2px 8px', color: '#334155' }}>
                                🏢 {area}
                              </span>
                            ))}
                            {affectedProcesses.map((proc) => (
                              <span key={proc} style={{ fontSize: '10px', fontFamily: 'monospace', background: '#DCFCE7', padding: '2px 8px', color: '#166534' }}>
                                ⚙️ {proc}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Linked Knowledge Graph Relationships */}
                      <div style={{ borderTop: '1px solid rgba(10,14,23,0.08)', paddingTop: '14px', marginTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: '700', color: '#64748B' }}>
                            KNOWLEDGE GRAPH MAPPINGS ({req.relationships.length}):
                          </span>
                          {req.relationships.length === 0 ? (
                            <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#991B1B' }}>
                              ⚠️ No QMS Document or Audit Evidence Linked
                            </span>
                          ) : (
                            req.relationships.map((rel) => (
                              <span
                                key={rel.id}
                                style={{
                                  fontSize: '11px',
                                  fontFamily: 'monospace',
                                  background: '#F1F5F9',
                                  border: '1px solid rgba(10,14,23,0.15)',
                                  padding: '4px 10px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                }}
                              >
                                <strong>{rel.targetType}:</strong> {rel.targetTitle}
                                <button
                                  onClick={() => handleUnlinkEntity(rel.id)}
                                  style={{ background: 'transparent', border: 'none', color: '#991B1B', cursor: 'pointer', fontWeight: '700', padding: '0 2px' }}
                                >
                                  ×
                                </button>
                              </span>
                            ))
                          )}
                        </div>

                        {['QUALITY_MANAGER', 'REGULATORY_AFFAIRS', 'ADMIN', 'OWNER'].includes(currentUser?.role) && (
                          <button
                            onClick={() => setLinkingReqId(req.id)}
                            style={{ background: '#0A0E17', color: '#FBFBFA', border: 'none', padding: '6px 12px', fontSize: '11px', fontFamily: 'monospace', fontWeight: '700', cursor: 'pointer' }}
                          >
                            + LINK QMS EVIDENCE →
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: QUALITY TAXONOMY */}
          {activeSubTab === 'taxonomy' && (
            <div>
              <div style={{ background: '#FFFFFF', border: '1px solid rgba(10,14,23,0.15)', padding: '28px', marginBottom: '28px' }}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#047857', fontFamily: 'monospace', letterSpacing: '0.1em', marginBottom: '16px' }}>
                  QUALITY TAXONOMY CLASSIFICATION MATRIX
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                  {data.taxonomy.qualityAreas.map((area) => {
                    const areaReqs = data.requirements.filter(r => r.category === area);
                    return (
                      <div key={area} style={{ border: '1px solid rgba(10,14,23,0.1)', padding: '20px', background: '#FBFBFA' }}>
                        <div style={{ fontSize: '15px', fontWeight: '800', color: '#0A0E17', marginBottom: '6px' }}>
                          {area}
                        </div>
                        <div style={{ fontSize: '12px', fontFamily: 'monospace', color: '#047857', fontWeight: '700', marginBottom: '12px' }}>
                          {areaReqs.length} Active Requirements
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748B', lineHeight: '1.5' }}>
                          Contains governing rules for {area.toLowerCase()} compliance and verification checklists.
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: KNOWLEDGE GRAPH VISUALIZER */}
          {activeSubTab === 'graph' && (
            <div>
              <div style={{ background: '#FFFFFF', border: '1px solid rgba(10,14,23,0.15)', padding: '28px' }}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#047857', fontFamily: 'monospace', letterSpacing: '0.1em', marginBottom: '16px' }}>
                  RELATIONAL REGULATORY KNOWLEDGE GRAPH TOPOLOGY
                </div>

                <div style={{ background: '#0A0E17', color: '#FBFBFA', padding: '24px', fontFamily: 'monospace', fontSize: '12px', lineHeight: '1.8' }}>
                  <div style={{ color: '#10B981', fontWeight: '700', marginBottom: '12px' }}>
                    [VERITAS KNOWLEDGE GRAPH ENGINE — ACTIVE TOPOLOGY MAP]
                  </div>

                  {data.requirements.slice(0, 5).map((req) => (
                    <div key={req.id} style={{ marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
                      <div style={{ color: '#10B981', fontWeight: '700' }}>
                        ● REQUIREMENT: [{req.requirementId}] {req.title}
                      </div>
                      {req.relationships.length === 0 ? (
                        <div style={{ color: '#EF4444', marginLeft: '20px' }}>
                          └── ⚠️ (UNLINKED) Requires SOP Document or Audit Evidence Mapping
                        </div>
                      ) : (
                        req.relationships.map((rel, idx) => (
                          <div key={rel.id} style={{ color: '#E2E8F0', marginLeft: '20px' }}>
                            {idx === req.relationships.length - 1 ? '└──' : '├──'} [{rel.relationshipType}] ──&gt; ({rel.targetType}) {rel.targetTitle}
                          </div>
                        ))
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: PDF / REGULATORY IMPORT */}
          {activeSubTab === 'import' && (
            <div>
              <div style={{ background: '#FFFFFF', border: '1px solid rgba(10,14,23,0.15)', padding: '28px' }}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#047857', fontFamily: 'monospace', letterSpacing: '0.1em', marginBottom: '16px' }}>
                  INPUT REGULATORY DOCUMENT FOR STRUCTURED EXTRACTION
                </div>

                {importResult && (
                  <div style={{ background: '#F0FDF4', border: '1px solid #16A34A', color: '#15803D', padding: '16px', marginBottom: '20px', fontSize: '13px', fontFamily: 'monospace' }}>
                    {importResult}
                  </div>
                )}

                <form onSubmit={handleImportDocument}>
                  <div style={{ marginBottom: '18px' }}>
                    <label style={{ display: 'block', fontSize: '11px', fontFamily: 'monospace', fontWeight: '700', color: '#0A0E17', marginBottom: '6px' }}>
                      DOCUMENT TITLE / REGULATORY SOURCE
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. EU GMP Annex 11 Computerised Systems Revision"
                      value={importDocName}
                      onChange={(e) => setImportDocName(e.target.value)}
                      style={{ width: '100%', padding: '12px', border: '1px solid rgba(10,14,23,0.2)', fontSize: '13px', background: '#FBFBFA' }}
                      required
                    />
                  </div>

                  <div style={{ marginBottom: '18px' }}>
                    <label style={{ display: 'block', fontSize: '11px', fontFamily: 'monospace', fontWeight: '700', color: '#0A0E17', marginBottom: '6px' }}>
                      TARGET CHAPTER CLASSIFICATION
                    </label>
                    <select
                      value={importChapter}
                      onChange={(e) => setImportChapter(e.target.value)}
                      style={{ width: '100%', padding: '12px', border: '1px solid rgba(10,14,23,0.2)', fontSize: '13px', background: '#FBFBFA', fontFamily: 'monospace' }}
                    >
                      {data.taxonomy.chapters.map(ch => (
                        <option key={ch} value={ch}>{ch}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: '11px', fontFamily: 'monospace', fontWeight: '700', color: '#0A0E17', marginBottom: '6px' }}>
                      PASTE REGULATORY DOCUMENT TEXT (OR UPLOAD)
                    </label>
                    <textarea
                      rows={8}
                      placeholder="Paste regulatory text paragraphs here. System will parse statements and extract requirement candidates for Quality Manager review..."
                      value={importText}
                      onChange={(e) => setImportText(e.target.value)}
                      style={{ width: '100%', padding: '14px', border: '1px solid rgba(10,14,23,0.2)', fontSize: '13px', background: '#FBFBFA', fontFamily: 'monospace', lineHeight: '1.5' }}
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={importing}
                    style={{ background: '#0A0E17', color: '#FBFBFA', border: 'none', padding: '14px 28px', fontSize: '13px', fontFamily: 'monospace', fontWeight: '700', cursor: 'pointer' }}
                  >
                    {importing ? 'PARSING REGULATORY STATEMENTS...' : 'EXTRACT REGULATORY REQUIREMENTS →'}
                  </button>
                </form>
              </div>
            </div>
          )}
        </>
      )}

      {/* LINKING MODAL */}
      {linkingReqId && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(10,14,23,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#FFFFFF', border: '1px solid rgba(10,14,23,0.2)', padding: '32px', maxWidth: '520px', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(10,14,23,0.1)', paddingBottom: '16px', marginBottom: '20px' }}>
              <div style={{ fontSize: '16px', fontWeight: '800', color: '#0A0E17' }}>Link QMS Evidence to EU GMP Requirement</div>
              <button onClick={() => setLinkingReqId(null)} style={{ background: 'transparent', border: 'none', fontSize: '18px', cursor: 'pointer' }}>×</button>
            </div>

            <form onSubmit={handleLinkEntity}>
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontFamily: 'monospace', fontWeight: '700', marginBottom: '6px' }}>QMS ENTITY TYPE</label>
                <select
                  value={linkTargetType}
                  onChange={(e) => { setLinkTargetType(e.target.value); setLinkTargetId(''); }}
                  style={{ width: '100%', padding: '10px', border: '1px solid rgba(10,14,23,0.2)', fontSize: '13px', fontFamily: 'monospace' }}
                >
                  <option value="DOCUMENT">SOP Document</option>
                  <option value="CAPA">CAPA Record</option>
                  <option value="DEVIATION">Deviation Record</option>
                  <option value="AUDIT">Audit Plan</option>
                </select>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontFamily: 'monospace', fontWeight: '700', marginBottom: '6px' }}>SELECT TENANT QMS ENTITY</label>
                <select
                  value={linkTargetId}
                  onChange={(e) => setLinkTargetId(e.target.value)}
                  style={{ width: '100%', padding: '10px', border: '1px solid rgba(10,14,23,0.2)', fontSize: '13px', fontFamily: 'monospace' }}
                  required
                >
                  <option value="">Select entity...</option>
                  {linkTargetType === 'DOCUMENT' && data?.availableQmsEntities.documents.map(d => (
                    <option key={d.id} value={d.id}>{d.title} ({d.status})</option>
                  ))}
                  {linkTargetType === 'CAPA' && data?.availableQmsEntities.capas.map(c => (
                    <option key={c.id} value={c.id}>{c.title} ({c.status})</option>
                  ))}
                  {linkTargetType === 'DEVIATION' && data?.availableQmsEntities.deviations.map(d => (
                    <option key={d.id} value={d.id}>{d.title} ({d.status})</option>
                  ))}
                  {linkTargetType === 'AUDIT' && data?.availableQmsEntities.audits.map(a => (
                    <option key={a.id} value={a.id}>{a.title} ({a.status})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" onClick={() => setLinkingReqId(null)} style={{ background: '#F1F5F9', border: '1px solid rgba(10,14,23,0.2)', padding: '10px 18px', fontSize: '12px', fontFamily: 'monospace' }}>
                  Cancel
                </button>
                <button type="submit" style={{ background: '#0A0E17', color: '#FBFBFA', border: 'none', padding: '10px 20px', fontSize: '12px', fontFamily: 'monospace', fontWeight: '700', cursor: 'pointer' }}>
                  CREATE RELATIONSHIP LINK →
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────── TAB 7: VERSION & UPDATES ───────────────── */}
      {activeSubTab === 'updates' && (
        <div>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.12em', color: '#047857', fontFamily: 'monospace', textTransform: 'uppercase', marginBottom: '6px' }}>
                REGULATORY CONTENT AUTHORITY
              </div>
              <h3 style={{ fontSize: '22px', fontWeight: '800', color: '#0A0E17', margin: 0, letterSpacing: '-0.02em' }}>
                Version Control & Update Management
              </h3>
              <p style={{ fontSize: '13px', color: '#64748B', marginTop: '6px', maxWidth: '600px', lineHeight: '1.5' }}>
                Track regulatory content versions, check for updates from the Simpleafied Regulatory Content Authority, review changelogs, and apply updates to your compliance environment.
              </p>
            </div>
            <button
              onClick={async () => {
                setCheckingUpdates(true);
                setUpdateError(null);
                try {
                  const res = await fetch('/api/intelligence/updates', {
                    headers: { 'x-user-email': currentUser?.email || '' },
                  });
                  if (!res.ok) throw new Error(`HTTP ${res.status}`);
                  const json = await res.json();
                  setUpdateData(json);
                } catch (err: any) {
                  setUpdateError(err.message);
                } finally {
                  setCheckingUpdates(false);
                }
              }}
              disabled={checkingUpdates}
              style={{
                background: checkingUpdates ? '#94A3B8' : '#0A0E17',
                color: '#FBFBFA',
                border: 'none',
                padding: '14px 28px',
                fontSize: '12px',
                fontWeight: '700',
                fontFamily: 'monospace',
                letterSpacing: '0.06em',
                cursor: checkingUpdates ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {checkingUpdates ? (
                <><span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span> CHECKING…</>
              ) : (
                <>🔍 CHECK FOR UPDATES</>
              )}
            </button>
          </div>

          {updateError && (
            <div style={{ padding: '16px 20px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', marginBottom: '24px', fontSize: '13px', color: '#DC2626', fontFamily: 'monospace' }}>
              ⚠ Update check failed: {updateError}
            </div>
          )}

          {/* Current versions panel (always shown from main data) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '32px' }}>
            {data?.sources?.map((source: any) => (
              <div key={source.regulationId || source.id} style={{ background: '#FBFBFA', border: '1px solid rgba(10,14,23,0.12)', padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.1em', color: '#64748B', fontFamily: 'monospace', textTransform: 'uppercase', marginBottom: '4px' }}>
                      {source.authority || 'Regulatory Authority'}
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: '800', color: '#0A0E17', letterSpacing: '-0.02em' }}>
                      {source.title}
                    </div>
                  </div>
                  <div style={{
                    padding: '4px 12px',
                    fontSize: '11px',
                    fontWeight: '700',
                    fontFamily: 'monospace',
                    letterSpacing: '0.08em',
                    background: source.status === 'ACTIVE' ? 'rgba(4, 120, 87, 0.1)' : source.status === 'UPDATE_AVAILABLE' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(100, 116, 139, 0.1)',
                    color: source.status === 'ACTIVE' ? '#047857' : source.status === 'UPDATE_AVAILABLE' ? '#D97706' : '#64748B',
                    border: `1px solid ${source.status === 'ACTIVE' ? 'rgba(4, 120, 87, 0.3)' : source.status === 'UPDATE_AVAILABLE' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(100, 116, 139, 0.3)'}`,
                  }}>
                    {source.status || 'ACTIVE'}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div style={{ padding: '12px', background: 'rgba(10,14,23,0.03)', border: '1px solid rgba(10,14,23,0.06)' }}>
                    <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.1em', color: '#94A3B8', fontFamily: 'monospace', marginBottom: '4px' }}>INSTALLED VERSION</div>
                    <div style={{ fontSize: '18px', fontWeight: '800', color: '#0A0E17', fontFamily: 'monospace' }}>{source.version || 'N/A'}</div>
                  </div>
                  <div style={{ padding: '12px', background: 'rgba(10,14,23,0.03)', border: '1px solid rgba(10,14,23,0.06)' }}>
                    <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.1em', color: '#94A3B8', fontFamily: 'monospace', marginBottom: '4px' }}>REGION</div>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#0A0E17' }}>{source.region}</div>
                  </div>
                  <div style={{ padding: '12px', background: 'rgba(10,14,23,0.03)', border: '1px solid rgba(10,14,23,0.06)' }}>
                    <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.1em', color: '#94A3B8', fontFamily: 'monospace', marginBottom: '4px' }}>REQUIREMENTS</div>
                    <div style={{ fontSize: '18px', fontWeight: '800', color: '#0A0E17', fontFamily: 'monospace' }}>{data?.metrics?.totalRequirements ?? '—'}</div>
                  </div>
                </div>
              </div>
            )) ?? (
              <div style={{ gridColumn: '1 / -1', padding: '20px', textAlign: 'center', color: '#94A3B8', fontSize: '13px', fontFamily: 'monospace' }}>
                No regulation sources configured. Complete onboarding with a regulatory framework to populate this section.
              </div>
            )}
          </div>

          {/* Update check results */}
          {updateData && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid rgba(10,14,23,0.12)' }}>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#0A0E17', letterSpacing: '-0.01em' }}>
                  🔍 Update Check Results
                </div>
                <div style={{ fontSize: '11px', color: '#94A3B8', fontFamily: 'monospace' }}>
                  Last checked: {new Date(updateData.checkedAt).toLocaleString()}
                </div>
              </div>

              {updateData.sources?.map((src: any) => (
                <div key={src.regulationId} style={{ marginBottom: '24px', border: '1px solid rgba(10,14,23,0.12)', background: '#FBFBFA' }}>
                  {/* Source header */}
                  <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(10,14,23,0.08)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '20px' }}>{src.updateAvailable ? '⚠️' : '✅'}</span>
                        <div>
                          <div style={{ fontSize: '15px', fontWeight: '700', color: '#0A0E17' }}>{src.title}</div>
                          <div style={{ fontSize: '12px', color: '#64748B', fontFamily: 'monospace', marginTop: '2px' }}>
                            {src.authority} • {src.region}
                          </div>
                        </div>
                      </div>
                      <div style={{
                        padding: '6px 16px',
                        fontSize: '11px',
                        fontWeight: '800',
                        fontFamily: 'monospace',
                        letterSpacing: '0.08em',
                        background: src.status === 'UP_TO_DATE' ? 'rgba(4, 120, 87, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                        color: src.status === 'UP_TO_DATE' ? '#047857' : '#D97706',
                        border: `1px solid ${src.status === 'UP_TO_DATE' ? 'rgba(4, 120, 87, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                      }}>
                        {src.status === 'UP_TO_DATE' ? '● UP TO DATE' : '● UPDATE AVAILABLE'}
                      </div>
                    </div>
                  </div>

                  {/* Version comparison */}
                  <div style={{ padding: '20px 24px', display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '20px', alignItems: 'center' }}>
                    <div style={{ padding: '16px', background: 'rgba(10,14,23,0.03)', border: '1px solid rgba(10,14,23,0.08)', textAlign: 'center' }}>
                      <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.1em', color: '#94A3B8', fontFamily: 'monospace', marginBottom: '6px' }}>INSTALLED</div>
                      <div style={{ fontSize: '22px', fontWeight: '800', color: '#0A0E17', fontFamily: 'monospace' }}>{src.currentVersion}</div>
                    </div>
                    <div style={{ fontSize: '24px', color: src.updateAvailable ? '#D97706' : '#047857' }}>
                      {src.updateAvailable ? '→' : '='}
                    </div>
                    <div style={{ padding: '16px', background: src.updateAvailable ? 'rgba(245, 158, 11, 0.06)' : 'rgba(4, 120, 87, 0.06)', border: `1px solid ${src.updateAvailable ? 'rgba(245, 158, 11, 0.2)' : 'rgba(4, 120, 87, 0.2)'}`, textAlign: 'center' }}>
                      <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.1em', color: '#94A3B8', fontFamily: 'monospace', marginBottom: '6px' }}>LATEST AVAILABLE</div>
                      <div style={{ fontSize: '22px', fontWeight: '800', color: src.updateAvailable ? '#D97706' : '#047857', fontFamily: 'monospace' }}>{src.latestAvailableVersion}</div>
                    </div>
                  </div>

                  {/* Pending update details */}
                  {src.pendingUpdate && (
                    <div style={{ padding: '0 24px 24px' }}>
                      <div style={{ background: 'rgba(245, 158, 11, 0.06)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '20px' }}>
                        <div style={{ fontSize: '12px', fontWeight: '700', letterSpacing: '0.08em', color: '#D97706', fontFamily: 'monospace', marginBottom: '8px' }}>
                          PENDING UPDATE — QUALITY MANAGER REVIEW REQUIRED
                        </div>
                        <p style={{ fontSize: '13px', color: '#0A0E17', lineHeight: '1.6', margin: '0 0 16px' }}>
                          {src.pendingUpdate.summary}
                        </p>
                        <div style={{ fontSize: '12px', color: '#64748B', fontFamily: 'monospace', marginBottom: '16px' }}>
                          Published: {new Date(src.pendingUpdate.publishedAt).toLocaleDateString()}
                        </div>

                        {src.pendingUpdate.changelog?.length > 0 && (
                          <div style={{ marginBottom: '16px' }}>
                            <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.1em', color: '#64748B', fontFamily: 'monospace', marginBottom: '8px' }}>CHANGELOG</div>
                            {src.pendingUpdate.changelog.map((change: any, idx: number) => (
                              <div key={idx} style={{ display: 'flex', gap: '10px', padding: '8px 12px', background: change.type === 'ADDED' ? 'rgba(4,120,87,0.05)' : change.type === 'MODIFIED' ? 'rgba(59,130,246,0.05)' : 'rgba(239,68,68,0.05)', marginBottom: '4px', fontSize: '12px' }}>
                                <span style={{ fontWeight: '700', fontFamily: 'monospace', color: change.type === 'ADDED' ? '#047857' : change.type === 'MODIFIED' ? '#2563EB' : '#DC2626', minWidth: '80px' }}>
                                  {change.type === 'ADDED' ? '+ ADDED' : change.type === 'MODIFIED' ? '~ MODIFIED' : '- DEPRECATED'}
                                </span>
                                <span style={{ color: '#0A0E17' }}>{change.requirementId}: {change.description}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                          <button
                            onClick={async () => {
                              try {
                                await fetch('/api/intelligence/updates', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json', 'x-user-email': currentUser?.email || '' },
                                  body: JSON.stringify({ regulationId: src.regulationId, action: 'DISMISS' }),
                                });
                                // Re-check
                                const res = await fetch('/api/intelligence/updates', { headers: { 'x-user-email': currentUser?.email || '' } });
                                if (res.ok) setUpdateData(await res.json());
                              } catch (err) { console.error(err); }
                            }}
                            style={{ background: '#F1F5F9', border: '1px solid rgba(10,14,23,0.2)', padding: '10px 20px', fontSize: '12px', fontFamily: 'monospace', fontWeight: '700', cursor: 'pointer' }}
                          >
                            DISMISS
                          </button>
                          <button
                            disabled={applyingUpdate}
                            onClick={async () => {
                              setApplyingUpdate(true);
                              try {
                                const res = await fetch('/api/intelligence/updates', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json', 'x-user-email': currentUser?.email || '' },
                                  body: JSON.stringify({ regulationId: src.regulationId, action: 'APPLY' }),
                                });
                                if (res.ok) {
                                  // Re-check to refresh the panel
                                  const checkRes = await fetch('/api/intelligence/updates', { headers: { 'x-user-email': currentUser?.email || '' } });
                                  if (checkRes.ok) setUpdateData(await checkRes.json());
                                  fetchRequirements();
                                }
                              } catch (err) { console.error(err); } finally {
                                setApplyingUpdate(false);
                              }
                            }}
                            style={{
                              background: applyingUpdate ? '#94A3B8' : '#047857',
                              color: '#FBFBFA',
                              border: 'none',
                              padding: '10px 24px',
                              fontSize: '12px',
                              fontFamily: 'monospace',
                              fontWeight: '700',
                              letterSpacing: '0.06em',
                              cursor: applyingUpdate ? 'not-allowed' : 'pointer',
                            }}
                          >
                            {applyingUpdate ? 'APPLYING…' : '⚡ REVIEW & APPLY UPDATE'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Update history */}
                  {src.recentUpdateHistory?.length > 0 && (
                    <div style={{ padding: '0 24px 24px' }}>
                      <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.1em', color: '#64748B', fontFamily: 'monospace', marginBottom: '12px' }}>
                        UPDATE HISTORY
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid rgba(10,14,23,0.12)' }}>
                            {['Version Transition', 'Published', 'Applied', 'Status', 'Changes'].map(h => (
                              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: '700', fontFamily: 'monospace', letterSpacing: '0.06em', color: '#64748B', fontSize: '10px' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {src.recentUpdateHistory.map((log: any) => (
                            <tr key={log.id} style={{ borderBottom: '1px solid rgba(10,14,23,0.06)' }}>
                              <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: '700' }}>
                                {log.fromVersion} → {log.toVersion}
                              </td>
                              <td style={{ padding: '10px 12px', color: '#64748B' }}>
                                {new Date(log.publishedAt).toLocaleDateString()}
                              </td>
                              <td style={{ padding: '10px 12px', color: '#64748B' }}>
                                {log.appliedAt ? new Date(log.appliedAt).toLocaleDateString() : '—'}
                              </td>
                              <td style={{ padding: '10px 12px' }}>
                                <span style={{
                                  padding: '2px 8px',
                                  fontSize: '10px',
                                  fontWeight: '700',
                                  fontFamily: 'monospace',
                                  background: log.status === 'APPLIED' ? 'rgba(4,120,87,0.1)' : log.status === 'DISMISSED' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                                  color: log.status === 'APPLIED' ? '#047857' : log.status === 'DISMISSED' ? '#DC2626' : '#D97706',
                                }}>
                                  {log.status}
                                </span>
                              </td>
                              <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '11px', color: '#64748B' }}>
                                +{log.addedRequirements} / ~{log.modifiedRequirements} / -{log.deprecatedRequirements}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Metadata footer */}
                  <div style={{ padding: '16px 24px', background: 'rgba(10,14,23,0.02)', borderTop: '1px solid rgba(10,14,23,0.06)', display: 'flex', gap: '24px', fontSize: '11px', color: '#94A3B8', fontFamily: 'monospace' }}>
                    <span>Requirements: <strong style={{ color: '#0A0E17' }}>{src.requirementCount}</strong></span>
                    <span>Last reviewed: <strong style={{ color: '#0A0E17' }}>{new Date(src.lastReviewedDate).toLocaleDateString()}</strong></span>
                    <span>Last checked: <strong style={{ color: '#0A0E17' }}>{new Date(src.lastCheckedForUpdate).toLocaleDateString()}</strong></span>
                    {src.sourceUrl && (
                      <a href={src.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#2563EB', textDecoration: 'none' }}>
                        Official Source ↗
                      </a>
                    )}
                  </div>
                </div>
              ))}

              {/* Architecture explanation */}
              <div style={{ marginTop: '32px', padding: '24px', background: 'rgba(10,14,23,0.02)', border: '1px solid rgba(10,14,23,0.08)' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.1em', color: '#64748B', fontFamily: 'monospace', marginBottom: '12px' }}>
                  HOW REGULATORY CONTENT UPDATES WORK
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px' }}>
                  {[
                    { step: '01', title: 'Monitor', desc: 'Simpleafied monitors EMA, EC, and national authority publications for regulatory changes.' },
                    { step: '02', title: 'Package', desc: 'Changes are structured into versioned content packages with requirement-level diffs.' },
                    { step: '03', title: 'Notify', desc: 'Your Veritas instance is notified when a new version is available for your regulatory scope.' },
                    { step: '04', title: 'Review & Apply', desc: 'Your Quality Manager reviews the changelog and applies the update with full audit trail.' },
                  ].map((s) => (
                    <div key={s.step} style={{ padding: '16px' }}>
                      <div style={{ fontSize: '24px', fontWeight: '800', color: '#047857', fontFamily: 'monospace', marginBottom: '8px' }}>{s.step}</div>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#0A0E17', marginBottom: '4px' }}>{s.title}</div>
                      <div style={{ fontSize: '12px', color: '#64748B', lineHeight: '1.5' }}>{s.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Initial state — before first check */}
          {!updateData && !checkingUpdates && !updateError && (
            <div style={{ textAlign: 'center', padding: '60px 20px', background: 'rgba(10,14,23,0.02)', border: '1px dashed rgba(10,14,23,0.15)' }}>
              <div style={{ fontSize: '40px', marginBottom: '16px' }}>🔄</div>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#0A0E17', marginBottom: '8px' }}>No update check performed yet</div>
              <p style={{ fontSize: '13px', color: '#64748B', maxWidth: '500px', margin: '0 auto 20px', lineHeight: '1.5' }}>
                Click <strong>&ldquo;Check for Updates&rdquo;</strong> to connect to the Simpleafied Regulatory Content Authority and verify that your regulatory knowledge base is running the latest approved version.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
