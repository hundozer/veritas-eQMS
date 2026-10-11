// Builds the request the document screen sends when someone signs a review or
// an approval. Kept outside the page so it can be tested without a browser.
export type SigningMode = 'REVIEW' | 'APPROVE' | 'RELEASE' | 'RETIRE' | 'READ';

export const SIGNING_LABELS: Record<SigningMode, { title: string; meaning: string; submit: string }> = {
  REVIEW: { title: 'Sign review', meaning: 'Reviewed', submit: 'Sign as reviewed' },
  APPROVE: { title: 'Sign approval', meaning: 'Approved', submit: 'Sign as approved' },
  RELEASE: { title: 'Sign release', meaning: 'Released', submit: 'Sign and make effective' },
  RETIRE: { title: 'Sign retirement', meaning: 'Retired', submit: 'Sign and retire' },
  READ: { title: 'Sign training', meaning: 'Read and understood', submit: 'Sign as read and understood' },
};

/** What accepting each signature does, shown in the signing dialog before the password. */
export const SIGNING_CONSEQUENCE: Record<SigningMode, string> = {
  REVIEW: 'Your review is recorded; the assigned approver can then sign.',
  APPROVE: 'Approval does not make the document effective; it must still be released.',
  RELEASE: 'Releasing makes this version effective now and supersedes the previously effective version.',
  RETIRE: 'Retiring takes the document out of use; its versions and records are kept.',
  READ: 'Your training on this version is then complete.',
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
