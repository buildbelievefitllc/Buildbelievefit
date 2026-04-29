# PHASE TWO DESIGN PROPOSAL

## 1. Pre-Work Findings

**A. Schema Analysis (`api/supabase-schema.sql`)**
- **Admin/Founder PIN Storage**: The admin PIN is stored in the `bbf_users` table where `id = 'akeem'`. The column used is `pin_hash TEXT`. The existing seeded hash (`1de5495...`) is a raw hex-encoded SHA256 hash of the plaintext PIN (`api/supabase-schema.sql:143`).
- **User PIN Storage**: Users also store their credentials in the `bbf_users` table under the `pin_hash TEXT` column (`api/supabase-schema.sql:19`), leveraging the same hex-encoded SHA256 pattern (`api/supabase-schema.sql:148-152`).
- **pgcrypto Extension**: The script utilizes `digest(..., 'sha256')` within its RPCs (`api/supabase-schema.sql:207`), which requires the `pgcrypto` extension. However, the explicit `CREATE EXTENSION IF NOT EXISTS pgcrypto;` command is missing from the file and should be formally added to ensure deterministic environment parity.
- **RPC Logic**: The `bbf_verify_admin_pin` (`api/supabase-schema.sql:187`) and `bbf_verify_user_pin` (`api/supabase-schema.sql:214`) functions operate identically regarding hashing: they receive `pin_attempt` in plaintext, run `encode(digest(pin_attempt, 'sha256'), 'hex')` on the server, and compare it strictly against `actual_hash`.

**B. Migration Runner Pattern**
- **Existing Pattern**: `git log --all --diff-filter=A -- 'api/migrations/*'` confirmed that no `api/migrations/` directory exists in the project history.
- **Current Approach**: Schema updates historically land at the bottom of `api/supabase-schema.sql` via idempotent commands (e.g., `ALTER TABLE bbf_users ADD COLUMN IF NOT EXISTS ...` at `api/supabase-schema.sql:31`).
- **Proposed Approach**: For this phase, we will append the new `bbf_pin_attempts` table and the RPC replacement logic to `api/supabase-schema.sql`.

**C. RPC Payload Verification**
- **User Payload**: The SQL signature at `api/supabase-schema.sql:214` explicitly accepts the User ID: `CREATE OR REPLACE FUNCTION bbf_verify_user_pin(uid TEXT, pin_attempt TEXT)`. This perfectly maps to the client `bbf-app.html:4236` which sends `{ uid: user, pin_attempt: pin }`.

---

## 2. Lockout State Schema

We will append a new table to `api/supabase-schema.sql` to manage server-authoritative lockouts.

**Table Name**: `bbf_pin_attempts`

**Key Strategy**:
- **Admin PIN (`admin.html`, `coach-lab.html`)**: Because there is no `uid` payload for the admin gate, the primary key must be the requester's IP address. This is extracted dynamically within the RPC using `current_setting('request.headers', true)::json->>'x-forwarded-for'`.
- **User PIN (`bbf-app.html`)**: The `uid` is passed in the payload. We will key on the `uid`. Keying on `uid` across all IPs prevents distributed botnets from brute-forcing a 4-digit PIN (a critical vulnerability, given a 10,000-permutation space). While this enables a malicious actor to lock out a legitimate user, protecting the account integrity takes priority over localized availability.

**Columns**:
- `key` (TEXT PRIMARY KEY) — The IP address (Admin) or `uid` (User).
- `failed_count` (INTEGER DEFAULT 0) — Number of failed attempts within the current window.
- `window_started_at` (TIMESTAMPTZ DEFAULT NOW()) — Used to reset the window if the attempts occurred far in the past.
- `locked_until` (TIMESTAMPTZ) — Authoritative timestamp when the lockout expires.
- `last_attempt_at` (TIMESTAMPTZ DEFAULT NOW()) — Tracks latest interaction for garbage collection.

