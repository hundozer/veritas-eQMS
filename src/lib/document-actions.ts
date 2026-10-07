// Which document actions the interface offers, derived from the persisted
// permissions the server enforces on every request. Job titles and role names
// never decide this; the server remains the authority for every action.
export type DocumentActions = {
  canAuthor: boolean;
  canReview: boolean;
  canApprove: boolean;
  canObsolete: boolean;
  canRelease: boolean;
};

export function documentActionsFor(permissions: readonly string[] | undefined): DocumentActions {
  const granted = new Set(permissions ?? []);
  return {
    canAuthor: granted.has('documents.create'),
    canReview: granted.has('documents.review'),
    canApprove: granted.has('documents.approve'),
    canObsolete: granted.has('documents.obsolete'),
    canRelease: granted.has('documents.release'),
  };
}
