# Phase 6: Form Audit Data Routing Implementation Plan

## 1. Discovery
The current Form Audit modal is triggered via `BBF_AUDITOR.trigger()` in `auditor-engine.js`. When a tension area is selected, `BBF_AUDITOR.select()` fires and internally calls `BBF_SYNC.logAuditRequest(uid, currentExercise, areaLabel)`. 

This request routes to `bbf-sync.js` (line 280), which attempts a `POST` to the `bbf_logs` table, inserting an object with `type: 'audit'` and `notes: 'Audit: [Exercise] — Tension: [Area]'`. 

However, cross-referencing this against the canonical production schema (`api/supabase-schema-actual.sql`), we see that `bbf_logs` **does not possess** `type` or `notes` columns. Instead, it expects coach-oriented columns (`sport`, `position`, `drill_name`, `coach_notes`). Because of this schema mismatch, PostgREST silently drops these unknown fields or rejects the payload entirely. Big Jim's assessment is correct: this is a "Ghost UI" where the biomechanical data vanishes into a black hole.

## 2. Schema Decision
**Decision:** Create a new `bbf_audit_logs` table.

**Justification:** Extending `bbf_logs` is incorrect because the existing `bbf_logs` table is fundamentally misaligned with the current client architecture (it is coach/drill focused). Forcing granular kinematic data (`session_id`, `movement_name`, `tension_zone`) into a coach-notes table creates severe structural drift. A dedicated `bbf_audit_logs` table provides a clean, sovereign repository specifically for the Sentinel to query.

**Table Structure:**
- `id` (UUID, PK)
- `user_id` (UUID, FK to `bbf_users`)
- `session_id` (TEXT)
- `movement_name` (TEXT)
- `tension_zone` (TEXT)
- `created_at` (TIMESTAMPTZ)

## 3. DDL

```sql
CREATE TABLE IF NOT EXISTS public.bbf_audit_logs (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    user_id UUID REFERENCES public.bbf_users(id) ON DELETE CASCADE,
    session_id TEXT,
    movement_name TEXT NOT NULL,
    tension_zone TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bbf_audit_logs ENABLE ROW LEVEL SECURITY;

-- Match the webhook insert pattern seen in bbf_active_clients
CREATE POLICY "Allow anon inserts" ON public.bbf_audit_logs
    FOR INSERT TO anon WITH CHECK (true);

-- Allow service_role to manage and anon to read their own audits (if using anon keys)
CREATE POLICY "Allow anon select" ON public.bbf_audit_logs
    FOR SELECT TO anon USING (true);
```

## 4. JS Routing
We need to update `bbf-sync.js` to route these requests to `bbf_audit_logs` using explicit columns, bypassing the legacy `notes` string-concatenation.

```javascript
// Replace the existing logAuditRequest in bbf-sync.js
function logAuditRequest(uid, exerciseName, tensionArea, sessionId) {
  if (!uid || !exerciseName) return Promise.resolve();
  
  // Create a fallback session ID if none is provided
  var sid = sessionId || 'session_' + new Date().toISOString().slice(0, 10);

  return supa('POST', 'bbf_audit_logs', {
    user_id: uid,
    session_id: sid,
    movement_name: exerciseName,
    tension_zone: tensionArea,
    created_at: new Date().toISOString()
  });
}
```

Existing calls in `auditor-engine.js` (line 179) and `prehab-auditor.js` (line 97) will inherently utilize this updated function signature. They just need to optionally pass a `sessionId` if one is active in the global state, otherwise it will fallback to a daily session grouping.

## 5. Sentinel SELECT
To power the Sovereign Sentinel map, the Prehab & Recovery page needs to aggregate the tension zones to highlight damaged joints. 

**Query Logic (JS via supa wrapper):**
```javascript
function fetchSovereignSentinelData(uid) {
  // Fetch audits from the last 14 days to highlight recent cumulative damage
  var cutoffDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  var query = '?user_id=eq.' + uid + '&created_at=gte.' + cutoffDate + '&select=tension_zone,movement_name';
  
  return supa('GET', 'bbf_audit_logs', null, query).then(function(audits) {
    if (!audits) return {};
    
    // Aggregate by tension_zone (e.g. 'lower-back', 'knees')
    var heatMap = {};
    audits.forEach(function(audit) {
      var zone = audit.tension_zone;
      heatMap[zone] = (heatMap[zone] || 0) + 1;
    });
    
    return heatMap; // e.g., { 'Lower Back': 3, 'Knees': 1 }
  });
}
```

**Zone Mapping:**
The `tension_zone` stored in DB will map directly to `TENSION_AREAS` (e.g., 'Lower Back', 'Knees', 'Shoulders') defined in `auditor-engine.js`. The UI will apply a dynamic opacity/color overlay on the SVG based on the frequency count returned by the `heatMap`.

## 6. Files to Modify
- `api/PHASE_6_FORM_AUDIT_PLAN.md`: (Created this plan file)
- `bbf-sync.js` (Lines 280-290): **EDIT**. Replace `logAuditRequest` function to target `bbf_audit_logs` with the strict JSON structure. Add `fetchSovereignSentinelData`.
- `auditor-engine.js` (Line 179): **EDIT**. Update to pass a `sessionId` if one exists in scope.
- `prehab-auditor.js` (Line 97): **EDIT**. Similar update to pass `sessionId` if available.
- `bbf-app.html`: **NO CHANGE NEEDED**. The modal DOM and calls are dynamically injected by the engines.
- `supabase/migrations/<timestamp>_form_audit_routing.sql`: **NEW FILE** (to be created by Claude post-review containing the DDL).

## 7. Risks / Open Questions
- **Session IDs:** Currently, there is no canonical `session_id` passed around the Athlete Portal UI context. I proposed falling back to a daily timestamp (`'session_' + date`), but Akeem needs to confirm if a true `uuid` session hash is generated during the start of a workout that we should tap into.
- **RLS Reads:** I created an anon SELECT policy to ensure the client can query the Sentinel data. However, `bbf_logs` has no SELECT policies in production, meaning anon queries fail unless `SUPA_KEY` is a service_role key. Akeem, please verify if `bbf_audit_logs` should strictly be `service_role` or if anon reads with user_id matching are acceptable.

## 8. Out of Scope
- Creating the actual SQL migration file in `supabase/migrations/` (deferred to Claude).
- Wiring up the visual SVG manipulation in `bbf-app.html` for the Sentinel map (focusing strictly on the data routing).
- Modifying `api/supabase-schema-actual.sql` (left strictly to Claude's MCP introspection).