**Indexes & TTL / RLS**:
- **Index**: `CREATE INDEX idx_pin_attempts_locked ON bbf_pin_attempts (locked_until);`
- **TTL**: We can implement lazy cleanup — on successful login, `DELETE FROM bbf_pin_attempts WHERE key = v_key`. No active cron job is strictly required.
- **RLS**: Row-Level Security will be enabled with a `DENY ALL` policy. The `SECURITY DEFINER` RPCs will bypass RLS natively, guaranteeing that no client can read or modify lockout state.

---

## 3. RPC Logic Rewrite

To support client UI countdowns, we must change the `bbf_verify_*` return type from `BOOLEAN` to `JSON`.

**Return Contract**:
`{ "ok": boolean, "lockout_active": boolean, "retry_after_seconds": integer }`

**Pseudocode for `bbf_verify_user_pin` (Admin is identical but keys on IP)**:
```sql
CREATE OR REPLACE FUNCTION bbf_verify_user_pin(uid TEXT, pin_attempt TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_key TEXT := uid; -- For Admin: current_setting('request.headers', true)::json->>'x-forwarded-for'
  v_attempt bbf_pin_attempts%ROWTYPE;
  v_stored_hash TEXT;
  v_is_valid BOOLEAN := FALSE;
BEGIN
  -- 1. Lockout Check
  SELECT * INTO v_attempt FROM bbf_pin_attempts WHERE key = v_key;
  IF v_attempt.locked_until > now() THEN
    RETURN json_build_object('ok', false, 'lockout_active', true, 'retry_after_seconds', extract(epoch from (v_attempt.locked_until - now()))::int);
  END IF;

  -- 2. Hash Validation (Lazy Migration Aware)
  SELECT pin_hash INTO v_stored_hash FROM bbf_users WHERE id = uid LIMIT 1;
  IF v_stored_hash IS NOT NULL THEN
    IF v_stored_hash LIKE '$2a$%' THEN
      -- New bcrypt format
      v_is_valid := (crypt(pin_attempt, v_stored_hash) = v_stored_hash);
    ELSE
      -- Old SHA256 format
      v_is_valid := (v_stored_hash = encode(digest(pin_attempt, 'sha256'), 'hex'));
      -- LAZY MIGRATION: Update hash to bcrypt on successful legacy login
      IF v_is_valid THEN
        UPDATE bbf_users SET pin_hash = crypt(pin_attempt, gen_salt('bf')) WHERE id = uid;
      END IF;
    END IF;
  END IF;

  -- 3. Handle Result
  IF v_is_valid THEN
    DELETE FROM bbf_pin_attempts WHERE key = v_key;
    RETURN json_build_object('ok', true, 'lockout_active', false, 'retry_after_seconds', 0);
  ELSE
    -- Increment failure logic & compute new locked_until
    INSERT INTO bbf_pin_attempts (key, failed_count, window_started_at, locked_until)
    VALUES (v_key, 1, now(), NULL)
    ON CONFLICT (key) DO UPDATE SET 
      failed_count = bbf_pin_attempts.failed_count + 1,
      locked_until = CASE WHEN bbf_pin_attempts.failed_count + 1 >= 3 THEN now() + interval '15 minutes' ELSE NULL END,
      last_attempt_at = now();
      
    SELECT * INTO v_attempt FROM bbf_pin_attempts WHERE key = v_key;
    RETURN json_build_object('ok', false, 'lockout_active', (v_attempt.failed_count >= 3), 'retry_after_seconds', CASE WHEN v_attempt.failed_count >= 3 THEN 900 ELSE 0 END);
  END IF;
END;
$$;
```

---

## 4. Existing-PIN Migration Strategy

**Recommendation: Lazy Migration.**

Because the stored PINs are raw SHA256 hashes (`encode(digest(pin_attempt, 'sha256'), 'hex')`), we **cannot** simply `UPDATE` the column utilizing `crypt(current_value, ...)` because hash functions are one-way. The plaintext PIN is lost to the database.

