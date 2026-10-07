// Builds the request the document screen sends when someone signs a review or
// an approval. Kept outside the page so it can be tested without a browser.
export type SigningMode = 'REVIEW' | 'APPROVE' | 'RELEASE' | 'RETIRE';

export const SIGNING_LABELS: Record<SigningMode, { title: string; meaning: string; submit: string }> = {
  REVIEW: { title: 'Sign Review', meaning: 'Reviewed', submit: 'Sign as Reviewed' },
  APPROVE: { title: 'Sign Approval', meaning: 'Approved', submit: 'Sign as Approved' },
  RELEASE: { title: 'Sign Release', meaning: 'Released', submit: 'Sign and Make Effective' },
  RETIRE: { title: 'Sign Retirement', meaning: 'Retired', submit: 'Sign and Retire' },
};

/** Retirement needs a reason; the other signatures take an optional comment. */
export const REASON_REQUIRED: Record<SigningMode, boolean> = { REVIEW: false, APPROVE: false, RELEASE: false, RETIRE: true };

export function signingRequest(mode: SigningMode, documentId: string, comment: string, password: string) {
  const trimmed = comment.trim();
  if (mode === 'REVIEW') return { path: `/api/documents/${documentId}/review`, method: 'POST', body: { action: 'COMPLETE', comment: trimmed, password } };
  if (mode === 'APPROVE') return { path: `/api/documents/${documentId}/approve`, method: 'POST', body: { comment: trimmed, password } };
  if (mode === 'RELEASE') return { path: `/api/documents/${documentId}/release`, method: 'POST', body: { comment: trimmed, password } };
  return { path: `/api/documents/${documentId}`, method: 'DELETE', body: { reason: trimmed, password } };
}
