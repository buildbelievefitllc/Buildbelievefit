-- ============================================================================
-- 20260724120000_bbf_founder_active_client_seed.sql
-- ----------------------------------------------------------------------------
-- Provision the founder (Akeem Brown · uid='akeem') as an ACTIVE, on-track client
-- profile in the Client Database Hub / "Founder Five" roster.
--
-- WHY: the CEO account is role='trainer' (admin PIN login `bbf_verify_admin_pin`,
-- React `AuthContext.isAdmin`, `bbf_is_admin()` and the edge admin-gate all key on
-- that role). We DELIBERATELY DO NOT change his role here — that would lock the
-- founder out of the Command Center. Instead the roster surfaces (telemetry RPC +
-- bbf-admin-roster edge fn) get a `uid='akeem'` exception, and this migration seeds
-- a full week of green metrics so the flight-risk / adherence calculators read
-- GREEN ("On Track"), never red ("Flight Risk").
--
-- Scoring target (public.bbf_admin_roster_telemetry, 7-day window):
--   workout_adh = completed_days / assigned_days  → 1.0  (>=5 logged of 5 assigned)
--   macro_adh   = mean(kcal_pct)/100              → ~0.97 (7 days of nutrition sync)
--   score       = round((0.6*workout + 0.4*macro)*100) ≈ 99  → status 'green'
--   days_since_log < 3  (fresh log today)         → not the silent-≥3-days red rule
--   last_logged_at fresh → clears the 48-Hour Accountability ⚡NUDGE
--
-- Idempotent: every seeded row carries a marker and is re-created on re-run.
-- Applied via `apply_migration` per DATABASE_SAFETY.md RULE 2 (never `db push`).
-- ============================================================================

do $$
declare
  v_uid  uuid := '0a58aa6c-8a49-4068-a384-0f82afc3099c';   -- bbf_users.id  (uid='akeem')
  v_apid uuid := 'ac3e0abb-ddec-4711-9afc-a50884545051';   -- athlete_profiles.id for akeem
  -- 5-day clinical hypertrophy split. Approved lifts only — NO barbell back squat,
  -- NO crunch (BBF blacklist mirrored by bbf-admin-roster / the gen-guard).
  v_plan text := $plan$[
    {"day":"Day 1","focus":"Lower — Posterior Chain","exercises":[
      {"name":"Hip Thrusts","equipment":"Barbell or Machine","sets":4,"reps":"10","notes":"2-second hold at top"},
      {"name":"Romanian Deadlifts","equipment":"Barbell","sets":4,"reps":"10","notes":"Feel the hamstring stretch"},
      {"name":"Bulgarian Split Squats","equipment":"Dumbbells","sets":3,"reps":"12","notes":"Chest tall, controlled"},
      {"name":"Hip Abductions","equipment":"Machine","sets":3,"reps":"15","notes":"Controlled tempo"},
      {"name":"Back Extensions","equipment":"Machine","sets":3,"reps":"12","notes":"Glute focus"}]},
    {"day":"Day 2","focus":"Push — Chest/Shoulders/Triceps","exercises":[
      {"name":"Chest Press","equipment":"Bench or Dumbbell","sets":4,"reps":"10","notes":"Elbows at 45 degrees"},
      {"name":"Incline Press","equipment":"Dumbbells","sets":4,"reps":"10","notes":"Upper chest focus"},
      {"name":"Overhead Press","equipment":"Dumbbells","sets":3,"reps":"10","notes":"Brace the core"},
      {"name":"Lateral Raises","equipment":"Dumbbells","sets":3,"reps":"15","notes":"Lead with elbows"},
      {"name":"Triceps Pushdowns","equipment":"Cable","sets":3,"reps":"12","notes":"Pin the elbows"}]},
    {"day":"Day 3","focus":"Pull — Back/Biceps","exercises":[
      {"name":"Lat Pulldown","equipment":"Cable","sets":4,"reps":"12","notes":"Drive elbows down"},
      {"name":"Seated Row","equipment":"Cable","sets":4,"reps":"10","notes":"Squeeze the mid-back"},
      {"name":"Face Pulls","equipment":"Cable","sets":3,"reps":"15","notes":"Rear-delt health"},
      {"name":"Hammer Curls","equipment":"Dumbbells","sets":3,"reps":"12","notes":"No swinging"},
      {"name":"Rear Delt Fly","equipment":"Machine","sets":3,"reps":"15","notes":"Controlled tempo"}]},
    {"day":"Day 4","focus":"Lower — Quad Dominant","exercises":[
      {"name":"Front Squat","equipment":"Barbell","sets":4,"reps":"8","notes":"Approved squat pattern"},
      {"name":"Hack Squat","equipment":"Machine","sets":3,"reps":"12","notes":"Full depth, controlled"},
      {"name":"Walking Lunges","equipment":"Dumbbells","sets":3,"reps":"12","notes":"Even stride"},
      {"name":"Leg Extensions","equipment":"Machine","sets":3,"reps":"15","notes":"Pause at the top"},
      {"name":"Standing Calf Raises","equipment":"Machine","sets":4,"reps":"15","notes":"Full stretch"}]},
    {"day":"Day 5","focus":"Full Body — Strength/Conditioning","exercises":[
      {"name":"Trap Bar Deadlift","equipment":"Trap Bar","sets":4,"reps":"8","notes":"Neutral spine"},
      {"name":"Incline Treadmill Walk","equipment":"Treadmill","sets":1,"reps":"25 min","notes":"3 mph, Level 6 incline"},
      {"name":"Cable Woodchops","equipment":"Cable","sets":3,"reps":"12","notes":"Rotate through the trunk"},
      {"name":"Kettlebell Swings","equipment":"Kettlebell","sets":3,"reps":"15","notes":"Hip snap, not a squat"},
      {"name":"Plank","equipment":"Bodyweight","sets":3,"reps":"45 sec","notes":"Brace, no sag"}]}
  ]$plan$;
  d       date;
  v_log   uuid;
  i       int;
  j       int;
