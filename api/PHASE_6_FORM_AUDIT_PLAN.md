# Phase 6: Form Audit Data Routing Implementation Plan

## 1. Discovery
The Form Audit modal is triggered in `auditor-engine.js` (lines 87-111) via `triggerAuditorModal()`. Upon selecting an area, it displays a Founder-Verified cue, toggles a hologram, and calls `BBF_SYNC.logAuditRequest(uid, currentExercise, areaLabel)` (line 179). 

Big Jim's suspicion that this is a "Ghost UI" hitting a black hole is **100% correct**. 
In `bbf-sync.js` (lines 280-289), `logAuditRequest` executes a `POST` to `bbf_logs` with a payload of `{ type: 'audit', notes: 'Audit: ...' }`. However, cross-referencing `api/supabase-schema-actual.sql` reveals that the production `bbf_logs` table *does not have* `type` or `notes` columns (it is a legacy table with `sport`, `drill_name`, `coach_notes`, etc.). Because Supabase's PostgREST drops or rejects unknown columns, the data has been silently discarded.

Additionally, the read path in `bbf-sync.js` (`fetchPendingAudits`, lines 308-310) queries `bbf_logs?type=eq.audit`, effectively reading from the same nonexistent column and returning nothing.

## 2. Schema decision
**Decision:** Create a new table `bbf_audit_logs`.

**Justification:** Extending `bbf_logs` is not viable. `bbf_logs` is designed around daily session logs, whereas the form audit is a granular, point-in-time micro-event. Conflating these two concepts would bloat the session table with unrelated data. A dedicated table cleanly segregates the data pipeline and allows strict querying for the Prehab/Sentinel UI.

**Table Definition (`bbf_audit_logs`):**
- `id` (UUID, Primary Key)
- `user_id` (UUID, Foreign Key to `bbf_users.id`)
- `session_id` (UUID, nullable, generated locally by client per session)
- `movement_name` (TEXT)
- `tension_zone` (TEXT, constrained to specific system keys)
- `created_at` (TIMESTAMPTZ, indexed)

## 3. DDL
```sql
CREATE TABLE IF NOT EXISTS public.bbf_audit_logs (
  id            UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id       UUID REFERENCES public.bbf_users(id) ON DELETE CASCADE,
  session_id    UUID, -- Nullable, client-generated, no FK
  movement_name TEXT NOT NULL,
  tension_zone  TEXT NOT NULL CHECK (tension_zone IN ('lower-back','knees','shoulders','target-muscle','hips')),
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created ON public.bbf_audit_logs(user_id, created_at);

ALTER TABLE public.bbf_audit_logs ENABLE ROW LEVEL SECURITY;

-- ALLOW ANON INSERTS/SELECTS
-- NOTE: This matches the existing loose pattern in BBF (PIN auth model, no JWT).
CREATE POLICY "Allow Anon Inserts" 
  ON public.bbf_audit_logs 
  FOR INSERT 
  TO anon 
  WITH CHECK (true);

CREATE POLICY "Allow Anon Select" 
  ON public.bbf_audit_logs 
  FOR SELECT 
  TO anon 
  USING (true);
```

## 4. JS routing
We will add a session UUID generator to `bbf-sync.js`, update `logAuditRequest` to target the new table with granular columns (including `session_id`), and update both `auditor-engine.js` and `prehab-auditor.js` to pass `areaId` (the system ID) instead of the localized `areaLabel`. Furthermore, we'll fix the read path (`fetchPendingAudits`) to query the new table.

```javascript
  // bbf-sync.js — Session ID Utility
  function getOrCreateSessionId() {
    var id = sessionStorage.getItem('bbf_workout_session_id');
    if (!id) {
      id = (typeof crypto !== 'undefined' && crypto.randomUUID) 
        ? crypto.randomUUID() 
        : ('sess-' + Date.now() + '-' + Math.random().toString(36).slice(2));
      sessionStorage.setItem('bbf_workout_session_id', id);
    }
    return id;
  }

  // bbf-sync.js — Replacement for logAuditRequest
  function logAuditRequest(uid, exerciseName, tensionZoneId) {
    if (!uid || !exerciseName || !tensionZoneId) return Promise.resolve();
    
    return supa('POST', 'bbf_audit_logs', {
      user_id: uid,
      session_id: getOrCreateSessionId(),
      movement_name: exerciseName,
      tension_zone: tensionZoneId
    });
  }

  // bbf-sync.js — Redirect fetchPendingAudits
  function fetchPendingAudits() {
    return supa('GET', 'bbf_audit_logs', null, '?order=created_at.desc&limit=100').then(function(data) {
      if (!data) return [];
      return data.map(function(entry) {
        return {
          user_id: entry.user_id,
          user_name: entry.user_id, // We'll map UID here as it was previously
          notes: 'Audit: ' + entry.movement_name + ' — Tension: ' + entry.tension_zone,
          date: entry.created_at.slice(0, 10),
          logged_at: entry.created_at
        };
      });
    }).catch(function(e) { console.error('BBF_SYNC fetchPendingAudits error:', e); return []; });
  }
```

