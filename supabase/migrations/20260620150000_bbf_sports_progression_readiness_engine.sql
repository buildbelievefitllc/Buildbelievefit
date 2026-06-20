-- 20260620150000_bbf_sports_progression_readiness_engine.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- BBF Sports Hub — Athletic Progression & Readiness Engine ("The Brain").
-- Implements §3 of the Architecture Blueprint: athlete_profiles, sport_milestones,
-- athlete_milestones_sync, athlete_readiness_logs, nutrition_recovery_logs.
--
-- Trilingual milestone columns (title_en/es/pt) and the exact CHECK constraints
-- (gender, vibe_check) are reproduced verbatim from the blueprint.
--
-- IDENTITY DEVIATION (documented): the blueprint specs `user_id REFERENCES
-- auth.users`. BBF athletes do NOT live in auth.users — the platform uses a
-- username+PIN model whose identity is `public.bbf_users(id)` (uuid), resolved
-- server-side from the vault token (see AuthContext.jsx + every bbf_* edge fn).
-- FKing to auth.users would reject every real athlete insert, so user_id is bound
-- to public.bbf_users(id) — the platform's true identity table — keeping this
-- engine consistent with bbf_weekly_briefs et al.
--
-- SECURITY (§7): RLS is enabled on all five tables. The athlete-data tables are
-- service-role-only (the engine reads/writes them through vault-token-gated edge
-- functions; there is no GoTrue user JWT to scope auth.uid() policies to). The
-- sport_milestones blueprint is non-sensitive reference content, readable by all.

create extension if not exists "uuid-ossp";

-- ── Athlete Profile: Core Identity ───────────────────────────────────────────
create table if not exists public.athlete_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.bbf_users(id) on delete cascade,
  full_name text not null,
  birth_date date not null,
  gender text check (gender in ('male', 'female', 'coed')),
  sport text not null,
  current_tier text default 'youth',          -- youth, middle_school, high_school, collegiate
  preferred_language text default 'en',        -- en, es, pt
  created_at timestamp with time zone default now()
);

-- ── Milestones: The Skills Blueprint (trilingual) ────────────────────────────
create table if not exists public.sport_milestones (
  id uuid primary key default uuid_generate_v4(),
  sport text not null,
  tier text not null,
  title_en text not null,
  title_es text,
  title_pt text,
  description_en text,
  required_reps integer default 1,
  category text                                -- technical, physical, mental
);

-- ── Progress Sync: Tracking Completion ───────────────────────────────────────
create table if not exists public.athlete_milestones_sync (
  id uuid primary key default uuid_generate_v4(),
  athlete_id uuid references public.athlete_profiles(id) on delete cascade,
  milestone_id uuid references public.sport_milestones(id),
  completed_at timestamp with time zone default now(),
  verified_by_coach boolean default false
);

-- ── Readiness Logs: The Vibe & Biometrics ────────────────────────────────────
create table if not exists public.athlete_readiness_logs (
  id uuid primary key default uuid_generate_v4(),
  athlete_id uuid references public.athlete_profiles(id),
  sleep_hours numeric,
  wearable_sync_id text,                       -- For Oura/Whoop/Garmin
  vibe_check text check (vibe_check in ('chilling', 'chill_restless', 'little_irritated', 'exhausted_irritated')),
  readiness_score numeric,
  volume_multiplier numeric,
  created_at date default current_date
);

-- ── Nutrition & Recovery: Clinical Tracking ──────────────────────────────────
create table if not exists public.nutrition_recovery_logs (
  id uuid primary key default uuid_generate_v4(),
  athlete_id uuid references public.athlete_profiles(id),
  fasting_completed boolean,
  protein_grams numeric,
  prehab_session_minutes integer,
  stretching_completed boolean,
  logged_at timestamp with time zone default now()
);

-- ── Indices for performance (blueprint §3) ───────────────────────────────────
create index if not exists idx_athlete_sport on public.athlete_profiles(sport);
create index if not exists idx_readiness_date on public.athlete_readiness_logs(created_at);
-- Engine hot paths: profile lookup by user, milestone lookup by (sport,tier), sync by athlete.
create index if not exists idx_athlete_profiles_user on public.athlete_profiles(user_id);
create index if not exists idx_sport_milestones_sport_tier on public.sport_milestones(sport, tier);
create index if not exists idx_milestones_sync_athlete on public.athlete_milestones_sync(athlete_id);

