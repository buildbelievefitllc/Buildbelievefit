-- ═══════════════════════════════════════════════════════════════════════════
-- BBF LAB · PHASE 1 · MIGRATION 7/7 — DEPENDENCIES · CONFIG SEEDS · BUCKETS
-- ───────────────────────────────────────────────────────────────────────────
-- The remaining architectural substrate the six domain migrations reference:
--   A) Reference tables  : movement_load_taxonomy (+seed), athlete_injury_history,
--                          bbf_vocab_catalog, language_audio_fragments, scenario_catalog
--   B) Column appends     : bbf_sets.load_g (gram-generated), athlete_profiles.body_mass_g
--   C) Config seeds       : every bbf_app_config coefficient/weight block from the blueprints
--   D) Storage buckets    : sovereign-fragments (public), language-fragments (public),
--                           directed-v1 (private) — coach-static house style
--
-- GRAM STANDARD: load_g = ROUND(weight_lbs::numeric × 453.59237) — the legacy
--   DOUBLE PRECISION weight is cast to NUMERIC so the gram value is EXACT (316 lb →
--   143,335 g), no float drift. taxonomy/coeffs are dimensionless g/g ratios.
-- SERVICE-ROLE RLS: every new table enabled + forced + revoked from anon/authenticated.
-- CONFIG SEEDS: ON CONFLICT (key) DO NOTHING — establish blueprint defaults once,
--   never clobber a live-tuned value on re-run (versioned _v1 keys).
-- ═══════════════════════════════════════════════════════════════════════════


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ A · REFERENCE TABLES                                                       ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- A1 · movement_load_taxonomy — exercise → per-vector coefficient matrix (Prehab §1.1)
create table if not exists public.movement_load_taxonomy (
  id                     uuid primary key default gen_random_uuid(),
  pattern_name           text unique not null,            -- 'back_squat', 'hinge_deadlift', ...
  detect_regex           text not null,                   -- matched against drill/exercise name
  veto_regex             text,                            -- safe variants excluded
  axial_coeff            numeric not null default 0,      -- 0.00–1.00 per vector
  knee_coeff             numeric not null default 0,
  hip_coeff              numeric not null default 0,
  shoulder_coeff         numeric not null default 0,
  elbow_coeff            numeric not null default 0,
  impact_coeff           numeric not null default 0,
  bodyweight_load_coeff  numeric not null default 0,      -- fraction of body_mass_g per rep
  muscle_groups          text[] not null default '{}',    -- recovery-library group keys
  created_at             timestamptz not null default now()
);
alter table public.movement_load_taxonomy enable row level security;
alter table public.movement_load_taxonomy force  row level security;
revoke all on table public.movement_load_taxonomy from anon, authenticated;

-- Seed coefficients (Prehab §1.1 table, exact) — regexes grounded in autoRegulation.js;
-- muscle_groups use the live frontend recovery vocabulary. General = the catch-all
-- fallthrough (strain is never silently dropped to zero).
insert into public.movement_load_taxonomy
  (pattern_name, detect_regex, veto_regex,
   axial_coeff, knee_coeff, hip_coeff, shoulder_coeff, elbow_coeff, impact_coeff, bodyweight_load_coeff, muscle_groups)
