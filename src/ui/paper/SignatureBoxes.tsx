import type { CSSProperties } from 'react';
import styles from './paper.module.css';

export interface SignatureBox {
  role: string;
  // The assigned or signing person; empty when nobody is assigned yet.
  name: string;
  // 'signed', 'not signed yet', a date, or '—'.
  state: string;
}

// The signature boxes of a record, as on a paper routing slip. Read-only:
// it shows who signs in which role and whether they have; signing itself
// goes through SignatureDialog.
export function SignatureBoxes({ boxes }: { boxes: readonly SignatureBox[] }) {
  return (
    <div className={styles.sigRow} style={{ '--boxes': boxes.length } as CSSProperties}>
      {boxes.map((box) => (
        <div key={box.role} className={styles.sigBox}>
          <span className={styles.label}>{box.role}</span>
          <span className={styles.sigLine}>{box.name}</span>
          <span className={styles.sigState}>{box.state}</span>
        </div>
      ))}
    </div>
  );
}
