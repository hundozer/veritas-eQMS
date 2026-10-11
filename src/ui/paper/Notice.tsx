import type { ReactNode } from 'react';
import styles from './paper.module.css';

export type NoticeTone = 'info' | 'success' | 'error';

// A message about the page or the last action. Errors are announced at once
// (role="alert"); success and information politely (role="status").
export function Notice({ tone = 'info', children }: { tone?: NoticeTone; children: ReactNode }) {
  const toneClass = tone === 'error' ? styles.noticeError : tone === 'success' ? styles.noticeSuccess : '';
  return (
    <div className={`${styles.notice} ${toneClass}`} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

// A refusal inside a form, next to the fields it is about.
export function FormError({ children }: { children: ReactNode }) {
  return <p className={styles.error} role="alert">{children}</p>;
}