values
  ('back_squat',        '\bback\s?squats?\b|\bbarbell\s?squats?\b', '\bfront\b|\bgoblet\b|\bsplit\b|\bbulgarian\b|\bhack\b',
                        1.00, 0.90, 0.40, 0.05, 0.00, 0.00, 0.85, array['quads','glutes','lower_back','core']),
  ('front_squat',       '\bfront\s?squats?\b', null,
                        0.90, 0.95, 0.30, 0.10, 0.10, 0.00, 0.85, array['quads','glutes','core']),
  ('deadlift_trapbar',  '\bdead\s?lifts?\b|\btrap\s?bar\b', '\bromanian\b|\brdls?\b|\bstiff\b',
                        0.95, 0.40, 1.00, 0.10, 0.15, 0.00, 0.85, array['glutes','hamstrings','lower_back','back']),
  ('rdl',               '\bromanian\s?dead\s?lifts?\b|\brdls?\b|\bstiff\s?leg\b', null,
                        0.70, 0.15, 0.95, 0.05, 0.10, 0.00, 0.85, array['hamstrings','glutes','lower_back']),
  ('leg_press',         '\bleg\s?press\b|\bhack\s?squat\b', null,
                        0.15, 0.90, 0.30, 0.00, 0.00, 0.00, 0.00, array['quads','glutes']),
  ('overhead_press',    '\boverhead\b|\bmilitary\b|\bohp\b|\bshoulder\s?press\b', '\bseated\b|\btriceps?\b|\bextensions?\b|\bcurls?\b',
                        0.75, 0.05, 0.05, 1.00, 0.60, 0.00, 0.10, array['shoulders','triceps','core']),
  ('bench_press',       '\bbench\b|\bhorizontal\s?press\b|\bchest\s?press\b', '\boverhead\b|\bmilitary\b',
                        0.05, 0.00, 0.00, 0.80, 0.70, 0.00, 0.00, array['chest','shoulders','triceps']),
  ('bent_over_row',     '\bbent[\s-]?over\b|\bbarbell\s?rows?\b', '\bseated\b|\bcable\b|\bmachine\b',
                        0.55, 0.05, 0.60, 0.40, 0.60, 0.00, 0.10, array['back','lats','biceps','lower_back']),
  ('lunge_split_squat', '\blunges?\b|\bsplit\s?squats?\b|\bbulgarian\b', null,
                        0.45, 0.95, 0.50, 0.00, 0.00, 0.20, 0.85, array['quads','glutes','hamstrings']),
  ('box_jump_plyo',     '\bbox\s?jumps?\b|\bplyo\b|\bplyometrics?\b|\bbounds?\b', null,
                        0.30, 0.70, 0.40, 0.00, 0.00, 1.00, 1.00, array['quads','calves','glutes']),
  ('push_up',           '\bpush[\s-]?ups?\b', null,
                        0.00, 0.00, 0.00, 0.70, 0.65, 0.00, 0.64, array['chest','triceps','shoulders','core']),
  ('pull_up',           '\bpull[\s-]?ups?\b|\bchin[\s-]?ups?\b', null,
                        0.10, 0.00, 0.00, 0.75, 0.80, 0.00, 1.00, array['back','lats','biceps']),
  ('general',           '.*', null,
                        0.20, 0.20, 0.20, 0.20, 0.20, 0.20, 0.30, array['core'])
on conflict (pattern_name) do nothing;