By implementing **Lazy Migration** (as demonstrated in the pseudocode above):
1. The RPC detects if the hash lacks the `$2a$` bcrypt identifier.
2. If it's an old SHA256 hash, it verifies the attempt using the old logic.
3. Upon **success**, the plaintext `pin_attempt` is natively accessible in memory. The RPC seamlessly replaces the legacy hash in `bbf_users` with `crypt(pin_attempt, gen_salt('bf'))`.

**Impact:**
- Zero downtime.
- No users are forcibly logged out or required to reset their PIN.
- Dormant accounts remain safely encrypted under SHA256 until their next login.

---

## 5. Client UI Changes

Changing the RPC return type from `BOOLEAN` to `JSON` will require updating the client JS to unpack `res.ok`.

**Admin Surfaces (`admin.html` and `coach-lab.html`)**:
- **Response Parsing**: Update `authAdmin()` to expect `var data = await res.json()`.
- **Disabling Inputs**: If `data.lockout_active` is true, apply `document.getElementById('gate-pin').disabled = true`.
- **Countdown Renderer**: Inject the timer string directly into `document.getElementById('gate-err').textContent`. Use `setInterval` locally to decrement the remaining seconds.
- **Recovery**: Once the interval hits 0, `clearInterval`, remove the `disabled` property, and reset `gate-err` to empty.

**User Surface (`bbf-app.html`)**:
- **Response Parsing**: Update `LOGIN()` to expect `var data = await res.json()`.
- **Disabling Inputs**: Locate `#p` (PIN input), `#u` / `#un` (Username input), and the login button. Apply `.disabled = true` to all when locked out.
- **Countdown Renderer**: Update the existing `msg` handler (`#lmsg`) to show: `"Too many attempts. Locked for Xm Ys"`. Apply the `#ef4444` red color override.

**Local State**: No local storage will be required. The countdown visually runs in DOM memory via `setInterval`. If the user refreshes, they lose the visual countdown, but the server fundamentally rejects the next network request via `locked_until > now()` and returns the exact `retry_after_seconds` to re-synchronize the client.

---

## 6. Test Plan

We will expand the existing `*.test.js` pattern (e.g., `are-engine.test.js`) to cover authentication lockouts.

**Unit Tests**:
1. **Successful Lazy Migration**: Mock legacy SHA256 response vs. Bcrypt response to ensure client UI proceeds cleanly.
2. **Lockout UI State Machine**: Test that the `disabled` attributes are correctly applied to the PIN and Username inputs when mocked RPCs return `{lockout_active: true}`.
3. **Timer Recovery**: Verify that after the mock `setInterval` elapses, the `disabled` attributes are cleanly scrubbed from the DOM elements.

**System/Attack Scenarios (SQL Level)**:
1. **Rapid Retries**: Ensure 3 failed attempts strictly trigger a 900-second lockout.
2. **Boundary Expiry**: Ensure that attempting login exactly 901 seconds after lockout results in a clean reset of `failed_count`.
3. **Cross-IP Saturation (User)**: Ensure that brute-forcing the same `uid` from 5 distinct IPs correctly tracks the global `failed_count` for that user.

---

## 7. Open Questions for Ratification

1. **NAT Office Blocking (Admin)**: For the Admin PIN, keying by IP means a single typo-prone trainer could lock out the entire office (if sharing a network). Are we comfortable with this, or should we append a browser fingerprint / user-agent to the lockout key?
2. **Ghost Protocol Integration**: Should a user PIN lockout natively trigger a `ghost_flagged_at` / `ghost_intervention_needed` state in `bbf_users` to alert the coaching staff of a potential attack?
3. **pgcrypto Provisioning**: I noted that `CREATE EXTENSION IF NOT EXISTS pgcrypto;` is missing from `supabase-schema.sql`. Shall I prepend this to the next deployment payload to ensure strict parity?
