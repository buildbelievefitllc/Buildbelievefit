// src/components/sportshub/YouthIntakeGate.jsx
// ─────────────────────────────────────────────────────────────────────────────
// THE SPORTS HUB — first-run interception point.
//
// Gates the Sports Hub: a flagged youth athlete cannot SEE the Hub until the DB
// confirms a completed PAR-Q+ intake. Three states:
//   loading    → resolving clearance (no Hub flash, no premature intake)
//   incomplete → render the forced <YouthIntake> gate IN PLACE of the Hub
//   complete   → render the Hub for the athlete's chosen sport/position
//
// The chosen sport/position (just-submitted via markComplete, or persisted via the
// status RPC) is passed to the Hub and used as its render key, so a sport change
// cleanly re-seeds the Hub's editable model. Admins are skipped (ungated preview).
// FAIL-CLOSED lives in useYouthIntakeStatus — an unresolved status reads as
// 'incomplete', so a minor is never waved through on a network blip.

import { useAuth } from '../../context/AuthContext.jsx';
import { useYouthIntakeStatus } from '../../lib/youthIntakeApi.js';
import YouthIntake from './YouthIntake.jsx';
import SportsHub from '../../pages/SportsHub.jsx';
import './sportsHub.css';

export default function YouthIntakeGate() {
  const { user, isAdmin } = useAuth();
  const uid = user?.username || user?.id || '';
  const { status, selection, markComplete } = useYouthIntakeStatus(uid, { skip: isAdmin });

  if (status === 'loading') {
    return (
      <div className="sh-screen">
        <div className="sh-gate-boot">Verifying athlete clearance…</div>
      </div>
    );
  }
  if (status === 'incomplete') {
    return <YouthIntake uid={uid} onComplete={markComplete} />;
  }
  const selKey = selection ? `${selection.sportId}:${selection.positionCode}` : 'seed';
  return <SportsHub key={selKey} selection={selection} />;
}
