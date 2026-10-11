import { notFound } from 'next/navigation';
import Showcase from './Showcase';

export const metadata = { title: 'Veritas design system (development only)' };

// The component showcase (VER-DS-01): the real shared components with
// synthetic data, for developers only. Production builds answer 404, so no
// deployed environment shows it.
export default function DesignSystemPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <Showcase />;
}
