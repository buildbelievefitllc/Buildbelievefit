// src/components/command/ClientHub.jsx
// Phase 4 — Command Center surface: the athlete Roster. Maps to the monolith's
// "Roster · Secure Service-Role" pane (Phase 5.2 relocated it into Command Center).
// Skeleton only; the secure service-role fetch + auto-sort-by-risk wiring is later.

import CommandSurface, { Placeholder } from './CommandSurface.jsx';

export default function ClientHub() {
  return (
    <CommandSurface
      kicker="Roster · Secure Service-Role"
      title="Client Hub"
      lede="The athlete roster — auto-sorted by risk telemetry. Open a client to reach their file, active program, and intercept history."
    >
      <Placeholder note="Live roster wiring (secure service-role fetch, risk-sorted) lands in a later phase." />
    </CommandSurface>
  );
}
