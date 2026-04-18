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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

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
