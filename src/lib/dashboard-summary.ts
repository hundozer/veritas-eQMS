import { documentActionsFor } from './document-actions';

// What the workspace overview shows a member: the signatures waiting on them,
// documents by lifecycle state, and the most recently changed documents. It
// only offers what the member's persisted permissions and assignments allow;
// the routes check the same rules again when they sign.

export type SignatureMeaning = 'REVIEW' | 'APPROVE' | 'RELEASE' | 'READ';

interface StepLike {
  stepType: string;
  status: string;
  approver: { id: string };
}

interface VersionLike {
  versionNumber: number;
  authoredById?: string | null;
  approvalRoutes?: Array<{ steps: StepLike[] }>;
}

export interface DashboardDocument {
  id: string;
  documentNumber?: string | null;
  title: string;
  status: string;
  currentVersionNumber: number;
  updatedAt: string;
  versions: VersionLike[];
}

export interface DashboardTraining {
  id: string;
  userId: string;
  status: string;
  assignedAt: string;
  documentVersion?: { versionNumber: number } | null;
  requirement: { document: { id: string; documentNumber?: string | null; title: string } };
}

export interface QueueItem {
  key: string;
  meaning: SignatureMeaning;
  documentId: string;
  documentNumber: string | null;
  title: string;
  versionNumber: number;
  since: string;
  trainingId?: string;
}

export const LIFECYCLE_STATES = ['DRAFT', 'IN_REVIEW', 'APPROVED', 'EFFECTIVE', 'OBSOLETE'] as const;

export function signatureQueue(
  userId: string | undefined,
  permissions: readonly string[] | undefined,
  documents: readonly DashboardDocument[],
  trainings: readonly DashboardTraining[],
): QueueItem[] {
  if (!userId) return [];
  const { canReview, canApprove, canRelease } = documentActionsFor(permissions);
  const items: QueueItem[] = [];

  for (const doc of documents) {
    const version = doc.versions.find((v) => v.versionNumber === doc.currentVersionNumber);
    const steps = version?.approvalRoutes?.[0]?.steps ?? [];
    const review = steps.find((step) => step.stepType === 'REVIEW');
    const approval = steps.find((step) => step.stepType === 'APPROVAL');
    const base = {
      documentId: doc.id,
      documentNumber: doc.documentNumber ?? null,
      title: doc.title,
      versionNumber: doc.currentVersionNumber,
      since: doc.updatedAt,
    };

    if (doc.status === 'IN_REVIEW' && canReview && review?.status === 'PENDING' && review.approver.id === userId) {
      items.push({ ...base, key: `review-${doc.id}`, meaning: 'REVIEW' });
    }
    if (doc.status === 'IN_REVIEW' && canApprove && review?.status === 'COMPLETED'
      && approval?.status === 'PENDING' && approval.approver.id === userId) {
      items.push({ ...base, key: `approve-${doc.id}`, meaning: 'APPROVE' });
    }
    // The author never releases their own revision (DEC-064).
    if (doc.status === 'APPROVED' && canRelease && version?.authoredById !== userId) {
      items.push({ ...base, key: `release-${doc.id}`, meaning: 'RELEASE' });
    }
  }

  const canSignTraining = (permissions ?? []).includes('training.complete_own');
  for (const assignment of trainings) {
    if (!canSignTraining || assignment.userId !== userId || assignment.status !== 'ASSIGNED' || !assignment.documentVersion) continue;
    const doc = assignment.requirement.document;
    items.push({
      key: `read-${assignment.id}`,
      meaning: 'READ',
      documentId: doc.id,
      documentNumber: doc.documentNumber ?? null,
      title: doc.title,
      versionNumber: assignment.documentVersion.versionNumber,
      since: assignment.assignedAt,
      trainingId: assignment.id,
    });
  }

  return items.sort((a, b) => a.since.localeCompare(b.since));
}

export function lifecycleCounts(documents: readonly Pick<DashboardDocument, 'status'>[]) {
  return LIFECYCLE_STATES.map((state) => ({
    state,
    count: documents.filter((doc) => doc.status === state).length,
  }));
}

export function recentlyChanged<T extends Pick<DashboardDocument, 'updatedAt'>>(documents: readonly T[], limit = 6): T[] {
  return [...documents].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, limit);
}
