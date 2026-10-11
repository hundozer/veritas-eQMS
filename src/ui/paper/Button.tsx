import type { ButtonHTMLAttributes } from 'react';
import styles from './paper.module.css';

export type ButtonVariant = 'primary' | 'outline' | 'quiet';

// Primary moves a record forward (submit, sign); outline is any other action;
// quiet takes something out of use (withdraw, retire) and sits apart.
// One primary button per action area. Defaults to type="button".
export function Button({ variant = 'outline', className, type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button type={type} className={`${styles[variant]}${className ? ` ${className}` : ''}`} {...props} />;
}

export function ButtonRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`${styles.buttonRow}${className ? ` ${className}` : ''}`}>{children}</div>;
}
