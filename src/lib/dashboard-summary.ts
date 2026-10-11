import { documentActionsFor } from './document-actions';

// What the workspace overview shows a member: the signatures waiting on them,
// documents by lifecycle state, and the most recently changed documents. It
// only offers what the member's persisted permissions and assignments allow;
// the routes check the same rules again when they sign.

export type SignatureMeaning = 'REVIEW' | 'APPROVE' | 'RELEASE' | 'READ';

interface StepLike {
  stepType: string;
  status: string;
  approver: { id: string; fullName?: string };
}

interface VersionLike {
  versionNumber: number;
  authoredById?: string | null;
  createdBy?: string;
  createdAt?: string;
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

const SUMMARY_NOUN: Record<SignatureMeaning, [string, string]> = {
  REVIEW: ['review', 'reviews'],
  APPROVE: ['approval', 'approvals'],
  RELEASE: ['release', 'releases'],
  READ: ['training to sign', 'trainings to sign'],
};

// One sentence for the overview: "2 reviews, 1 approval and 1 release."
export function queueSummary(queue: readonly Pick<QueueItem, 'meaning'>[]): string {
  const parts = (['REVIEW', 'APPROVE', 'RELEASE', 'READ'] as const).flatMap((meaning) => {
    const count = queue.filter((item) => item.meaning === meaning).length;
    if (count === 0) return [];
    const [one, many] = SUMMARY_NOUN[meaning];
    return [`${count} ${count === 1 ? one : many}`];
  });
  if (parts.length === 0) return '';
  const last = parts.pop();
  return `${parts.length ? `${parts.join(', ')} and ` : ''}${last}.`;
}

// One box of a routing slip: who signs at that step and where it stands.
// Dates are only shown where the documents and trainings lists return them.
export interface SlipBox {
  role: string;
  name: string | null;
  state: 'signed' | 'yours' | 'waiting' | 'open';
  date?: string;
}

// The signature boxes of the routing slip for one queue item, from the
// records the overview already holds. Nothing is invented: a step with no
// assignee is "open", a step another person must sign is "waiting".
export function routingSlip(
  item: QueueItem,
  documents: readonly DashboardDocument[],
  trainings: readonly DashboardTraining[],
): SlipBox[] {
  if (item.meaning === 'READ') {
    const assignment = trainings.find((t) => t.id === item.trainingId);
    return [
      { role: 'Assigned', name: null, state: 'signed', date: assignment?.assignedAt },
      { role: 'Read and understood', name: null, state: 'yours' },
    ];
  }

  const doc = documents.find((d) => d.id === item.documentId);
  const version = doc?.versions.find((v) => v.versionNumber === doc.currentVersionNumber);
  const steps = version?.approvalRoutes?.[0]?.steps ?? [];
  const box = (role: string, meaning: SignatureMeaning, stepType: string): SlipBox => {
    if (item.meaning === meaning) return { role, name: null, state: 'yours' };
    const step = steps.find((s) => s.stepType === stepType);
    if (!step) return { role, name: null, state: 'open' };
    return { role, name: step.approver.fullName ?? null, state: step.status === 'COMPLETED' ? 'signed' : 'waiting' };
  };

  return [
    { role: 'Author', name: version?.createdBy ?? null, state: 'signed', date: version?.createdAt },
    box('Review', 'REVIEW', 'REVIEW'),
    box('Approve', 'APPROVE', 'APPROVAL'),
    item.meaning === 'RELEASE' ? { role: 'Release', name: null, state: 'yours' } : { role: 'Release', name: null, state: 'open' },
  ];
}
