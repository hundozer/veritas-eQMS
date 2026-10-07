// Builds the request the document screen sends when someone signs a review or
// an approval. Kept outside the page so it can be tested without a browser.
export type SigningMode = 'REVIEW' | 'APPROVE';

export const SIGNING_LABELS: Record<SigningMode, { title: string; meaning: string; submit: string }> = {
  REVIEW: { title: 'Sign Review', meaning: 'Reviewed', submit: 'Sign as Reviewed' },
  APPROVE: { title: 'Sign Approval', meaning: 'Approved', submit: 'Sign as Approved' },
};

export function signingRequest(mode: SigningMode, documentId: string, comment: string, password: string) {
  const trimmed = comment.trim();
  return mode === 'REVIEW'
    ? { path: `/api/documents/${documentId}/review`, body: { action: 'COMPLETE', comment: trimmed, password } }
    : { path: `/api/documents/${documentId}/approve`, body: { comment: trimmed, password } };
}