-- A2 · athlete_injury_history — the shared memory organ (Prehab §3.5)
create table if not exists public.athlete_injury_history (
  id                       uuid primary key default gen_random_uuid(),
  athlete_id               uuid not null references public.athlete_profiles(id) on delete cascade,
  joint_zone               text not null check (joint_zone in
                             ('shoulder','knee','lower_back','elbow','hamstring',
                              'ankle','hip','wrist','neck','groin')),
  side                     text not null default 'n/a'
                             check (side in ('left','right','bilateral','n/a')),
  injury_type              text not null check (injury_type in
                             ('acute_trauma','overuse','surgical','chronic','friction_pattern')),
  diagnosis_label          text,
  mechanism                text check (mechanism in
                             ('axial_load','impact','rotational','overextension',
                              'repetitive_strain','contact','unknown')),
  sport_context            text,
  severity                 integer not null check (severity between 1 and 10),
  occurred_on              date not null,
  resolved_on              date,                         -- null = still open → H_j uses today
  recurrence_count         integer not null default 0,
  sensitivity_coefficient  numeric not null default 1.00
                             check (sensitivity_coefficient between 0.80 and 2.00),
  coefficient_audit        jsonb not null default '[]',  -- append-only mutation trail (§2.6)
  reported_by              text not null check (reported_by in
                             ('athlete_checkin','coach','clinician','intake','system_inferred')),
  source_feedback_id       uuid,
  notes                    text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
alter table public.athlete_injury_history enable row level security;
alter table public.athlete_injury_history force  row level security;
revoke all on table public.athlete_injury_history from anon, authenticated;

create index if not exists idx_aih_athlete_joint
  on public.athlete_injury_history (athlete_id, joint_zone);

comment on table public.athlete_injury_history is
  'BBF Lab P1 · shared injury memory. Prehab reads it for H_j + writes system-inferred overuse rows; Recovery reads it for the HISTORY SLOT. sensitivity_coefficient is the learned per-athlete/per-sport fragility term; coefficient_audit is its explainable trail. Service-role only.';

-- A3 · bbf_vocab_catalog — the versioned term pool every language module draws from (Lang §1.3)
create table if not exists public.bbf_vocab_catalog (
  id                   uuid primary key default gen_random_uuid(),
  term                 text not null,
  language             text not null check (language in ('es','pt')),
  translation_en       text,                        -- EN prompt / meaning
  category             text,                        -- semantic grouping
  phase_min            smallint not null default 1 check (phase_min between 1 and 5),
  catalog_order        integer not null default 0,  -- introduction order (§2.3 Tranche 3)
  native_fragment_key  text,                        -- 'VOC_<lang>_<term-slug>'
  prompt_fragment_key  text,                        -- 'VOCEN_<term-slug>'
  source_kit           text not null default 'seed'
                         check (source_kit in ('seed','phrase_kit','pimsleur_vocab')),
  status               text not null default 'active' check (status in ('active','retired')),
  created_at           timestamptz not null default now(),
  unique (language, term)
);
alter table public.bbf_vocab_catalog enable row level security;
alter table public.bbf_vocab_catalog force  row level security;
revoke all on table public.bbf_vocab_catalog from anon, authenticated;

comment on table public.bbf_vocab_catalog is
  'BBF Lab P1 · versioned vocab reference pool (term/language/category/phase_min/fragment keys). The 100 seed terms + 50-phrase kit + lesson vocab are extracted out of JSX by the inventory build script (bake pipeline) — this migration provisions the structure. Service-role only.';

-- A4 · language_audio_fragments — baked language fragment library (Lang §3.2, mirrors sovereign_audio_fragments)
create table if not exists public.language_audio_fragments (
  id             uuid primary key default gen_random_uuid(),
  fragment_key   text not null unique,              -- 'PIM_<hash>' | 'VOC_<lang>_<slug>' | 'PHR_pt_<slug>' | ...
  speaker_role   text not null,                     -- narrator | pt_native_female | pt_native_male | es_native | ...
  language       text not null check (language in ('en','es','pt')),
  script_text    text not null,
  script_version integer not null default 1,
  sha256         text not null,                     -- hash → idempotent re-bake
  storage_path   text not null,                     -- language-fragments/<key>.mp3
  public_url     text not null,
  duration_ms    integer not null,
  lufs           numeric,                            -- −16 LUFS bake audit
  status         text not null default 'active' check (status in ('active','retired')),
  baked_at       timestamptz not null default now()
);
alter table public.language_audio_fragments enable row level security;
alter table public.language_audio_fragments force  row level security;
revoke all on table public.language_audio_fragments from anon, authenticated;

create index if not exists idx_laf_language_status
  on public.language_audio_fragments (language, status);

comment on table public.language_audio_fragments is
  'BBF Lab P1 · baked Pimsleur/vocab/phrase/drill fragment library = the language router allow-list. Language natives are deliberately different voices from the Akeem coach clone. Post-bake coverage gate: every dialogue line + catalog term must resolve here. Service-role only.';

-- A5 · scenario_catalog — the immersion difficulty ladder (Lang §4.5)
create table if not exists public.scenario_catalog (
  id           uuid primary key default gen_random_uuid(),
  scenario_key text not null,
  language     text not null check (language in ('es','pt')),
  tier         smallint not null check (tier between 1 and 3),
  phase_min    smallint not null default 2 check (phase_min between 1 and 5),
  title        text not null,
  prompt       text not null,                        -- register/complexity directive for the Opus immersion prompt
  status       text not null default 'active' check (status in ('active','retired')),
  created_at   timestamptz not null default now(),
  unique (scenario_key, language)
);
alter table public.scenario_catalog enable row level security;
alter table public.scenario_catalog force  row level security;
revoke all on table public.scenario_catalog from anon, authenticated;

comment on table public.scenario_catalog is
  'BBF Lab P1 · immersion scenario ladder (tier 1–3, phase-gated). Tier 1 available from Phase 2; tier 2 at fluency_ewma≥65; tier 3 at ≥75. Scenario content is seeded by the language content-extraction pass; this migration provisions the structure. Service-role only.';


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ B · COLUMN APPENDS (existing tables — gram boundary)                        ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- B1 · bbf_sets.load_g — the LAST moment pounds exist (Prehab §1.3).
-- weight_lbs is DOUBLE PRECISION (legacy write surface); cast to NUMERIC for an
-- EXACT integer-gram conversion, stored generated. All reads downstream use load_g.
alter table public.bbf_sets
  add column if not exists load_g bigint
  generated always as (round(weight_lbs::numeric * 453.59237)) stored;

alter table public.bbf_sets enable row level security;   -- re-assert (already enabled+policied)

-- B2 · athlete_profiles.body_mass_g — converted once at intake (Prehab §1.3).
alter table public.athlete_profiles
  add column if not exists body_mass_g         bigint,
  add column if not exists body_mass_logged_at timestamptz;

alter table public.athlete_profiles enable row level security;   -- re-assert (already enabled)


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ C · CONFIG SEEDS (bbf_app_config · JSON-in-TEXT · DO NOTHING)               ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

insert into public.bbf_app_config (key, value) values

-- ── Prehab / Workload / Recovery ─────────────────────────────────────────────
('prehab_risk_weights_v1',
 '{"acwr":0.35,"spike":0.20,"history":0.25,"readiness":0.10,"monotony":0.10,"version":"v1"}'),

('acwr_bands_v1',
 '{"lambda_acute":0.25,"lambda_chronic":0.0689655,"epsilon_au":1,"cold_start_days":14,
   "bands":{"underload":0.80,"sweet_low":0.80,"sweet_high":1.30,"caution_high":1.50},
   "f_acwr":{"underload_risk":0.30,"ramp_low":1.30,"ramp_high":1.80},
   "rpe_spike":{"delta_7d_28d":1.5,"strain_mult":1.25},"monotony_flag":2.0}'),

('recovery_debt_bands_v1',
 '{"half_life_h_full":36,"sleep_factor_floor":0.5,
   "bands":{"deep":1.40,"standard_plus":0.90,"standard":0.40},
   "systemic_flag_mult":2.0,"systemic_vol_ceiling":0.8,"history_slot_sensitivity":1.2,
   "shadow":{"tonnage_mult":1.5,"mean_rpe":8,"hours":48},
   "prep_extension_min":{"deep":8,"standard_plus":4},
   "hold_seconds":{"deep":90,"standard":60,"light":30}}'),

('sensitivity_update_rules_v1',
 '{"cap":2.00,"floor":0.80,"default":1.00,
   "pain_report_delta":0.10,"skipped_then_pain_delta":0.15,
   "robust_decay_mult":0.95,"robust_window_days":90,"robust_load_frac":0.8,
   "pain_threshold":5,"pain_window_h":72,
   "recurrence_multiplier":1.25,"recurrence_min":2,"decay_half_scale_months":12}'),

-- ── Fueling (3-Tier) ─────────────────────────────────────────────────────────
('fueling_coefficients_v1',
 '{"rmr_base":500,"rmr_lean_coeff":0.022,
   "af":{"twice_daily":2.000,"days_ge_6":1.725,"default":1.550},
   "profiles":{
     "general":{"carb_coeff":0.0040,"protein_coeff":0.0018,"fat_floor_pct":0.20},
     "atp_pc":{"carb_coeff":0.0040,"protein_coeff":0.0018,"fat_floor_pct":0.20},
     "glycolytic_60":{"carb_coeff":0.0060,"protein_coeff":0.0018,"fat_floor_pct":0.20},
     "glycolytic_1_3h":{"carb_coeff":0.0080,"protein_coeff":0.0018,"fat_floor_pct":0.20},
     "glycolytic_4h":{"carb_coeff":0.0100,"protein_coeff":0.0018,"fat_floor_pct":0.20}},
   "carb_load":{"ramp_start":0.0110,"ramp_peak":0.0120},
   "creatine":{"load_coeff":0.0003,"maint_coeff":0.00003,"load_days":"5-7"},
   "grams_per_pound":453.59237}'),

('fueling_tier2_states_v1',
 '{"vol_anticipated":{"prime":1.0,"standard":1.0,"strain":0.8,"breach":0.5},
   "states":{
     "prime":{"protein_coeff":0.0018,"carb_mult":1.00,"fat_floor_pct":0.20},
     "standard":{"protein_coeff":0.0018,"carb_mult":1.00,"fat_floor_pct":0.20},
     "strain":{"protein_coeff":0.0022,"carb_mult":0.85,"fat_floor_pct":0.20},
     "breach":{"protein_coeff":0.0024,"carb_mult":0.70,"fat_floor_pct":0.25}},
   "hysteresis":{"restriction_persist_days":2,"recovery_instant":true},
   "breach_escalation_days":3,"timing":"checkin_day_plus_1"}'),

('fueling_tier3_modulation_v1',
 '{"fingerprint":{"lambda_fp":0.25,"heavy_mult":1.30,"confidence_gate":0.5,"min_obs":4,"cv_max":1},
   "carb_modulation":{"default":1.00,"refeed_eve":1.25,"heavy_predicted":1.15,"post_heavy":1.10,"taper":0.90},
   "carb_load_abs":{"t48_t24":0.0110,"t24_t0":0.0120,"competition":0.0120},
   "protein_by_phase":{"maintenance":0.0018,"accumulation":0.0020,"intensification":0.0022,"taper":0.0018,"post_heavy_adder":0.0002,"cap":0.0026},
   "predicted_volume_ratio":{"clamp_min":0.5,"clamp_max":1.5},
   "phase":{"intensification_acwr":1.30,"accumulation_acwr_low":1.00,"accumulation_acwr_high":1.30,"accumulation_slope_per_day":0.005,"taper_acwr":0.80,"taper_chronic_frac":0.8},
   "competition_window":{"taper_days":4,"signature_confidence":0.6,"declared_overrides":true},
   "timing_windows":{"pre_carb_pct":0.25,"pre_protein_pct":0.20,"peri_carb_pct":0.10,"peri_min_session_min":90,"post_carb_pct":0.30,"post_protein_pct":0.30,"base_min_feedings":3,"base_feeding_protein_coeff":0.0004},
   "reconciliation":{"miss_lambda_double":true,"self_correct_weeks":2}}'),

('fueling_safety_clamps_v1',
 '{"C1_energy_floor_rmr_mult":1.10,"C2_red_s_kcal_per_g_ffm":0.030,
   "C3_protein_coeff_min":0.0014,"C3_protein_coeff_max":0.0026,
   "C4_carb_coeff_min":0.0020,"C4_carb_coeff_max":0.0120,"C5_fat_floor_pct_min":0.20}'),

-- ── Cardio + Sovereign stitching ─────────────────────────────────────────────
('cardio_met_values_v1',
 '{"met":{"Zone 2":6.0,"Tempo":8.5,"HIIT":11.0},"gram_met_kcal":0.0000175,
   "k_sweat":{"Zone 2":0.00015,"Tempo":0.00022,"HIIT":0.00030},
   "heat_factor":{"default":1.0,"hot":1.3},"rehydration_mult":1.5}'),

('cardio_hr_model_v1',
 '{"tanaka_base":208,"tanaka_age_coeff":0.7,
   "cap_fraction":{"Zone 2":0.70,"Tempo":0.80,"HIIT":0.90},
   "mech_override":{"danger":0.70,"caution_max":0.80},
   "talk_test":{"Zone 2":"conversational pace — full sentences","Tempo":"phrases only","HIIT":"single words between reps"},
   "rpe_cap":{"Zone 2":5,"Tempo":7}}'),

('cardio_mech_ceiling_v1',
 '{"danger":{"acwr_axial":1.50,"acwr_impact":1.50,"debt_sum_mult":2.0,"monotony":2.0,"monotony_acwr":1.30},
   "caution":{"acwr_low":1.30,"acwr_high":1.50,"debt_ratio":1.40},
   "throttle":{
     "danger":{"tier_ceiling":"Zone 2","hr_frac":0.70,"rpe_cap":5,"work_rest":null,"structure":"steady-state only"},
     "caution":{"tier_ceiling":"Tempo","hr_frac":0.80,"rpe_cap":7,"work_rest":"1:2","structure":"long-rest intervals"}},
   "interference":{"tonnage_frac":0.6,"mean_rpe_zone2":8,"gap_advice":"6h"},
   "debt_scale":{"HIGH":0.70,"MODERATE":0.85,"LOW":1.00},
   "debt_class":{"HIGH":1.40,"MODERATE_low":0.90},
   "warmup_min":3,"cooldown_min":2,"duration_floor_min":10}'),

('cardio_matrix_v1',
 '{"HIIT":{"atp_pc":{"work_s":12,"rest_s":60,"work_rest":"1:5","reps_min":8,"reps_max":12,"met":11.0},
           "glycolytic":{"work_s":45,"rest_s_min":45,"rest_s_max":90,"work_rest":"1:1-1:2","reps_min":6,"reps_max":10,"met":11.0}},
   "Tempo":{"atp_pc":{"work_s":60,"rest_s":120,"work_rest":"1:2","blocks_min":5,"blocks_max":8,"met":8.5},
            "glycolytic":{"work_s":240,"rest_s":120,"work_rest":"2:1","blocks_min":3,"blocks_max":5,"met":8.5}},
   "Zone 2":{"both":{"structure":"continuous","work_rest":"steady-state","blocks":1,"met":6.0}}}'),

