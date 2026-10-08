// Browser-side check whether the visitor already has a valid session, used by
// the static landing page to send members on to the workspace.
export async function hasActiveSession(fetchFn: typeof fetch = (...args) => fetch(...args)): Promise<boolean> {
  try {
    const response = await fetchFn('/api/auth/session', { cache: 'no-store' });
    if (!response.ok) return false;
    const body = await response.json() as { user?: unknown };
    return Boolean(body.user);
  } catch {
    return false;
  }
}
