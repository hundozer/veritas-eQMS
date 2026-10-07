import styles from '../../page.module.css';
import SetupPasswordForm from './SetupPasswordForm';

export const metadata = { title: 'Set your password | Veritas' };

// Opened from the single-use invitation email (DEC-063).
export default async function SetupPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { token } = await searchParams;
  return (
    <main className={styles.container} style={{ alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div className={styles.modalContent} style={{ maxWidth: '440px', width: '100%' }}>
        <div className={styles.modalHeader}>
          <h1 style={{ fontSize: '18px', margin: 0 }}>Set your Veritas password</h1>
        </div>
        <div className={styles.modalBody}>
          <SetupPasswordForm token={typeof token === 'string' ? token : ''} />
        </div>
      </div>
    </main>
  );
}
