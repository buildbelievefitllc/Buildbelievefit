-- ═══════════════════════════════════════════════════════════════
-- BBF SUPABASE SCHEMA — Run this in Supabase SQL Editor
-- Dashboard → SQL Editor → New Query → Paste → Run
-- ═══════════════════════════════════════════════════════════════

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS bbf_users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'client',
  type TEXT DEFAULT 'Essentials',
  goal TEXT DEFAULT '',
  goal_weight TEXT DEFAULT '',
  plan TEXT,
  schedule TEXT DEFAULT 'standard',
  stress_mode TEXT DEFAULT 'desk',
  access_status TEXT DEFAULT 'unlocked',
  recovery_note TEXT DEFAULT '',
  pin_hash TEXT,
  auto_lock_enabled BOOLEAN DEFAULT false,
  lock_expiry BIGINT,
  intake JSONB,
  blueprint JSONB,
  onboarding_complete BOOLEAN DEFAULT false,
  onboarded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Idempotent column adds for existing deployments
ALTER TABLE bbf_users ADD COLUMN IF NOT EXISTS intake JSONB;
ALTER TABLE bbf_users ADD COLUMN IF NOT EXISTS blueprint JSONB;
ALTER TABLE bbf_users ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT false;
ALTER TABLE bbf_users ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ;
-- Ghost Protocol columns
ALTER TABLE bbf_users ADD COLUMN IF NOT EXISTS last_active_timestamp TIMESTAMPTZ;
ALTER TABLE bbf_users ADD COLUMN IF NOT EXISTS ghost_intervention_needed BOOLEAN DEFAULT false;
ALTER TABLE bbf_users ADD COLUMN IF NOT EXISTS ghost_flagged_at TIMESTAMPTZ;
ALTER TABLE bbf_users ADD COLUMN IF NOT EXISTS ghost_cleared_at TIMESTAMPTZ;
ALTER TABLE bbf_users ADD COLUMN IF NOT EXISTS mobility_override_date DATE;
-- High-Ticket Sniper — 1-on-1 Mastermind lead capture
ALTER TABLE bbf_users ADD COLUMN IF NOT EXISTS "1on1_lead_status" TEXT;
ALTER TABLE bbf_users ADD COLUMN IF NOT EXISTS "1on1_lead_reason" TEXT;
ALTER TABLE bbf_users ADD COLUMN IF NOT EXISTS "1on1_lead_submitted_at" TIMESTAMPTZ;
-- Kinematic Auditor — biomechanical friction score
ALTER TABLE bbf_users ADD COLUMN IF NOT EXISTS cns_friction_warning BOOLEAN DEFAULT false;
ALTER TABLE bbf_users ADD COLUMN IF NOT EXISTS cns_friction_score NUMERIC;
ALTER TABLE bbf_users ADD COLUMN IF NOT EXISTS cns_friction_updated_at TIMESTAMPTZ;
-- Somatic Sync — lifestyle/readiness inputs + CNS override
ALTER TABLE bbf_users ADD COLUMN IF NOT EXISTS somatic_fasting_hours NUMERIC;
ALTER TABLE bbf_users ADD COLUMN IF NOT EXISTS somatic_cognitive_load INT;
ALTER TABLE bbf_users ADD COLUMN IF NOT EXISTS somatic_sleep_quality INT;
ALTER TABLE bbf_users ADD COLUMN IF NOT EXISTS somatic_readiness_score NUMERIC;
ALTER TABLE bbf_users ADD COLUMN IF NOT EXISTS somatic_override_active BOOLEAN DEFAULT false;
ALTER TABLE bbf_users ADD COLUMN IF NOT EXISTS somatic_override_date DATE;
ALTER TABLE bbf_users ADD COLUMN IF NOT EXISTS somatic_tier TEXT;
ALTER TABLE bbf_users ADD COLUMN IF NOT EXISTS somatic_last_logged TIMESTAMPTZ;
-- Kinematic Auditor Intelligence Layer — redline flag + recovery math
ALTER TABLE bbf_users ADD COLUMN IF NOT EXISTS biomechanical_redline BOOLEAN DEFAULT false;
ALTER TABLE bbf_users ADD COLUMN IF NOT EXISTS biomechanical_redline_at TIMESTAMPTZ;
ALTER TABLE bbf_users ADD COLUMN IF NOT EXISTS recovery_capacity NUMERIC;
ALTER TABLE bbf_users ADD COLUMN IF NOT EXISTS recovery_debt NUMERIC;
ALTER TABLE bbf_users ADD COLUMN IF NOT EXISTS dominant_axial_lift TEXT;
-- Somatic Sync Intelligence Layer — stress input + flow/emergency flags
ALTER TABLE bbf_users ADD COLUMN IF NOT EXISTS somatic_stress_level INT;
ALTER TABLE bbf_users ADD COLUMN IF NOT EXISTS somatic_flow_state BOOLEAN DEFAULT false;
ALTER TABLE bbf_users ADD COLUMN IF NOT EXISTS system_emergency_deload BOOLEAN DEFAULT false;
-- Phantom Eye — video check-in state + coach critique pins
ALTER TABLE bbf_users ADD COLUMN IF NOT EXISTS last_video_check_status TEXT;
ALTER TABLE bbf_users ADD COLUMN IF NOT EXISTS last_video_check_uploaded_at TIMESTAMPTZ;
ALTER TABLE bbf_users ADD COLUMN IF NOT EXISTS last_video_check_exercise TEXT;
ALTER TABLE bbf_users ADD COLUMN IF NOT EXISTS last_video_check_rx_lift TEXT;
ALTER TABLE bbf_users ADD COLUMN IF NOT EXISTS video_critique_pins JSONB;
-- Phantom Comlink — async SOS + Architect reply intercept
ALTER TABLE bbf_users ADD COLUMN IF NOT EXISTS sos_outbox JSONB;
ALTER TABLE bbf_users ADD COLUMN IF NOT EXISTS last_sos_at TIMESTAMPTZ;
ALTER TABLE bbf_users ADD COLUMN IF NOT EXISTS architect_comlink_intercept JSONB;
-- Vault Door — waiver capture + Stripe provisioning
ALTER TABLE bbf_users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE bbf_users ADD COLUMN IF NOT EXISTS legal_name TEXT;
ALTER TABLE bbf_users ADD COLUMN IF NOT EXISTS waiver_version TEXT;
ALTER TABLE bbf_users ADD COLUMN IF NOT EXISTS waiver_signature_name TEXT;
ALTER TABLE bbf_users ADD COLUMN IF NOT EXISTS waiver_accepted_at TIMESTAMPTZ;
ALTER TABLE bbf_users ADD COLUMN IF NOT EXISTS waiver_ip TEXT;
ALTER TABLE bbf_users ADD COLUMN IF NOT EXISTS waiver_user_agent TEXT;
ALTER TABLE bbf_users ADD COLUMN IF NOT EXISTS tier_id TEXT;
ALTER TABLE bbf_users ADD COLUMN IF NOT EXISTS provisioning_state TEXT DEFAULT 'pending_payment';
ALTER TABLE bbf_users ADD COLUMN IF NOT EXISTS stripe_session_id TEXT;
ALTER TABLE bbf_users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE bbf_users ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE bbf_users ADD COLUMN IF NOT EXISTS subscription_status TEXT;
ALTER TABLE bbf_users ADD COLUMN IF NOT EXISTS temp_pin_displayed_at TIMESTAMPTZ;
ALTER TABLE bbf_users ADD COLUMN IF NOT EXISTS force_pin_reset BOOLEAN DEFAULT false;
-- Ephemeral PIN-display slot: plaintext + expiry. Webhook writes,
-- payment-success.html reads once and immediately clears via the
-- clear-temp-pin Edge Function. RLS policy must restrict reads to
-- the single bbf_user matching the URL-bound lead_id.
ALTER TABLE bbf_users ADD COLUMN IF NOT EXISTS temp_pin_plaintext TEXT;
ALTER TABLE bbf_users ADD COLUMN IF NOT EXISTS temp_pin_expires_at TIMESTAMPTZ;

