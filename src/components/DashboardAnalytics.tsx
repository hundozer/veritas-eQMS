'use client';

import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend, RadialBarChart, RadialBar,
} from 'recharts';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */
interface Deviation {
  id: string;
  classification: string;
  status: string;
  createdAt: string;
}

interface CAPA {
  id: string;
  status: string;
  dueDate: string;
  completedAt: string | null;
}

interface Document {
  id: string;
  status: string;
}

interface TrainingAssignment {
  id: string;
  status: string;
}

interface Equipment {
  id: string;
  status: string;
  nextCalibrationDueDate: string;
}

interface DashboardAnalyticsProps {
  documents: Document[];
  deviations: Deviation[];
  capas: CAPA[];
  trainings: TrainingAssignment[];
  equipment: Equipment[];
}

/* ------------------------------------------------------------------ */
/*  Palette                                                           */
/* ------------------------------------------------------------------ */
const COLORS = {
  emerald: '#10B981',
  amber: '#F59E0B',
  rose: '#F87171',
  indigo: '#6366F1',
  cyan: '#06B6D4',
  slate: '#64748B',
  violet: '#8B5CF6',
  pink: '#EC4899',
};

const PIE_COLORS = [COLORS.indigo, COLORS.emerald, COLORS.amber, COLORS.rose, COLORS.cyan, COLORS.violet];

/* ------------------------------------------------------------------ */
/*  Custom Tooltip                                                    */
/* ------------------------------------------------------------------ */
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(15, 18, 28, 0.95)',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: '8px',
      padding: '10px 14px',
      fontSize: '12px',
      color: '#fff',
      backdropFilter: 'blur(12px)',
    }}>
      {label && <div style={{ fontWeight: 600, marginBottom: '4px', color: 'rgba(255,255,255,0.6)' }}>{label}</div>}
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: p.color, display: 'inline-block' }} />
          <span>{p.name}: <strong>{p.value}</strong></span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Gauge Card (radial bar for single-value KPIs)                     */
