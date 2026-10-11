import styles from './audit-trail.module.css';
import { AUDIT_ACTIONS, type AuditChange, type AuditDetail } from '@/lib/audit-review';
import { groupByUtcDay, isExceptional, utcTime } from '@/lib/audit-ledger';

export interface AuditEntry {
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

interface AuditTrailProps {
  entries: AuditEntry[];
  actionFilter: string;
  typeFilter: string;
  onActionFilter: (value: string) => void;
  onTypeFilter: (value: string) => void;
  // The PDF export link, or null when the member may not export (audit.export).
  exportHref: string | null;
}

const RECORD_TYPES: Array<[string, string]> = [
  ['Document', 'Document'],
  ['DocumentVersion', 'Document version'],
  ['TrainingAssignment', 'Training assignment'],
  ['User', 'User'],
];

function formatDay(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

// The Audit trail tab: the newest entries matching the filters, as a ledger
// grouped by UTC day, each with who did what to which record and what changed.
export default function AuditTrail({ entries, actionFilter, typeFilter, onActionFilter, onTypeFilter, exportHref }: AuditTrailProps) {
  const days = groupByUtcDay(entries);

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <div>
          <h2 className={styles.headline}>Audit trail</h2>
          <p className={styles.lede}>
            The newest 200 audit entries matching the filters, with what changed. Audit entries cannot be edited or deleted.
          </p>
        </div>
        {exportHref && <a className={styles.outline} href={exportHref}>Export PDF</a>}
      </header>

      <form className={styles.filters} onSubmit={(e) => e.preventDefault()} aria-label="Filter the audit trail">
        <label className={styles.field}>
          <span className={styles.label}>Action</span>
          <select className={styles.select} value={actionFilter} onChange={(e) => onActionFilter(e.target.value)}>
            <option value="">All actions</option>
            {AUDIT_ACTIONS.map((action) => <option key={action} value={action}>{action}</option>)}
          </select>
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Record type</span>
          <select className={styles.select} value={typeFilter} onChange={(e) => onTypeFilter(e.target.value)}>
            <option value="">All records</option>
            {RECORD_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <span className={styles.count}>
          {entries.length} entr{entries.length === 1 ? 'y' : 'ies'}{entries.length >= 200 ? ' (the newest 200)' : ''} · times in UTC
        </span>
      </form>

      {days.length === 0 ? (
        <p className={styles.empty}>No audit entries match these filters.</p>
      ) : (
        days.map(({ day, entries: dayEntries }) => (
          <section key={day} aria-label={formatDay(day)} className={styles.day}>
            <h3 className={styles.dayTitle}>{formatDay(day)}</h3>
            <ol className={styles.entries}>
              {dayEntries.map((entry) => {
                const exceptional = isExceptional(entry.status);
                return (
                  <li key={entry.id} className={`${styles.entry} ${exceptional ? styles.exceptional : ''}`}>
                    <time className={styles.time} dateTime={entry.timestamp}>{utcTime(entry.timestamp)}</time>
                    <div className={styles.body}>
                      <div className={styles.line}>
                        <span className={styles.action}>{entry.action}</span>
                        {exceptional && <span className={styles.outcome}>{entry.status}</span>}
                      </div>
                      <div className={styles.who}>
                        {entry.userEmail ?? 'unknown user'}
                        {entry.userRole && <span className={styles.muted}> · {entry.userRole}</span>}
                      </div>
                      <div className={styles.record}>
                        {entry.objectType}{entry.objectId && <span className={styles.mono}> {entry.objectId}</span>}
                      </div>
                      {entry.changes.length > 0 && (
                        <table className={styles.changes}>
                          <thead><tr><th scope="col">Field</th><th scope="col">Before</th><th scope="col">After</th></tr></thead>
                          <tbody>
                            {entry.changes.map((change) => (
                              <tr key={change.field}>
                                <th scope="row">{change.field}</th>
                                <td>{change.before || '—'}</td>
                                <td>{change.after || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                      {entry.details.length > 0 && (
                        <dl className={styles.details}>
                          {entry.details.map((detail) => (
                            <div key={detail.field}><dt>{detail.field}</dt><dd>{detail.value || '—'}</dd></div>
                          ))}
                        </dl>
                      )}
                      <div className={styles.eventId}>event {entry.eventId}</div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        ))
      )}
    </div>
  );
}