('sovereign_fragment_keys_v1',
 '{"S0":["S0_PRIME","S0_STANDARD","S0_STRAIN","S0_BREACH","S0_NEUTRAL"],
   "S1":["S1_AXIAL_SPIKE_ZONE2_FORCED","S1_AXIAL_SPIKE_TEMPO_CAPPED","S1_IMPACT_SPIKE_ZONE2_FORCED","S1_IMPACT_SPIKE_TEMPO_CAPPED","S1_SHADOW_48H_ZONE2_FORCED","S1_SHADOW_48H_TEMPO_CAPPED","S1_SYSTEMIC_DEBT_ZONE2_FORCED","S1_SYSTEMIC_DEBT_TEMPO_CAPPED","S1_MONOTONY_ZONE2_FORCED","S1_MONOTONY_TEMPO_CAPPED"],
   "S2":["S2_KNEE_MANDATORY","S2_KNEE_STRONG","S2_LOWER_BACK_MANDATORY","S2_LOWER_BACK_STRONG","S2_SHOULDER_MANDATORY","S2_SHOULDER_STRONG","S2_ELBOW_MANDATORY","S2_ELBOW_STRONG","S2_HAMSTRING_MANDATORY","S2_HAMSTRING_STRONG","S2_ANKLE_MANDATORY","S2_ANKLE_STRONG"],
   "S3":["S3_SHADOW_ACTIVE","S3_DEEP_DEBT_LOWER","S3_DEEP_DEBT_UPPER"],
   "S4":["S4_RECOVERY_FORCED","S4_REFEED_EVE","S4_CARB_LOAD","S4_POST_HEAVY","S4_TAPER"],
   "S5":["S5_ZONE2_SHORT","S5_ZONE2_MID","S5_ZONE2_LONG","S5_TEMPO_SHORT","S5_TEMPO_MID","S5_TEMPO_LONG","S5_HIIT_SHORT","S5_HIIT_MID","S5_HIIT_LONG"],
   "S6":["S6_HEAVY_DAY_SOON","S6_REFEED_TOMORROW","S6_CARB_WINDOW_OPEN"],
   "S7":["S7_PROTECTIVE","S7_STEADY","S7_CELEBRATORY"],
   "locales":["en","es","pt"],
   "beat_severity":{"mech_danger":90,"mandatory_prehab":85,"recovery_forced":80,"recovery_shadow":75,"refeed_carb_upcoming":60,"caution_vector":50,"clean_day":20},
   "rule_of_three":3,"duration_buckets":{"SHORT_max":20,"MID_max":35}}'),

