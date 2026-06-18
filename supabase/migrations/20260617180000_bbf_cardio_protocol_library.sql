-- ═══════════════════════════════════════════════════════════════════════════
-- BBF SUPABASE — SMART CARDIO: machine PRESET LIBRARY + athlete self-serve pick
-- ═══════════════════════════════════════════════════════════════════════════
-- ADDITIVE. Plugs into the EXISTING cardio flow — does not rebuild it:
--   • bbf_cardio_protocol_library — a PUBLIC, read-only catalog of coach-prescribed
--     machine protocols (anon SELECT via RLS; only service_role/owner seed/curate).
--   • bbf_set_active_cardio_protocol — the athlete self-serve write the system was
--     missing. bbf_assign_cardio_protocol is COACH/ADMIN role-gated (client
--     forbidden), so an athlete could never set their own active Rx. This is the
--     self-targeted analog: token → caller's OWN uid (no target, NO role gate),
--     supersede the prior active same-zone Rx, insert the new active protocol.
--     SAME auth model + SECURITY DEFINER gateway as bbf_log_cardio — no new
--     ungated/public write surface, no service-role/admin secret in client JS.
-- The session→calorie→check-in plumbing (bbf_log_cardio → bbf_add_active_calories
-- → bbf_daily_biometrics) and the coach AI auto-gen (bbf-agentic-cardio) are
-- UNTOUCHED. Idempotent (IF NOT EXISTS / ON CONFLICT / CREATE OR REPLACE).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. The preset library table ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bbf_cardio_protocol_library (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine             text NOT NULL,
  title               text NOT NULL,
  zone                public.bbf_cardio_zone NOT NULL,
  target_duration_min integer NOT NULL CHECK (target_duration_min > 0 AND target_duration_min <= 600),
  intensity           text,
  protocol_detail     text,
  sort                integer NOT NULL DEFAULT 0,
  active              boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_cardio_library_machine_title UNIQUE (machine, title)
);

CREATE INDEX IF NOT EXISTS idx_cardio_library_machine_sort
  ON public.bbf_cardio_protocol_library (machine, sort);

-- ─── 2. RLS: public read-only (anon SELECT active rows); writes service/admin ──
-- ENABLE (not FORCE) RLS + a SELECT policy → anon/authenticated may READ active
-- presets directly; no write policy means anon/authenticated cannot write, while
-- service_role / the owner (migration seeder) bypass RLS to curate.
ALTER TABLE public.bbf_cardio_protocol_library ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bbf_cardio_library_read ON public.bbf_cardio_protocol_library;
CREATE POLICY bbf_cardio_library_read ON public.bbf_cardio_protocol_library
  FOR SELECT TO anon, authenticated USING (active = true);
GRANT SELECT ON public.bbf_cardio_protocol_library TO anon, authenticated;

