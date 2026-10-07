// Builds the request the document screen sends when someone signs a review or
// an approval. Kept outside the page so it can be tested without a browser.
export type SigningMode = 'REVIEW' | 'APPROVE' | 'RELEASE';

export const SIGNING_LABELS: Record<SigningMode, { title: string; meaning: string; submit: string }> = {
  REVIEW: { title: 'Sign Review', meaning: 'Reviewed', submit: 'Sign as Reviewed' },
  APPROVE: { title: 'Sign Approval', meaning: 'Approved', submit: 'Sign as Approved' },
  RELEASE: { title: 'Sign Release', meaning: 'Released', submit: 'Sign and Make Effective' },
};

export function signingRequest(mode: SigningMode, documentId: string, comment: string, password: string) {
  const trimmed = comment.trim();
  if (mode === 'REVIEW') return { path: `/api/documents/${documentId}/review`, body: { action: 'COMPLETE', comment: trimmed, password } };
  if (mode === 'APPROVE') return { path: `/api/documents/${documentId}/approve`, body: { comment: trimmed, password } };
  return { path: `/api/documents/${documentId}/release`, body: { comment: trimmed, password } };
}
