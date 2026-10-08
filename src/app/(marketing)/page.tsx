import Landing from './Landing';

// Static: the landing page is the same for everyone. A member who already has a
// session is sent on to /app by the page itself; /app checks the session on the
// server (src/app/(app)/layout.tsx).
export default function HomePage() {
  return <Landing />;
}
