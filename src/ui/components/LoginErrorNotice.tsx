// Shown inside the sign-in dialogs: the page-level error banner sits behind
// the dialog overlay, so a refused sign-in would otherwise look like nothing happened.
export function LoginErrorNotice({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      style={{ border: '1px solid #DC2626', background: '#FEF2F2', color: '#991B1B', padding: '12px 14px', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}
    >
      {message}
    </div>
  );
}
