-- ═══════════════════════════════════════════════════════════════
-- Prehab data layer · bbf_prehab_catalog + bbf_client_prehab
-- ───────────────────────────────────────────────────────────────
-- Replaces the legacy hardcoded static catalogs (bbf-data.js `PREHAB`,
-- prehab-auditor.js correctives, workout-data.js) with real tables so the
-- Prehab React UI has a contract to fetch against.
--
-- Catalog seed is ported VERBATIM from the legacy data (en + es as they
-- existed; pt only where the legacy data actually had it — pt gaps are a
-- trilingual backfill follow-up, not fabricated here).
--
-- RLS:
--   bbf_prehab_catalog — public SELECT of active movements (non-sensitive
--     reference library); writes service-role only.
--   bbf_client_prehab  — RLS on, NO policies (per-client data; read/write
--     via service-role edge fn, matching bbf_sets / bbf_meal_logs). Add an
--     auth.uid()-scoped policy once the Supabase Auth ↔ bbf_users mapping
--     is finalized.
-- ═══════════════════════════════════════════════════════════════

-- ─── Master movement catalog ───────────────────────────────────────
create table if not exists public.bbf_prehab_catalog (
  movement_key  text primary key,         -- stable slug, e.g. 'pallof_press_iso'
  name_en       text not null,
  name_es       text,
  name_pt       text,
  region        text not null,            -- lumbar_spine | shoulder | hip | ankle_knee | wrist_grip | core
  focus_en      text,
  default_sets  text,                     -- text: legacy uses '2 sets' / '3 sets'
  default_reps  text,                     -- text: legacy uses '10 reps' / '30-60s hold' / '12 per side'
  equipment     text,
  active        boolean not null default true,
  sort          integer not null default 0,
  created_at    timestamptz not null default now()
);
comment on table public.bbf_prehab_catalog is
  'Master prehab movement library (ported from legacy bbf-data.js PREHAB + prehab-auditor.js). Public-read reference data.';

alter table public.bbf_prehab_catalog enable row level security;
drop policy if exists bbf_prehab_catalog_public_read on public.bbf_prehab_catalog;
create policy bbf_prehab_catalog_public_read
  on public.bbf_prehab_catalog for select
  to anon, authenticated
  using (active);

-- ─── Per-client assignments ─────────────────────────────────────────
create table if not exists public.bbf_client_prehab (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references public.bbf_users(id) on delete cascade,
  vault_email   text,                     -- denormalized link (some flows key by email)
  movement_key  text not null references public.bbf_prehab_catalog(movement_key) on delete restrict,
  target_sets   integer,
  target_reps   text,                     -- text: e.g. '12 per side' / '30-60s hold'
  active        boolean not null default true,
  assigned_by   text,                     -- coach uid / 'system'
  assigned_at   timestamptz not null default now(),
  notes         text
);
comment on table public.bbf_client_prehab is
  'Per-client prehab assignments linking a user (user_id/vault_email) to bbf_prehab_catalog movements. Service-role only.';

create index if not exists bbf_client_prehab_user_id_idx     on public.bbf_client_prehab (user_id);
create index if not exists bbf_client_prehab_vault_email_idx on public.bbf_client_prehab (vault_email);
create index if not exists bbf_client_prehab_movement_idx    on public.bbf_client_prehab (movement_key);

alter table public.bbf_client_prehab enable row level security;
-- Intentionally no policies: service role only (per-client data).

-- ─── Seed: legacy prehab movements (idempotent) ─────────────────────
insert into public.bbf_prehab_catalog
  (movement_key, name_en, name_es, name_pt, region, focus_en, default_sets, default_reps, equipment, sort) values
  ('cat_cow',                'Cat-Cow Mobilization',          'Movilización Gato-Vaca',          null,                                 'lumbar_spine', 'Low back relief; segmental spine mobility',           '2 sets', '10 reps',            'Bodyweight', 10),
  ('childs_pose',            'Childs Pose Hold',              'Postura del Niño',                null,                                 'lumbar_spine', 'Lumbar decompression (L4-L5)',                        '2 sets', '30-60s hold',        'Bodyweight', 20),
  ('wall_slides',            'Wall Slides',                   'Deslizamientos en Pared',         null,                                 'shoulder',     'Overhead reach restoration',                          '3 sets', '15 reps',            'Bodyweight', 30),
  ('band_external_rotation', 'Band External Rotation',        'Rotación Externa con Banda',      'Rotação Externa com Faixa',          'shoulder',     'Rotator cuff (infraspinatus)',                        '3 sets', '15 reps',            'Band',       40),
  ('hip_90_90',              '90/90 Hip Stretch',             'Estiramiento 90/90 de Cadera',    'Alongamento 90/90 do Quadril',       'hip',          'Hip capsule mobility',                                '1 set',  '45-60s per side',    'Bodyweight', 50),
  ('glute_bridge',           'Glute Bridge Activation',       'Activación del Puente de Glúteos','Ponte de Glúteos',                    'hip',          'Glute activation; anti-inhibition (2s pause)',        '3 sets', '12-15 reps',         'Bodyweight', 60),
  ('single_leg_balance',     'Single-Leg Balance Progression','Progresión de Equilibrio en Una Pierna', null,                          'ankle_knee',   'Proprioception / joint-awareness rebuild',            '1 set',  '30s each',           'Bodyweight', 70),
  ('calf_raise_pause',       'Calf Raise with Pause',         'Elevación de Talones con Pausa',  'Elevação de Panturrilha com Pausa',  'ankle_knee',   'Soleus loading; Achilles + knee protection',          '2 sets', '15 reps',            'Bodyweight', 80),
  ('prayer_stretch',         'Prayer Stretch & Reverse Prayer','Estiramiento de Rezo y Rezo Inverso', null,                            'wrist_grip',   'Forearm / wrist mobility',                            '2 sets', '20-30s holds',       'Bodyweight', 90),
  ('finger_extension_band',  'Finger Extension with Band',    'Extensión de Dedos con Banda',    null,                                 'wrist_grip',   'Extensor balance; tendinitis prevention',             '2 sets', '20 reps',            'Band',       100),
  ('bird_dog',               'Bird-Dogs',                     null,                              null,                                 'core',         'Anti-extension core; spinal stability (ribs locked)', '3 sets', '12 per side',        'Bodyweight', 110),
  ('dead_bug',               'Dead Bug',                      'Dead Bug',                        'Dead Bug',                           'core',         'Anti-extension core; lumbar control',                 '3 sets', '8 per side',         'Bodyweight', 120),
  ('pallof_press_iso',       'Pallof Press ISO Hold',         'Press Pallof con Pausa Isométrica','Press Pallof com Pausa Isométrica', 'core',         'Anti-rotation core stability under torque',           '3 sets', '20s per side',       'Cable/Band', 130)
on conflict (movement_key) do nothing;
