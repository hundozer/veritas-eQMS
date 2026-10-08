import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getContext } from '@/lib/auth';

// Everything under (app) is rendered only for a valid session; the check runs
// on the server before any workspace code reaches the browser.
export default async function AppLayout({ children }: { children: ReactNode }) {
  if (!(await getContext())) redirect('/');
  return children;
}
