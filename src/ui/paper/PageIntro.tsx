import type { ReactNode } from 'react';
import styles from './paper.module.css';

// The top of every workspace page: serif headline (the page's h2; the shell
// header holds the section name), one line of context, and the page's
// actions on the right.
export function PageIntro({ title, lede, actions }: { title: string; lede?: ReactNode; actions?: ReactNode }) {
  return (
    <header className={styles.intro}>
      <div>
        <h2 className={styles.headline}>{title}</h2>
        {lede && <p className={styles.lede}>{lede}</p>}
      </div>
      {actions && <div className={styles.introActions}>{actions}</div>}
    </header>
  );
}

export function SectionTitle({ id, children }: { id?: string; children: ReactNode }) {
  return <h4 id={id} className={styles.sectionTitle}>{children}</h4>;
}

export function Note({ children }: { children: ReactNode }) {
  return <p className={styles.note}>{children}</p>;
}

// What is missing and what to do about it; never just "No data".
export function EmptyState({ children }: { children: ReactNode }) {
  return <div className={styles.empty}>{children}</div>;
}