**Code Path Swaps:**
In `auditor-engine.js` (line ~179) and `prehab-auditor.js` (line ~97), swap `areaLabel` for `areaId`:
```javascript
// Replace: BBF_SYNC.logAuditRequest(uid, currentExercise, areaLabel)
// With: BBF_SYNC.logAuditRequest(uid, currentExercise, areaId)
```

## 5. Sentinel SELECT
The Sentinel map needs to flag damaged zones. We will query recent audit logs, discard the 'target-muscle' entries, and map the remaining tension zones to the exact SVG DOM IDs used in `bbf-app.html`.

```javascript
  // bbf-sync.js — New read query for the Sentinel
  function fetchDamagedZones(userId) {
    var thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    
    return supa('GET', 'bbf_audit_logs', null, 
      '?user_id=eq.' + encodeURIComponent(userId) + 
      '&created_at=gte.' + thirtyDaysAgo +
      '&order=created_at.desc'
    ).then(function(logs) {
      if (!logs) return [];
      
      // Map tension_zone strings to actual SVG element IDs from bbf-app.html
      var zoneMap = {
        'lower-back': ['ss-z-lumbar'],
        'knees':      ['ss-z-knee-l', 'ss-z-knee-r'],
        'shoulders':  ['ss-z-shoulders-l', 'ss-z-shoulders-r', 'ss-z-cervical'],
        'hips':       ['ss-z-hip-l', 'ss-z-hip-r']
      };
      
      var damagedZones = {};
      
      logs.forEach(function(log) {
        if (log.tension_zone === 'target-muscle') return; // Healthy state
        
        var svgIds = zoneMap[log.tension_zone] || [];
        svgIds.forEach(function(svgId) {
          if (!damagedZones[svgId]) {
            damagedZones[svgId] = { count: 0, movements: [] };
          }
          damagedZones[svgId].count++;
          
          if (damagedZones[svgId].movements.indexOf(log.movement_name) === -1) {
            damagedZones[svgId].movements.push(log.movement_name);
          }
        });
      });
      
      return damagedZones;
    });
  }
```

## 6. Files to modify
- **`bbf-sync.js`**
  - **Edit** (lines 280-290): Overhaul `logAuditRequest` to target `bbf_audit_logs`.
  - **Edit**: Add `getOrCreateSessionId` utility.
  - **Edit** (lines 308-310): Redirect `fetchPendingAudits` to target `bbf_audit_logs`.
  - **Edit**: Add `fetchDamagedZones` logic block.
- **`auditor-engine.js`**
  - **Edit** (line ~179): Change the `BBF_SYNC.logAuditRequest` payload from `areaLabel` to `areaId`.
- **`prehab-auditor.js`**
  - **Edit** (line ~97): Change the `BBF_SYNC.logAuditRequest` payload from `areaLabel` (or similar) to `areaId`.
- **`bbf-app.html`**
  - **Edit**: Bump the `BBF_CACHE` constant for Service Worker.
- **`api/supabase-schema-actual.sql`**
  - **No change needed** (regenerated autonomously by Claude).
- **`supabase/migrations/<timestamp>_form_audit_routing.sql`** (to be created by Claude)
  - **New**: Will contain the DDL, check constraints, and RLS statements block.

## 7. Risks / open questions
- **User ID typing**: `auditor-engine.js` resolves `uid` using `CU || VC`. If `CU` is currently set to the string representation (e.g. `'akeem'`) instead of the true UUID (`id`), the insert to `bbf_audit_logs.user_id` (UUID format) will fail. We need to ensure the runtime state uses the UUID for `CU`.
- **RLS limitation**: As noted in the directive, `WITH CHECK (true)` and `USING (true)` for the `anon` role is a known security limitation in the current platform state. It aligns with the existing architecture (a PIN-based pseudo-auth layer over anon connections) and will be tightened in a separate workstream once true JWT auth is enabled.

## 8. Out of scope
- Implementing or modifying the visual "Prehab & Recovery" Sentinel UI itself. We are only building the data routing and the query.
- Migrating historical audit logs. Since the production schema dropped them into a black hole, there is no legacy data to salvage/migrate.
- Changing any Phase 2 auth flow mechanisms or touching `bbf_pin_attempts`.
