// src/components/command/Comlink.jsx
// Phase 4 — Command Center surface: the Sovereign Comlink. Maps to the monolith's
// "Comlink view · Concierge + Incoming Leads" (comlink-engine.js) — concierge
// channel, lead intake, and the SOS intercept queue. Skeleton only; engine later.

import CommandSurface, { Placeholder } from './CommandSurface.jsx';

export default function Comlink() {
  return (
    <CommandSurface
      kicker="Sovereign Comlink · Concierge"
      title="Comlink"
      lede="The concierge channel and incoming leads, with the SOS intercept queue and voice → reply deployment."
    >
      <Placeholder note="Comlink engine — concierge, lead intake, and SOS queue — lands in a later phase." />
    </CommandSurface>
  );
}
