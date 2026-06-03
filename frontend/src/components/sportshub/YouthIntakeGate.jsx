// src/components/sportshub/YouthIntakeGate.jsx
// ─────────────────────────────────────────────────────────────────────────────
// THE SPORTS HUB — first-run interception point.
//
// Wraps the Sports Hub: a flagged youth athlete cannot SEE the Hub until the DB
// confirms a completed PAR-Q+ intake. Three states:
//   loading    → resolving clearance (no Hub flash, no premature intake)
//   incomplete → render the forced <YouthIntake> gate IN PLACE of the Hub
//   complete   → release the children (the Hub)
//
// Admins are skipped (they preview the Hub ungated). FAIL-CLOSED lives in
// useYouthIntakeStatus: an unresolved/errored status reads as 'incomplete', so a
// minor is never waved through on a network blip.

import { useAuth } from '../../context/AuthContext.jsx';
import { useYouthIntakeStatus } from '../../lib/youthIntakeApi.js';
import YouthIntake from './YouthIntake.jsx';
import './sportsHub.css';

export default function YouthIntakeGate({ children }) {
  const { user, isAdmin } = useAuth();
  const uid = user?.username || user?.id || '';
  const { status, markComplete } = useYouthIntakeStatus(uid, { skip: isAdmin });

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
  return children;
}
