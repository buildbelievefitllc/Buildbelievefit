// src/pages/Dashboard.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Placeholder top-level view. Phase 1 scaffolding only — exists to prove the
// /pages layer + routing render. Real views (Command Center, Client Hub, etc.)
// are ported in later phases. Brand tokens applied per CLAUDE.md §2.

import PlaceholderCard from '../components/PlaceholderCard.jsx';

export default function Dashboard() {
  return (
    <section style={{ padding: '1.5rem' }}>
      <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '1px', color: '#6a0dad' }}>
        Build Believe Fit — React Foundation
      </h1>
      <p style={{ color: '#666', maxWidth: 560 }}>
        Phase 1 scaffolding is live. This shell will receive the migrated Sovereign
        surfaces in subsequent phases. No monolith markup has been ported yet.
      </p>
      <PlaceholderCard title="Command Center" note="Migration target — Phase 2+" />
    </section>
  );
}
