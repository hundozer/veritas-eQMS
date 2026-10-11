import type { ReactNode } from 'react';
import styles from './paper.module.css';

// A ruled register table that scrolls sideways inside its own box on narrow
// screens. Give it <thead> with <th scope="col"> and a <tbody>. A module
// sets the table's min-width and hides secondary columns on phones through
// `className` in its own CSS.
export function Ledger({ children, caption, className }: {
  children: ReactNode;
  caption?: ReactNode;
  className?: string;
}) {
  return (
    <div className={styles.tableScroll}>
      <table className={`${styles.ledger}${className ? ` ${className}` : ''}`}>
        {caption && <caption className={styles.visuallyHidden}>{caption}</caption>}
        {children}
      </table>
    </div>
  );
}

// Identifiers, revision numbers, dates and hashes.
export function Mono({ children, title }: { children: ReactNode; title?: string }) {
  return <span className={styles.mono} title={title}>{children}</span>;
}
