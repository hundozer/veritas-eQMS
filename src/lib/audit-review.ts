// Audit review (DEC-077): turns a stored audit payload into the field changes
// (before → after) and the other recorded details, for the review screen and
// the PDF export. Payloads are written by writeMandatoryAudit in several shapes:
// a status transition ({ before, after }), named pairs ({ accountStatus: { before,
// after } }) or whole records ({ before: {...}, after: {...} }).

// Actions written to the tenant audit log, for the review screen's filter.
export const AUDIT_ACTIONS = [
  'DOCUMENT_CREATED', 'DOCUMENT_DRAFT_UPDATED', 'DOCUMENT_SUBMITTED_FOR_REVIEW', 'DOCUMENT_REVIEW_COMPLETED',
  'DOCUMENT_RETURNED_FOR_CHANGES', 'DOCUMENT_APPROVED', 'DOCUMENT_RELEASED', 'DOCUMENT_SUPERSEDED',
  'DOCUMENT_REVISION_CREATED', 'DOCUMENT_REVISION_WITHDRAWN', 'DOCUMENT_OBSOLETED',
  'SIGNATURE_APPLIED', 'SIGNATURE_FAILED', 'TRAINING_ASSIGNED', 'TRAINING_COMPLETED',
  'USER_INVITED', 'USER_INVITATION_RESENT',
] as const;

export type AuditChange = { field: string; before: string; after: string };
export type AuditDetail = { field: string; value: string };

export function describeAuditPayload(payload: string): { changes: AuditChange[]; details: AuditDetail[] } {
  let data: unknown;
  try {
    data = JSON.parse(payload);
  } catch {
    return { changes: [], details: [] };
  }
  if (!isRecord(data)) return { changes: [], details: [] };

  const changes: AuditChange[] = [];
  const details: AuditDetail[] = [];
  const { before, after, ...rest } = data;

  if (isRecord(before) && isRecord(after)) {
    for (const field of new Set([...Object.keys(before), ...Object.keys(after)])) {
      if (text(before[field]) !== text(after[field])) changes.push({ field, before: text(before[field]), after: text(after[field]) });
    }
  } else if (before !== undefined || after !== undefined) {
    changes.push({ field: 'status', before: text(before), after: text(after) });
  }

  for (const [field, value] of Object.entries(rest)) {
    if (value === undefined) continue;
    if (isRecord(value) && Object.keys(value).length === 2 && 'before' in value && 'after' in value) {
      changes.push({ field, before: text(value.before), after: text(value.after) });
    } else {
      details.push({ field, value: text(value) });
    }
  }
  return { changes, details };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (Array.isArray(value)) return value.map(text).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