-- Indexes for provisioning / state lookups
CREATE INDEX IF NOT EXISTS idx_bbf_users_provisioning_state ON bbf_users(provisioning_state);
CREATE INDEX IF NOT EXISTS idx_bbf_users_stripe_session    ON bbf_users(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_bbf_users_tier_id           ON bbf_users(tier_id);

-- 2. WORKOUT LOGS TABLE
CREATE TABLE IF NOT EXISTS bbf_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT REFERENCES bbf_users(id),
  date TEXT NOT NULL,
  type TEXT DEFAULT 'strength',
  duration TEXT DEFAULT '',
  intensity TEXT DEFAULT '',
  weight TEXT DEFAULT '',
  body_fat TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  mood TEXT DEFAULT '',
  exercises JSONB DEFAULT '[]',
  logged_at TIMESTAMPTZ DEFAULT NOW(),
  logged_by TEXT DEFAULT ''
);

-- 3. WORKOUT SETS TABLE (per-exercise set data)
CREATE TABLE IF NOT EXISTS bbf_sets (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT REFERENCES bbf_users(id),
  day_key TEXT NOT NULL,
  exercise_key TEXT NOT NULL,
  set_num INTEGER NOT NULL,
  reps TEXT DEFAULT '',
  weight TEXT DEFAULT '',
  logged_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, day_key, exercise_key, set_num)
);