('sovereign_stitch_timing_v1',
 '{"gap_ms":240,"gap_before_s7_ms":400,"lufs_integrated":-16,"peak_dbtp":-1.5,"edge_trim_ms_max":60,"preload":"all","scheduling":"sample_accurate","voice_id":"ZbKDEqxkr8Ub4psNm5XD"}'),

-- ── Language Mastery ─────────────────────────────────────────────────────────
('srs_weights_v1',
 '{"interval_days":{"1":0,"2":1,"3":3,"4":7,"5":14},
   "w_box":{"1":1.00,"2":0.60,"3":0.35,"4":0.20,"5":0.10},
   "staleness_min":1.0,"staleness_max":3.0,
   "session_size":12,"tranche_mandatory_max":3,"tranche_weighted_to":10,"tranche_new_to":12,
   "new_term_daily_cap":5,
   "boost_on_miss":0.15,"boost_major":0.50,"boost_minor":0.25,"boost_decay_mult":0.9,
   "stale_forward_days":14,"mastery_decay_days":45,"boost_decay_recent_days":7,
   "mode_by_box":{"1":"recognition","2":"recognition","3":"speed","4":"production","5":"production"}}'),

('lang_phase_gates_v1',
 '{"time_in_phase_min_days":7,
   "p1_to_2":{"terms_box3_min":60,"terms_box5_min":20,"pimsleur_done":3,"streak_min":10,"qualified_days_min":14},
   "p2_to_3":{"terms_box5_min":45,"box5_clearance_14d":0.70,"pimsleur_done":6,"immersion_sessions":3,"fluency_ewma":55},
   "p3_to_4":{"fluency_ewma":75,"sessions_min":8,"max_cluster_share":0.25,"pimsleur_done":10,"phrases_box4_min":40,"box5_clearance_14d":0.80},
   "p4_to_5":{"benchmark_items":["coaching_session_5min","gym_navigation_run","6_intentions_both_langs","bilingual_reel_posted"]},
   "insufficient_data_min_denominator":5,
   "scenario_tiers":{"tier1_phase_min":2,"tier2_ewma":65,"tier3_ewma":75},
   "fluency_lambda":0.30,"plateau_slope":0.3,"plateau_ewma":75,"plateau_min_sessions":4,
   "regression_slope":-1.0,"regression_min_sessions":4}'),

