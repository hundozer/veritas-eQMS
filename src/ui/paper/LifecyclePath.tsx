import type { CSSProperties } from 'react';
import styles from './paper.module.css';

// Where a record stands on its lifecycle: done steps ticked, the current step
// highlighted and marked aria-current="step". `current` is the index of the
// current step; -1 when the record has left the path (show a note instead).
// When `attached` is true the path sits directly on top of SignatureBoxes.
export function LifecyclePath({ steps, current, attached = false, label = 'Lifecycle' }: {
  steps: readonly string[];
  current: number;
  attached?: boolean;
  label?: string;
}) {
  return (
    <ol
      aria-label={label}
      className={`${styles.path}${attached ? '' : ` ${styles.pathOnly}`}`}
      style={{ '--steps': steps.length } as CSSProperties}
    >
      {steps.map((step, index) => (
        <li
          key={step}
          className={`${styles.pathStep} ${index < current ? styles.pathDone : ''} ${index === current ? styles.pathNow : ''}`}
          aria-current={index === current ? 'step' : undefined}
        >
          <span className={styles.pathMark} aria-hidden="true">{index < current ? '✓' : index + 1}</span>
          {index < current && <span className={styles.visuallyHidden}>Done: </span>}
          {step}
        </li>
      ))}
    </ol>
  );
}
