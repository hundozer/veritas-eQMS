import styles from './stamp.module.css';

const STATE_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  IN_REVIEW: 'In review',
  APPROVED: 'Approved',
  EFFECTIVE: 'Effective',
  SUPERSEDED: 'Superseded',
  OBSOLETE: 'Obsolete',
  WITHDRAWN: 'Withdrawn',
};

export function stateLabel(state: string): string {
  return STATE_LABEL[state] ?? state.replaceAll('_', ' ');
}

// A document or version state shown as an outlined stamp, as on paper.
// Lime marks what is in force; drafts are dashed; retired states are struck.
export default function Stamp({ state, className }: { state: string; className?: string }) {
  return (
    <span className={`${styles.stamp} ${styles[`stamp${state}`] ?? ''} ${className ?? ''}`}>
      {stateLabel(state).toUpperCase()}
    </span>
  );
}