('lang_error_clusters_v1',
 '{"clusters":["ser_estar","gender_agreement","verb_conjugation","preposition","false_friend","word_order","vocab_gap","register","pronunciation"]}'),

('lang_voice_map_v1',
 '{"narrator":"en-US","pt_native_female":"pt-BR-female","pt_native_male":"pt-BR-male","es_native_pair":["es-MX","es-CO"],"coach_clone":"ZbKDEqxkr8Ub4psNm5XD","note":"language natives are deliberately different voices from the Akeem coach clone — the ear must learn natives"}'),

('lang_stitch_timing_v1',
 '{"anticipation_pause_s":4.0,"repeat_pause_s":3.0,"playback_rate_min":0.75,"playback_rate_max":1.0,"pauses_never_scaled":true,"lufs_integrated":-16,"edge_trim_ms_max":60,"completion_coverage":0.90,"drill_item_cap":15,"spaced_review_idle_days":10}'),

-- ── Onboarding ───────────────────────────────────────────────────────────────
('onboarding_backoff_v1',
 '{"backoff_minutes":[15,60,240,720,1440],"attempts_cap":5,"escalation_reason":"retry_exhausted","dispatch_sweep_cron_min":15,"heal_cron_min":10,"heal_attempts_max":3,"fuzzy_join_hours":72}'),