-- ─── 3. Seed — 6 machines × 4 coach-prescribed BBF protocols (zones → real enum) ─
-- Branded personality lives in the TITLE (Coach Akeem's voice); the actual workout
-- specs live in protocol_detail. Zone bands map to the 3-zone enum: easy aerobic →
-- zone2, sustained/threshold → tempo, hard intervals → hiit.
INSERT INTO public.bbf_cardio_protocol_library (machine, title, zone, target_duration_min, intensity, protocol_detail, sort) VALUES
  -- TREADMILL
  ('Treadmill', 'BBF Base Engine', 'zone2', 25, 'Zone 2 · Aerobic Base', '25 min steady at 3–4 mph, incline 4–8%. Hold a conversational, nose-breathing pace — this is your aerobic engine block.', 1),
  ('Treadmill', 'Akeem''s Afterburner', 'hiit', 22, 'HIIT · Max Effort', '8 rounds: 30s hard push / 90s walk recovery. Earn the afterburn — the last two rounds are where the work counts.', 2),
  ('Treadmill', 'The Tempo Mile Repeats', 'tempo', 28, 'Tempo · Threshold', '4 × 5 min at comfortably-hard threshold pace, 2 min easy jog between. Lock the breathing and hold the line.', 3),
  ('Treadmill', 'BBF Hill Forge', 'zone2', 30, 'Zone 2 · Incline', '30 min steady walk at incline 6–10%, 3.0–3.3 mph. Low impact, high return — forge the posterior chain.', 4),
  -- STAIRMASTER
  ('Stairmaster', 'The Sovereign Ascent', 'tempo', 20, 'Tempo · Steady Climb', '20 min continuous at level 6–8. Tall posture, no rail-hang — own every step of the climb.', 1),
  ('Stairmaster', 'BBF Summit Intervals', 'hiit', 24, 'HIIT · Vertical', '12 rounds: 60s fast climb / 60s easy. Drive the knees and summit the final set without slowing.', 2),
  ('Stairmaster', 'Akeem''s Steady Climb', 'zone2', 35, 'Zone 2 · Aerobic', '35 min conversational at level 4–5. Pure aerobic base — you should be able to talk the whole way up.', 3),
  ('Stairmaster', 'The Stairwell Ladder', 'tempo', 26, 'Tempo · Pyramid', 'Climb the ladder: 4 min each at levels 4 → 6 → 8 → 6 → 4. Build to the peak, then control the descent.', 4),
  -- ROWER
  ('Rower', 'Akeem''s Long Pull', 'zone2', 20, 'Zone 2 · Aerobic Pull', '20 min steady at 22–24 strokes/min. Long, patient drive — legs, then hips, then arms. Base miles on the erg.', 1),
  ('Rower', 'BBF Power Stroke', 'hiit', 25, 'HIIT · Power', '6 × 500m hard with 1:1 work-to-rest. Bring the split down and hold it — the power lives in the legs.', 2),
  ('Rower', 'The Threshold 5K', 'tempo', 24, 'Tempo · 5K', '5000m continuous at a comfortably-hard split you can sustain. Negative-split the back half if you have it.', 3),
  ('Rower', 'BBF Pyramid Pull', 'tempo', 22, 'Tempo · Pyramid', '250 / 500 / 750 / 500 / 250m with equal rest. Climb the pyramid and hold form as the meters stack up.', 4),
  -- ASSAULT BIKE
  ('Assault Bike', 'The Equalizer', 'hiit', 10, 'HIIT · Max Effort', '10 rounds: 30s all-out / 30s easy spin. It humbles everyone equally — match your first-round output to the last.', 1),
  ('Assault Bike', 'BBF Redline Ladder', 'hiit', 12, 'HIIT · Calorie Ladder', '5 → 10 → 15 calories with full recovery between rungs. Sprint each rung; rest until the breathing settles.', 2),
  ('Assault Bike', 'Akeem''s Aerobic Spin', 'zone2', 25, 'Zone 2 · Aerobic', '25 min steady at conversational watts. Keep the fan humming at an even pace — base miles on the bike.', 3),
  ('Assault Bike', 'The Tempo Grind', 'tempo', 18, 'Tempo · Threshold', '4 rounds: 3 min on at a hard-but-holdable effort / 1 min easy. Grind the gears and keep the cadence smooth.', 4),
  -- ELLIPTICAL
  ('Elliptical', 'BBF Glide Base', 'zone2', 30, 'Zone 2 · Aerobic Base', '30 min steady at resistance 8–10. Smooth glide, even breathing — joint-friendly aerobic base.', 1),
  ('Elliptical', 'Akeem''s Surge Protocol', 'tempo', 24, 'Tempo · Surge', '8 rounds: 90s surge / 90s easy glide. Push the resistance on the surge and recover fully on the glide.', 2),
  ('Elliptical', 'The Cross-Trainer Climb', 'tempo', 28, 'Tempo · Steady', '28 min with incline and resistance held steady. Engage the arms and keep a strong, even threshold rhythm.', 3),
  ('Elliptical', 'BBF Sprint Glides', 'hiit', 20, 'HIIT · Sprint', '15 rounds: 20s sprint / 40s easy. Spin the stride rate up on every sprint; let the glide reset you.', 4),
  -- STATIONARY BIKE
  ('Stationary Bike', 'The Tempo Lock', 'tempo', 25, 'Tempo · Cadence Lock', '25 min at 80–90 rpm, moderate resistance. Lock the cadence and hold it — steady threshold in the saddle.', 1),
  ('Stationary Bike', 'BBF Cadence Pyramid', 'tempo', 22, 'Tempo · Pyramid', 'Blocks of 4 min climbing 70 → 80 → 90 → 100 rpm, then back down. Smooth transitions, no bouncing.', 2),
  ('Stationary Bike', 'Akeem''s Endurance Spin', 'zone2', 40, 'Zone 2 · Endurance', '40 min steady and conversational. Settle into the saddle and bank the aerobic miles — long and easy.', 3),
  ('Stationary Bike', 'The Sprint Intervals', 'hiit', 20, 'HIIT · Sprint', '15 rounds: 15s seated sprint / 45s easy. Crank the resistance for the sprint; spin light to recover.', 4)
ON CONFLICT (machine, title) DO NOTHING;

-- ─── 4. Athlete self-serve "set my active protocol" (the missing write path) ───
-- Self-targeted analog of bbf_assign_cardio_protocol: token → CALLER's own uid, NO
-- role gate (an athlete sets their OWN Rx), supersede prior active same-zone, insert.
-- SECURITY DEFINER is the sole writer (bbf_cardio_protocols is force-RLS). Same
-- token gate as bbf_log_cardio — own rows only; no admin secret reaches the client.
CREATE OR REPLACE FUNCTION public.bbf_set_active_cardio_protocol(p_session_token text, p_protocol jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id     uuid;
  v_zone        public.bbf_cardio_zone;
  v_dur         int;
  v_title       text;
  v_intensity   text;
  v_detail      text;
  v_protocol_id uuid;
  v_superseded  int := 0;
BEGIN
  v_user_id := public._bbf_uid_from_vault_token(p_session_token);
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_session');
  END IF;

  BEGIN
    v_zone := (p_protocol->>'zone')::public.bbf_cardio_zone;
  EXCEPTION WHEN others THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_zone');
  END;

  v_dur := nullif(p_protocol->>'target_duration_min', '')::int;
  IF v_dur IS NULL OR v_dur <= 0 OR v_dur > 600 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_duration');
  END IF;

  v_title     := nullif(p_protocol->>'title', '');
  v_intensity := nullif(p_protocol->>'intensity', '');
  v_detail    := nullif(p_protocol->>'protocol_detail', '');

  -- One current Rx per zone: supersede the athlete's prior active same-zone protocol(s).
  UPDATE public.bbf_cardio_protocols
     SET is_active = false
   WHERE user_id = v_user_id AND zone = v_zone AND is_active = true;
  GET DIAGNOSTICS v_superseded = ROW_COUNT;

  INSERT INTO public.bbf_cardio_protocols
    (user_id, zone, title, target_duration_min, intensity, protocol_detail, is_active, generated_at)
  VALUES
    (v_user_id, v_zone, v_title, v_dur, v_intensity, v_detail, true, now())
  RETURNING id INTO v_protocol_id;

  RETURN jsonb_build_object('ok', true, 'protocol_id', v_protocol_id, 'zone', v_zone, 'superseded', v_superseded);
END;
$function$;

REVOKE ALL ON FUNCTION public.bbf_set_active_cardio_protocol(text, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.bbf_set_active_cardio_protocol(text, jsonb) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.bbf_set_active_cardio_protocol(text, jsonb) IS
  'Athlete self-serve Smart Cardio write: token-gated (bbf_vault_sessions) to the caller''s OWN uid, no role gate; supersedes the prior active same-zone Rx and inserts the picked preset as the active protocol. Self-targeted analog of bbf_assign_cardio_protocol (which is coach/admin-only).';
