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
INSERT INTO bbf_users (id, name, role, type, goal)
VALUES ('akeem', 'Akeem Brown', 'trainer', 'Trainer', 'Head Coach — Build Believe Fit')
ON CONFLICT (id) DO NOTHING;

-- SEED CLIENTS
INSERT INTO bbf_users (id, name, role, type, goal, plan, schedule) VALUES
  ('ana_bbf', 'Ana', 'client', 'Essentials', 'Lean & Toned', 'ana_spring', 'standard'),
  ('jacky_bbf', 'Jacky', 'client', 'Essentials', 'Strength & Endurance', 'jacky_plan', 'shifts'),
  ('suzanna_bbf', 'Suzanna', 'client', 'Essentials', 'Tone & Feel Strong', 'suzanna_plan', 'standard'),
  ('jordan_bbf', 'Jordan', 'client', 'Platinum', 'Weight Loss', 'jordan_wayne', '9to5'),
  ('wayne_bbf', 'Wayne', 'client', 'Platinum', 'Lean Muscle', 'jordan_wayne', 'shifts')
ON CONFLICT (id) DO NOTHING;