('cold_start_defaults_v1',
 '{"default":{"body_mass_g":81647,"body_fat_pct":18,"training_days_wk":4,"session_minutes":60,"dietary_profile":"Omnivore","sport_profile":"glycolytic","source":"default"},
   "by_tier":{
     "catalyst":{"body_mass_g":81647,"training_days_wk":3,"session_minutes":45},
     "momentum":{"body_mass_g":81647,"training_days_wk":4,"session_minutes":60},
     "autonomous":{"body_mass_g":81647,"training_days_wk":5,"session_minutes":75}},
   "nutrition_horizon_days":28,"flag":"source:default"}'),

-- ── Content Studio V4 ────────────────────────────────────────────────────────
('studio_ladder_v1',
 '{"high":{"w":1080,"h":1920,"bitrate_bps":8000000,"device_memory_min":6},
   "mid":{"w":1080,"h":1920,"bitrate_bps":6000000,"latency_mode":"quality","device_memory_min":3},
   "low":{"w":720,"h":1280,"bitrate_bps":3500000},
   "backpressure_queue_watermark":8,"heap_pause_frac":0.65,"heap_resume_frac":0.50,
   "teardown_gc_timeout_ms":300}'),

('studio_hashtag_sets_v1',
 '{"brand_base":["#BuildBelieveFit","#BBF","#SovereignPerformance"],
   "sport_tags":{"football":["#FootballTraining","#GridironStrong"],"soccer":["#SoccerFitness","#FutbolStrong"],"basketball":["#HoopsTraining"],"volleyball":["#VolleyballTraining"],"boxing":["#BoxingConditioning"],"mma":["#MMAStrength"],"general":["#AthleteDevelopment"]},
   "locale_tags":{"en":["#Fitness","#StrengthTraining"],"es":["#Entrenamiento","#Fuerza"],"pt":["#Treino","#Forca"]},
   "max_tags":8,
   "allowlist":["#BuildBelieveFit","#BBF","#SovereignPerformance","#FootballTraining","#GridironStrong","#SoccerFitness","#FutbolStrong","#HoopsTraining","#VolleyballTraining","#BoxingConditioning","#MMAStrength","#AthleteDevelopment","#Fitness","#StrengthTraining","#Entrenamiento","#Fuerza","#Treino","#Forca","#YouthAthlete","#InjuryPrevention","#Hypertrophy","#JointHealth"]}'),