-- ── RLS (§7) ─────────────────────────────────────────────────────────────────
alter table public.athlete_profiles        enable row level security;
alter table public.sport_milestones        enable row level security;
alter table public.athlete_milestones_sync enable row level security;
alter table public.athlete_readiness_logs  enable row level security;
alter table public.nutrition_recovery_logs enable row level security;

-- Reference content — the skills blueprint is meant to be shown to athletes.
drop policy if exists sport_milestones_public_read on public.sport_milestones;
create policy sport_milestones_public_read on public.sport_milestones
  for select to anon, authenticated using (true);
-- (The four athlete-data tables intentionally have NO anon/authenticated policy:
--  RLS-on + no-policy = deny-all to the client roles; only the service_role used
--  by the edge functions reaches them.)

grant select on public.sport_milestones to anon, authenticated;
grant select, insert, update, delete on
  public.athlete_profiles, public.sport_milestones, public.athlete_milestones_sync,
  public.athlete_readiness_logs, public.nutrition_recovery_logs
  to service_role;

-- ── Seed: the §2 Core Sports Progression Matrix (idempotent) ─────────────────
-- One milestone per (sport, tier) across the eight blueprint sports so the
-- progression engine has a real "required set" to evaluate against. Trilingual.
insert into public.sport_milestones (sport, tier, title_en, title_es, title_pt, description_en, required_reps, category)
select * from (values
  -- Football
  ('football','youth','Tag Mechanics & Lateral Agility','Mecánica de Tag y Agilidad Lateral','Mecânica de Pega-Pega e Agilidade Lateral','Fun-based tag mechanics, basic throwing/catching, and lateral agility.',1,'technical'),
  ('football','middle_school','Position Intro & Tackle Safety','Introducción de Posición y Seguridad en Tacleadas','Introdução de Posição e Segurança no Tackle','Position intro (QB/WR/Line), core strength, and safe tackle technique.',1,'physical'),
  ('football','high_school','Advanced Schemes & Recruiting Sync','Esquemas Avanzados y Sincronización de Reclutamiento','Esquemas Avançados e Sincronização de Recrutamento','Advanced schemes, RPE tracking, and recruiting profile sync.',1,'mental'),
  ('football','collegiate','Elite Playbook & 16/8 Fasting','Playbook de Élite y Ayuno 16/8','Playbook de Elite e Jejum 16/8','Elite playbook mastery, 16/8 intermittent fasting, and career analytics.',1,'mental'),
  -- Basketball
  ('basketball','youth','Dribbling Games & Coordination','Juegos de Dribbling y Coordinación','Jogos de Drible e Coordenação','Hand-eye coordination, dribbling games, and teamwork basics.',1,'technical'),
  ('basketball','middle_school','Jump Shot & Triple Threat','Tiro en Suspensión y Triple Amenaza','Arremesso e Tríplice Ameaça','Jump shot mechanics, triple threat, and intro to plyometrics.',1,'technical'),
  ('basketball','high_school','Positional Mastery & Film','Dominio Posicional y Video','Domínio Posicional e Vídeo','Pick-and-roll defense, positional mastery, and recruitment film.',1,'mental'),
  ('basketball','collegiate','Elite CNS Optimization','Optimización del SNC de Élite','Otimização do SNC de Elite','Elite CNS optimization, pro-readiness analytics, and prehab mapping.',1,'physical'),
  -- Soccer
  ('soccer','youth','Ball Control & Small-Sided Games','Control del Balón y Juegos Reducidos','Controle de Bola e Jogos Reduzidos','Ball control, small-sided games, and spatial awareness.',1,'technical'),
  ('soccer','middle_school','First Touch & Aerobic Base','Primer Toque y Base Aeróbica','Primeiro Toque e Base Aeróbica','First touch precision, aerobic base, and position-specific runs.',1,'physical'),
  ('soccer','high_school','Tactical Periodization & Showcase','Periodización Táctica y Showcase','Periodização Tática e Showcase','Tactical periodization, RPE overload, and college showcase prep.',1,'mental'),
  ('soccer','collegiate','Clinical Nutrition & Game-Speed','Nutrición Clínica y Velocidad de Juego','Nutrição Clínica e Velocidade de Jogo','Clinical nutrition, joint-mapping, and professional game-speed.',1,'physical'),
  -- Volleyball
  ('volleyball','youth','Serve Fundamentals & Footwork','Fundamentos de Saque y Juego de Pies','Fundamentos de Saque e Trabalho de Pés','Basic underhand/overhand serve and footwork agility.',1,'technical'),
  ('volleyball','middle_school','Rotational Awareness & Core','Conciencia Rotacional y Core','Consciência Rotacional e Core','Net height adjustment (M/F), rotational awareness, and core stability.',1,'physical'),
  ('volleyball','high_school','Vertical Jump & Positional Tactics','Salto Vertical y Tácticas Posicionales','Salto Vertical e Táticas Posicionais','Jump training (vert), position-specific tactics, and recruiting.',1,'physical'),
  ('volleyball','collegiate','Elite Recovery & Playbooks','Recuperación de Élite y Playbooks','Recuperação de Elite e Playbooks','Elite recovery protocols, position playbooks, and clinical prehab.',1,'mental'),
  -- Softball
  ('softball','youth','Throwing & Base Running','Lanzamiento y Corrido de Bases','Arremesso e Corrida de Bases','Throwing mechanics, basic hitting stance, and base running.',1,'technical'),
  ('softball','middle_school','Windmill Pitching & Rotational Power','Lanzamiento Windmill y Potencia Rotacional','Arremesso Windmill e Potência Rotacional','Windmill pitching intro, core rotational power, and defensive IQ.',1,'physical'),
  ('softball','high_school','Slap/Power Hitting & Profiles','Bateo de Slap/Potencia y Perfiles','Rebatida Slap/Potência e Perfis','Advanced slap/power hitting, recruiting profiles, and hydration framework.',1,'technical'),
  ('softball','collegiate','Performance Tracking & Nutrition','Seguimiento de Rendimiento y Nutrición','Acompanhamento de Performance e Nutrição','Elite performance tracking, career-ready analytics, and clinical nutrition.',1,'physical'),
  -- Tennis
  ('tennis','youth','Racket Handling & Groundstrokes','Manejo de Raqueta y Golpes de Fondo','Manuseio de Raquete e Golpes de Fundo','Racket handling, balance, and basic groundstrokes.',1,'technical'),
  ('tennis','middle_school','Stroke Consistency & Footwork','Consistencia de Golpes y Juego de Pies','Consistência de Golpes e Trabalho de Pés','Stroke consistency, footwork drills, and intro to match strategy.',1,'technical'),
  ('tennis','high_school','SAQ & Performance Tracking','SAQ y Seguimiento de Rendimiento','SAQ e Acompanhamento de Performance','Speed/Agility/Quickness (SAQ), performance tracking, and recruiting.',1,'physical'),
  ('tennis','collegiate','Elite Endurance & Joint Prehab','Resistencia de Élite y Prehab Articular','Resistência de Elite e Prehab Articular','Elite endurance, position-specific joint prehab, and professional analytics.',1,'physical'),
  -- Boxing
  ('boxing','youth','Stance, Balance & Basic Combos','Postura, Equilibrio y Combos Básicos','Guarda, Equilíbrio e Combinações Básicas','Stance/balance, basic 1-2 combos, and defensive movement.',1,'technical'),
  ('boxing','middle_school','Weight Awareness & Technical Sparring','Conciencia de Peso y Sparring Técnico','Consciência de Peso e Sparring Técnico','Weight category awareness, technical sparring, and core flexibility.',1,'technical'),
  ('boxing','high_school','Counter-Punching & CNS Tracking','Contraataque y Seguimiento del SNC','Contra-Ataque e Monitoramento do SNC','Advanced counter-punching, CNS volume tracking, and tournament prep.',1,'mental'),
  ('boxing','collegiate','Pro Weight Management & Tactics','Gestión de Peso Pro y Tácticas','Gestão de Peso Pro e Táticas','Pro-level weight management (fasting) and elite tactical systems.',1,'mental'),
  -- MMA
  ('mma','youth','Coordination & Grappling Games','Coordinación y Juegos de Grappling','Coordenação e Jogos de Grappling','Coordination, basic sprawl, and positional grappling games.',1,'technical'),
  ('mma','middle_school','Takedowns & Submission Defense','Derribos y Defensa de Sumisiones','Quedas e Defesa de Finalizações','Takedown mechanics, submission defense, and position intro.',1,'technical'),
  ('mma','high_school','System Integration & Prehab','Integración de Sistemas y Prehab','Integração de Sistemas e Prehab','Full system integration, injury prehab, and amateur circuit prep.',1,'physical'),
  ('mma','collegiate','Pro Camp & CNS Monitoring','Campamento Pro y Monitoreo del SNC','Camp Pro e Monitoramento do SNC','Professional camp protocols, elite CNS monitoring, and career mapping.',1,'mental')
) as seed(sport, tier, title_en, title_es, title_pt, description_en, required_reps, category)
where not exists (select 1 from public.sport_milestones);
