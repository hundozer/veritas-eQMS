import { documentActionsFor } from './document-actions';

// Which actions the Documents tab offers on one document, for one member.
// The interface only offers what persisted permissions and the per-record
// assignment allow; every route checks the same rules again on submit.

export type PanelAction =
  | 'REPLACE_FILE'
  | 'SUBMIT_REVIEW'
  | 'SIGN_REVIEW'
  | 'RETURN'
  | 'SIGN_APPROVE'
  | 'SIGN_RELEASE'
  | 'START_REVISION'
  | 'WITHDRAW_REVISION'
  | 'SIGN_RETIRE';

interface PanelDocument {
  status: string;
  currentVersionNumber: number;
  versions: Array<{
    versionNumber: number;
    status: string;
    approvalRoutes?: Array<{ steps: Array<{ stepType: string; status: string; approver: { id: string } }> }>;
  }>;
}

export function documentPanelActions(
  doc: PanelDocument,
  userId: string | undefined,
  permissions: readonly string[] | undefined,
): PanelAction[] {
  const can = documentActionsFor(permissions);
  const steps = doc.versions.find((v) => v.versionNumber === doc.currentVersionNumber)?.approvalRoutes?.[0]?.steps ?? [];
  const review = steps.find((step) => step.stepType === 'REVIEW');
  const approval = steps.find((step) => step.stepType === 'APPROVAL');
  const isAssignedReviewer = can.canReview && Boolean(userId && review?.approver.id === userId && review.status === 'PENDING');
  const isAssignedApprover = can.canApprove && Boolean(userId && approval?.approver.id === userId && approval.status === 'PENDING');
  const hasEffective = doc.versions.some((v) => v.status === 'EFFECTIVE');
  const actions: PanelAction[] = [];

  if (doc.status === 'DRAFT' && can.canEditDraft) actions.push('REPLACE_FILE');
  if (doc.status === 'DRAFT' && can.canSubmitForReview) actions.push('SUBMIT_REVIEW');
  if (doc.status === 'IN_REVIEW' && isAssignedReviewer) actions.push('SIGN_REVIEW', 'RETURN');
  if (doc.status === 'IN_REVIEW' && isAssignedApprover && review?.status === 'COMPLETED') actions.push('SIGN_APPROVE');
  if (doc.status === 'APPROVED' && can.canRelease) actions.push('SIGN_RELEASE');
  if (doc.status === 'EFFECTIVE' && can.canEditDraft) actions.push('START_REVISION');
  if (can.canEditDraft && ['DRAFT', 'IN_REVIEW', 'APPROVED'].includes(doc.status) && hasEffective) actions.push('WITHDRAW_REVISION');
  if (can.canObsolete && ['DRAFT', 'APPROVED', 'EFFECTIVE'].includes(doc.status)) actions.push('SIGN_RETIRE');
  return actions;
}

export const LIFECYCLE_PATH = ['DRAFT', 'IN_REVIEW', 'APPROVED', 'EFFECTIVE'] as const;

// Where the current revision stands on the path draft → effective; -1 when
// it has left the path (obsolete, withdrawn).
export function lifecyclePosition(status: string): number {
  return (LIFECYCLE_PATH as readonly string[]).indexOf(status);
}