('studio_safe_area_v1',
 '{"grid_inset_pct":0.06,"grid_zones":9,"ig_chrome_bottom_pct":0.18,"ig_chrome_right_pct":0.12,
   "contrast_probe_threshold":0.35,"auto_plate_opacity":0.45,"autofit_block_height_frac":0.30,
   "canvas_basis":{"w":1080,"h":1920}}'),

('studio_mixer_v1',
 '{"master_db":0,"vocal_db":0,"music_db":-12,"duck_db":-9,"ducking_enabled":true,
   "fade_in_s":0.5,"fade_out_s":1.5,"duck_attack_s":0.15,"duck_release_s":0.40,
   "db_range_min":-60,"db_range_max":6}')

on conflict (key) do nothing;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ D · STORAGE BUCKETS (coach-static house style)                             ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- D1 · sovereign-fragments (PUBLIC) — baked Sovereign brief clips, public-read CDN
insert into storage.buckets (id, name, public)
values ('sovereign-fragments', 'sovereign-fragments', true)
on conflict (id) do nothing;

drop policy if exists "sovereign_fragments_public_read" on storage.objects;
create policy "sovereign_fragments_public_read"
  on storage.objects for select
  using (bucket_id = 'sovereign-fragments');

drop policy if exists "sovereign_fragments_service_write" on storage.objects;
create policy "sovereign_fragments_service_write"
  on storage.objects for all
  to service_role
  using (bucket_id = 'sovereign-fragments')
  with check (bucket_id = 'sovereign-fragments');

-- D2 · language-fragments (PUBLIC) — baked Pimsleur/vocab/phrase clips, public-read CDN
insert into storage.buckets (id, name, public)
values ('language-fragments', 'language-fragments', true)
on conflict (id) do nothing;

drop policy if exists "language_fragments_public_read" on storage.objects;
create policy "language_fragments_public_read"
  on storage.objects for select
  using (bucket_id = 'language-fragments');

drop policy if exists "language_fragments_service_write" on storage.objects;
create policy "language_fragments_service_write"
  on storage.objects for all
  to service_role
  using (bucket_id = 'language-fragments')
  with check (bucket_id = 'language-fragments');

-- D3 · directed-v1 (PRIVATE) — Directed Play deliveries; reads via signed URLs only.
-- NOT public: no public_read policy. Service-role writes; the serving edge fn mints
-- a signed READ URL per view (§4.3 privacy boundary — an athlete's data is never
-- on a public object).
insert into storage.buckets (id, name, public)
values ('directed-v1', 'directed-v1', false)
on conflict (id) do nothing;

drop policy if exists "directed_v1_service_all" on storage.objects;
create policy "directed_v1_service_all"
  on storage.objects for all
  to service_role
  using (bucket_id = 'directed-v1')
  with check (bucket_id = 'directed-v1');
