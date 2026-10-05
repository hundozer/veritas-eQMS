import Link from 'next/link';

export default function AdminPage() {
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '24px' }}>
      <section style={{ maxWidth: '640px', padding: '32px', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '16px' }}>
        <p style={{ margin: 0, color: 'var(--warning)', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' }}>
          Controlled recovery
        </p>
        <h1 style={{ margin: '12px 0' }}>Platform administration unavailable</h1>
        <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          Tenant provisioning, platform-user administration, regulatory imports, and release publishing are disabled until a separate platform identity, authorization policy, audit model, and validation package are approved.
        </p>
        <Link href="/" style={{ display: 'inline-block', marginTop: '24px', color: 'var(--primary)' }}>
          Return to Veritas
        </Link>
      </section>
    </main>
  );
}