begin
  -- 0) Profile configuration — role STAYS 'trainer' (admin auth untouched).
  update public.bbf_users set
    workout_plan              = v_plan,
    tdee_target               = 2600,
    macro_p                   = 200,
    macro_c                   = 250,
    macro_f                   = 80,
    baseline_status           = 'valid',          -- enough data to drive decisions
    block_priority            = 'maintenance',
    access_status             = 'unlocked',
    current_streak            = greatest(coalesce(current_streak, 0), 6),
    nutrition_plan_updated_at = now(),
    plans_generated_at        = now(),
    updated_at                = now()
  where id = v_uid;

  -- 1) Fresh workout logs (today + yesterday) so days_since_log = 0 and the 7-day
  --    completed count clears the assigned plan. Marker: coach_notes='founder_active_seed'.
  delete from public.bbf_sets
   where log_id in (select id from public.bbf_logs
                     where user_id = v_uid and coach_notes = 'founder_active_seed');
  delete from public.bbf_logs
   where user_id = v_uid and coach_notes = 'founder_active_seed';

  foreach d in array array[current_date, current_date - 1] loop
    insert into public.bbf_logs (user_id, date, sport, drill_name, coach_notes, language, duration)
      values (v_uid, d, 'strength', 'Sovereign Hypertrophy', 'founder_active_seed', 'en', '58 min')
      returning id into v_log;
    for j in 1..16 loop
      -- load_g is a GENERATED column (computed from weight/reps) — never insert it.
      insert into public.bbf_sets
        (log_id, user_id, set_number, reps, weight_lbs, rpe, exercise_key, day_key)
      values
        (v_log, v_uid, j, 12, 135 + (j % 4) * 15, 7,
         'seed_ex_' || ((j % 5) + 1), to_char(d, 'YYYY-MM-DD'));
    end loop;
  end loop;

  -- 2) Readiness check-ins — last 7 days, strong CNS. Marker: source='founder_seed'.
  delete from public.bbf_readiness where user_id = v_uid and source = 'founder_seed';
  for i in 0..6 loop
    insert into public.bbf_readiness
      (user_id, score, sleep_quality, soreness_level, "timestamp", source, reading_date)
    values
      (v_uid, 84 + (i % 5), 8 + (i % 2), 2 + (i % 2),
       now() - make_interval(days => i), 'founder_seed', current_date - i);
  end loop;

  -- 3) Nutrition daily sync — last 7 days, high macro adherence (kcal_pct ~96-100).
  --    Keyed on athlete_profiles.id. Table is empty today; window-scoped cleanup.
  delete from public.nutrition_daily_sync
   where athlete_id = v_apid and day >= current_date - 6;
  for i in 0..6 loop
    insert into public.nutrition_daily_sync
      (athlete_id, day, target_kcal, consumed_kcal, kcal_pct,
       target_protein_g, consumed_protein_g, protein_pct,
       target_carbs_g, consumed_carbs_g, target_fat_g, consumed_fat_g,
       meals_logged, synced_at, updated_at)
    values
      (v_apid, current_date - i, 2600, 2500 + (i % 3) * 35,
       least(100, round((2500 + (i % 3) * 35)::numeric / 2600 * 100))::int,
       200, 190 + (i % 3) * 5,
       least(100, round((190 + (i % 3) * 5)::numeric / 200 * 100))::int,
       250, 238 + (i % 2) * 8, 80, 78,
       4, now(), now());
  end loop;

  -- 4) Athlete load logs — ~4 weeks of steady sRPE so ACWR sits in the healthy band
  --    (~1.0) and last_logged_at is fresh (clears the 48-Hour ⚡NUDGE). Every other
  --    day = a realistic training cadence. Marker: session_type='founder_seed'.
  delete from public.bbf_athlete_load_logs
   where athlete_id = v_uid and session_type = 'founder_seed';
  for i in 0..27 loop
    if i % 2 = 0 then
      -- load_au is a GENERATED column (duration_minutes * srpe_intensity) — omit it.
      insert into public.bbf_athlete_load_logs
        (athlete_id, session_timestamp, session_type, duration_minutes, srpe_intensity)
      values
        (v_uid, now() - make_interval(days => i), 'founder_seed', 55, 6);
    end if;
  end loop;
end $$;
