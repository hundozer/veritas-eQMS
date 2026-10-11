import type { ReactNode } from 'react';
import styles from './paper.module.css';
import { Stamp } from './Stamp';

export interface RecordCell {
  label: string;
  value: ReactNode;
  // Identifiers, revisions, dates and hashes are set in the mono face.
  mono?: boolean;
  span?: number;
}

function Cell({ cell }: { cell: RecordCell }) {
  return (
    <td colSpan={cell.span}>
      <span className={styles.label}>{cell.label}</span>
      {cell.mono ? <span className={styles.mono}>{cell.value}</span> : cell.value}
    </td>
  );
}

// The controlled-form header of a quality record: identity cells (number,
// revision, type…) above the title and its state stamp, detail rows below.
// Every row should span the same number of columns as `identity`.
export function RecordHeader({ titleId, title, state, identity, details = [] }: {
  titleId: string;
  title: string;
  state?: string;
  identity: RecordCell[];
  details?: RecordCell[][];
}) {
  const columns = identity.reduce((sum, cell) => sum + (cell.span ?? 1), 0);
  return (
    <table className={styles.formHeader}>
      <tbody>
        <tr>{identity.map((cell) => <Cell key={cell.label} cell={cell} />)}</tr>
        <tr>
          <td colSpan={columns} className={styles.titleCell}>
            <h3 id={titleId} className={styles.title}>{title}</h3>
            {state && <Stamp state={state} className={styles.recordStamp} />}
          </td>
        </tr>
        {details.map((row, index) => (
          <tr key={index}>{row.map((cell) => <Cell key={cell.label} cell={cell} />)}</tr>
        ))}
      </tbody>
    </table>
  );
}

// The bordered sheet a record detail sits on.
export function RecordSheet({ children, labelledBy, sheetRef, className }: { children: ReactNode; labelledBy: string; sheetRef?: React.Ref<HTMLElement>; className?: string }) {
  return <article ref={sheetRef} className={`${styles.sheet}${className ? ` ${className}` : ''}`} aria-labelledby={labelledBy}>{children}</article>;
}
