// Builds the request the document screen sends when someone signs a review or
// an approval. Kept outside the page so it can be tested without a browser.
export type SigningMode = 'REVIEW' | 'APPROVE' | 'RELEASE' | 'RETIRE' | 'READ';

export const SIGNING_LABELS: Record<SigningMode, { title: string; meaning: string; submit: string }> = {
  REVIEW: { title: 'Sign Review', meaning: 'Reviewed', submit: 'Sign as Reviewed' },
  APPROVE: { title: 'Sign Approval', meaning: 'Approved', submit: 'Sign as Approved' },
  RELEASE: { title: 'Sign Release', meaning: 'Released', submit: 'Sign and Make Effective' },
  RETIRE: { title: 'Sign Retirement', meaning: 'Retired', submit: 'Sign and Retire' },
  READ: { title: 'Sign Training', meaning: 'Read and understood', submit: 'Sign as Read and Understood' },
};

/** Retirement needs a reason; the other signatures take an optional comment. */
export const REASON_REQUIRED: Record<SigningMode, boolean> = { REVIEW: false, APPROVE: false, RELEASE: false, RETIRE: true, READ: false };

/** `targetId` is the document, or for READ the training assignment. */
export function signingRequest(mode: SigningMode, targetId: string, comment: string, password: string) {
  const trimmed = comment.trim();
  if (mode === 'READ') return { path: `/api/trainings/${targetId}/sign`, method: 'POST', body: { comment: trimmed, password } };
  if (mode === 'REVIEW') return { path: `/api/documents/${targetId}/review`, method: 'POST', body: { action: 'COMPLETE', comment: trimmed, password } };
  if (mode === 'APPROVE') return { path: `/api/documents/${targetId}/approve`, method: 'POST', body: { comment: trimmed, password } };
  if (mode === 'RELEASE') return { path: `/api/documents/${targetId}/release`, method: 'POST', body: { comment: trimmed, password } };
  return { path: `/api/documents/${targetId}`, method: 'DELETE', body: { reason: trimmed, password } };
}