-- 4. READINESS SCORES TABLE
CREATE TABLE IF NOT EXISTS bbf_readiness (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT REFERENCES bbf_users(id),
  date TEXT NOT NULL,
  sleep INTEGER,
  stress INTEGER,
  energy INTEGER,
  score INTEGER,
  logged_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- 5. INDEXES for performance
CREATE INDEX IF NOT EXISTS idx_logs_user ON bbf_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_logs_date ON bbf_logs(user_id, date);
CREATE INDEX IF NOT EXISTS idx_sets_user ON bbf_sets(user_id);
CREATE INDEX IF NOT EXISTS idx_sets_day ON bbf_sets(user_id, day_key);
CREATE INDEX IF NOT EXISTS idx_readiness_user ON bbf_readiness(user_id, date);

-- 6. ROW LEVEL SECURITY (enable but allow all for now — anon key)
ALTER TABLE bbf_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE bbf_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bbf_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE bbf_readiness ENABLE ROW LEVEL SECURITY;

-- Allow anon key full access (trainer controls everything)
CREATE POLICY "Allow all for anon" ON bbf_users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON bbf_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON bbf_sets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON bbf_readiness FOR ALL USING (true) WITH CHECK (true);

-- 7. SEED TRAINER ACCOUNT
INSERT INTO bbf_users (id, name, role, type, goal, pin_hash)
VALUES ('akeem', 'Akeem Brown', 'trainer', 'Trainer', 'Head Coach — Build Believe Fit', '1de5495d95a18bb628ebe8147e7f61046737bcc926fe89460e630a959a21b214')
ON CONFLICT (id) DO NOTHING;

-- SEED CLIENTS
INSERT INTO bbf_users (id, name, role, type, goal, plan, schedule, pin_hash) VALUES
  ('ana_bbf', 'Ana', 'client', 'Essentials', 'Lean & Toned', 'ana_spring', 'standard', '158a323a7ba44870f23d96f1516dd70aa48e9a72db4ebb026b0a89e212a208ab'),
  ('jacky_bbf', 'Jacky', 'client', 'Essentials', 'Strength & Endurance', 'jacky_plan', 'shifts', 'ceaa28bba4caba687dc31b1bbe79eca3c70c33f871f1ce8f528cf9ab5cfd76dd'),
  ('suzanna_bbf', 'Suzanna', 'client', 'Essentials', 'Tone & Feel Strong', 'suzanna_plan', 'standard', 'f8638b979b2f4f793ddb6dbd197e0ee25a7a6ea32b0ae22f5e3c5d119d839e75'),
  ('jordan_bbf', 'Jordan', 'client', 'Platinum', 'Weight Loss', 'jordan_wayne', '9to5', '0ffe1abd1a08215353c233d6e009613e95eec4253832a761af28ff37ac5a150c'),
  ('wayne_bbf', 'Wayne', 'client', 'Platinum', 'Lean Muscle', 'jordan_wayne', 'shifts', 'edee29f882543b956620b26d0ee0e7e950399b1c4222f5de05e06425b4c995e9')
ON CONFLICT (id) DO NOTHING;

-- 8. CLINICAL YIELD LOG
CREATE TABLE IF NOT EXISTS clinical_yield_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  marker_01_cns_readiness NUMERIC,
  marker_02_grip_strength NUMERIC,
  marker_03_rpe_tolerance NUMERIC,
  marker_04_hrv NUMERIC,
  marker_05_sleep_efficiency NUMERIC,
  marker_06_joint_mobility NUMERIC,
  marker_07_hydration NUMERIC,
  marker_08_cortisol_trend NUMERIC,
  marker_09_muscle_soreness NUMERIC,
  marker_10_resting_hr NUMERIC,
  marker_11_blood_pressure NUMERIC,
  phase_unlocked BOOLEAN DEFAULT false
);

ALTER TABLE clinical_yield_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Client Read/Write" ON clinical_yield_log
FOR ALL
USING (auth.uid() = client_id)
WITH CHECK (auth.uid() = client_id);

CREATE POLICY "Architect Read" ON clinical_yield_log
FOR SELECT
USING ((auth.jwt() ->> 'role') = 'admin');