/* ------------------------------------------------------------------ */
function GaugeCard({ title, value, max, unit, color, subtitle }: {
  title: string; value: number; max: number; unit: string; color: string; subtitle: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const data = [{ name: title, value: pct, fill: color }];

  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '12px',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>
      <div style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: '8px' }}>{title}</div>
      <div style={{ width: '120px', height: '80px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%"
            cy="100%"
            innerRadius="70%"
            outerRadius="100%"
            startAngle={180}
            endAngle={0}
            barSize={10}
            data={data}
          >
            <RadialBar
              dataKey="value"
              cornerRadius={5}
              background={{ fill: 'rgba(255,255,255,0.06)' }}
            />
          </RadialBarChart>
        </ResponsiveContainer>
      </div>
      <div style={{ fontSize: '28px', fontWeight: 700, color, marginTop: '-8px' }}>{pct}{unit}</div>
      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>{subtitle}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                    */
/* ------------------------------------------------------------------ */
export default function DashboardAnalytics({ documents, deviations, capas, trainings, equipment }: DashboardAnalyticsProps) {

  // ── Document Status Breakdown ──
  const docStatusData = (() => {
    const counts: Record<string, number> = {};
    documents.forEach(d => { counts[d.status] = (counts[d.status] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  })();

  // ── Deviation Classification Breakdown ──
  const devClassData = (() => {
    const counts: Record<string, number> = {};
    deviations.forEach(d => { counts[d.classification] = (counts[d.classification] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  })();

  // ── Deviation Status Breakdown (for bar chart) ──
  const devStatusData = (() => {
    const counts: Record<string, number> = {};
    deviations.forEach(d => { counts[d.status] = (counts[d.status] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  })();

  // ── CAPA Metrics ──
  const totalCapas = capas.length;
  const closedCapas = capas.filter(c => c.status === 'CLOSED').length;
  const overdueCapas = capas.filter(c => c.status !== 'CLOSED' && new Date(c.dueDate) < new Date()).length;
  const onTimeClosedCapas = capas.filter(c => c.status === 'CLOSED' && c.completedAt && new Date(c.completedAt) <= new Date(c.dueDate)).length;
  const capaOnTimeRate = closedCapas > 0 ? Math.round((onTimeClosedCapas / closedCapas) * 100) : 100;

  // ── Training Compliance ──
  const totalTrainings = trainings.length;
  const completedTrainings = trainings.filter(t => t.status === 'COMPLETED').length;
  const trainingComplianceRate = totalTrainings > 0 ? Math.round((completedTrainings / totalTrainings) * 100) : 100;

  // ── Equipment Health ──
  const totalEq = equipment.length;
  const activeEq = equipment.filter(e => e.status === 'ACTIVE').length;
  const oosEq = equipment.filter(e => e.status === 'OUT_OF_SERVICE').length;
  const overdueEq = equipment.filter(e => new Date(e.nextCalibrationDueDate) < new Date() && e.status !== 'OUT_OF_SERVICE').length;

  const eqStatusData = (() => {
    const counts: Record<string, number> = {};
    equipment.forEach(e => { counts[e.status] = (counts[e.status] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  })();

  // ── CAPA Status for bar chart ──
  const capaStatusData = (() => {
    const counts: Record<string, number> = {};
    capas.forEach(c => { counts[c.status] = (counts[c.status] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  })();

  const cardStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '12px',
    padding: '20px',
  };

  const sectionTitle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 700,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: '16px',
    letterSpacing: '0.3px',
  };

  const classColor = (cls: string) => {
    if (cls === 'CRITICAL') return COLORS.rose;
    if (cls === 'MAJOR') return COLORS.amber;
    return COLORS.emerald;
  };

  const statusColor = (status: string) => {
    if (status === 'EFFECTIVE' || status === 'ACTIVE' || status === 'CLOSED' || status === 'COMPLETED') return COLORS.emerald;
    if (status === 'DRAFT' || status === 'ASSIGNED' || status === 'UNDER_MAINTENANCE') return COLORS.slate;
    if (status === 'OUT_OF_SERVICE' || status === 'OVERDUE') return COLORS.rose;
    return COLORS.amber;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* ── ROW 1: KPI Gauges ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        <GaugeCard
          title="Training Compliance"
          value={completedTrainings}
          max={totalTrainings}
          unit="%"
          color={trainingComplianceRate >= 80 ? COLORS.emerald : trainingComplianceRate >= 50 ? COLORS.amber : COLORS.rose}
          subtitle={`${completedTrainings} of ${totalTrainings} completed`}
        />
        <GaugeCard
          title="CAPA On-Time Closure"
          value={onTimeClosedCapas}
          max={closedCapas || 1}
          unit="%"
          color={capaOnTimeRate >= 80 ? COLORS.emerald : capaOnTimeRate >= 50 ? COLORS.amber : COLORS.rose}
          subtitle={`${onTimeClosedCapas} of ${closedCapas} closed on time`}
        />
        <GaugeCard
          title="Equipment Uptime"
          value={activeEq}
          max={totalEq || 1}
          unit="%"
          color={oosEq === 0 && overdueEq === 0 ? COLORS.emerald : overdueEq > 0 ? COLORS.amber : COLORS.rose}
          subtitle={`${activeEq} active, ${oosEq} OOS, ${overdueEq} overdue`}
        />
        <GaugeCard
          title="Document Readiness"
          value={documents.filter(d => d.status === 'EFFECTIVE').length}
          max={documents.length || 1}
          unit="%"
          color={COLORS.indigo}
          subtitle={`${documents.filter(d => d.status === 'EFFECTIVE').length} of ${documents.length} effective`}
        />
      </div>

      {/* ── ROW 2: Charts ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

        {/* Document Status Pie */}
        <div style={cardStyle}>
          <div style={sectionTitle}>Document Status Breakdown</div>
          {docStatusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={docStatusData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  stroke="none"
                >
                  {docStatusData.map((entry, i) => (
                    <Cell key={entry.name} fill={statusColor(entry.name)} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}
                  iconType="circle"
                  iconSize={8}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>No documents</div>
          )}
        </div>

        {/* Deviation Classification Pie */}
        <div style={cardStyle}>
          <div style={sectionTitle}>Deviation Classification</div>
          {devClassData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={devClassData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  stroke="none"
                >
                  {devClassData.map((entry) => (
                    <Cell key={entry.name} fill={classColor(entry.name)} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}
                  iconType="circle"
                  iconSize={8}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>No deviations</div>
          )}
        </div>
      </div>

      {/* ── ROW 3: Bar Charts ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

        {/* Deviation Status Bar */}
        <div style={cardStyle}>
          <div style={sectionTitle}>Deviation Status Pipeline</div>
          {devStatusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={devStatusData} barSize={28}>
                <XAxis
                  dataKey="name"
                  tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="value" name="Deviations" radius={[4, 4, 0, 0]}>
                  {devStatusData.map((entry) => (
                    <Cell key={entry.name} fill={statusColor(entry.name)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>No deviations</div>
          )}
        </div>

        {/* CAPA Status Bar */}
        <div style={cardStyle}>
          <div style={sectionTitle}>CAPA Status Pipeline</div>
          {capaStatusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={capaStatusData} barSize={28}>
                <XAxis
                  dataKey="name"
                  tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="value" name="CAPAs" radius={[4, 4, 0, 0]}>
                  {capaStatusData.map((entry) => (
                    <Cell key={entry.name} fill={statusColor(entry.name)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>No CAPAs</div>
          )}
        </div>
      </div>

      {/* ── ROW 4: Equipment Status + Summary Metrics ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

        {/* Equipment Status Pie */}
        <div style={cardStyle}>
          <div style={sectionTitle}>Equipment Status</div>
          {eqStatusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={eqStatusData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  stroke="none"
                >
                  {eqStatusData.map((entry, i) => (
                    <Cell key={entry.name} fill={statusColor(entry.name)} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}
                  iconType="circle"
                  iconSize={8}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>No equipment</div>
          )}
        </div>

        {/* Summary Metrics Table */}
        <div style={cardStyle}>
          <div style={sectionTitle}>Compliance Summary</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { label: 'Total Documents', value: documents.length, color: COLORS.indigo },
              { label: 'Open Deviations', value: deviations.filter(d => d.status !== 'CLOSED').length, color: deviations.filter(d => d.status !== 'CLOSED').length > 0 ? COLORS.amber : COLORS.emerald },
              { label: 'Open CAPAs', value: capas.filter(c => c.status !== 'CLOSED').length, color: capas.filter(c => c.status !== 'CLOSED').length > 0 ? COLORS.amber : COLORS.emerald },
              { label: 'Overdue CAPAs', value: overdueCapas, color: overdueCapas > 0 ? COLORS.rose : COLORS.emerald },
              { label: 'Pending Trainings', value: trainings.filter(t => t.status === 'ASSIGNED').length, color: trainings.filter(t => t.status === 'ASSIGNED').length > 0 ? COLORS.amber : COLORS.emerald },
              { label: 'Equipment OOS', value: oosEq, color: oosEq > 0 ? COLORS.rose : COLORS.emerald },
              { label: 'Calibration Overdue', value: overdueEq, color: overdueEq > 0 ? COLORS.rose : COLORS.emerald },
            ].map((item) => (
              <div key={item.label} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 14px',
                background: 'rgba(255,255,255,0.02)',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.05)',
              }}>
                <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>{item.label}</span>
                <span style={{ fontSize: '18px', fontWeight: 700, color: item.color }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
