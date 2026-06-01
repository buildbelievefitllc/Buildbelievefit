-- ═══════════════════════════════════════════════════════════════════════════
-- BBF SUPABASE — SMART CARDIO: COACH / ADMIN ASSIGNMENT WRITE PATH
-- ═══════════════════════════════════════════════════════════════════════════
-- Closes the Smart Cardio loop. Terminal 1 shipped the athlete-facing layer
-- (bbf_cardio_protocols + bbf_cardio_logs; read via bbf_get_cardio, athlete
-- log-write via bbf_log_cardio). The coach still could not ASSIGN a protocol.
-- This adds bbf_assign_cardio_protocol — the coach/admin write path that inserts
-- a Claude-generated protocol_detail payload for a specific target athlete.
--
-- AUTH MODEL (identical to every other vault RPC — NOT Supabase GoTrue):
--   • The caller is authorized purely by p_session_token resolved against
--     bbf_vault_sessions via the existing _bbf_uid_from_vault_token helper
--     (token match + expires_at > now() + user not soft-deleted). No
--     caller-supplied id is ever trusted for authorization.
--   • The resolved caller MUST hold a privileged role. NOTE: the directive
--     named 'coach'/'admin', but the live bbf_users.role domain is
--     {client, trainer} — 'trainer' IS the coach/staff role in this system.
--     We gate on ('trainer','coach','admin') so the path works TODAY and
--     survives a future role rename, while always EXCLUDING 'client' (the
--     athlete). [Discrepancy flagged to the War Room.]
--
-- RLS BYPASS (acknowledged & intentional): bbf_cardio_protocols is
-- force-RLS + enabled with ZERO policies, so no anon/authenticated/owner role
-- can write it directly. The ONLY sanctioned writer is a SECURITY DEFINER
-- function owned by `postgres` (rolbypassrls = true) — same gateway pattern as
-- the shipped bbf_log_cardio. The token + role check below is the complete
-- access-control boundary for this write.
-- ═══════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.bbf_assign_cardio_protocol(text, text, jsonb, boolean);
CREATE FUNCTION public.bbf_assign_cardio_protocol(
  p_session_token text,
  p_target_uid    text,
  p_protocol      jsonb,
  p_supersede     boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_coach_id    uuid;
  v_coach_role  text;
  v_target_id   uuid;
  v_zone        public.bbf_cardio_zone;
  v_dur         int;
  v_title       text;
  v_intensity   text;
  v_detail      text;
  v_protocol_id uuid;
  v_superseded  int := 0;
BEGIN
  -- 1. Authorize the CALLER from the bearer token (never a supplied id).
  v_coach_id := public._bbf_uid_from_vault_token(p_session_token);
  IF v_coach_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_session');
  END IF;

  -- 2. Caller must be coach/admin (trainer in the live role domain) — not a client.
  SELECT role INTO v_coach_role FROM public.bbf_users WHERE id = v_coach_id;
  IF v_coach_role IS NULL OR v_coach_role NOT IN ('trainer', 'coach', 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  -- 3. Resolve the TARGET athlete by their text uid.
  IF p_target_uid IS NULL OR length(trim(p_target_uid)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'target_required');
  END IF;
  SELECT id INTO v_target_id
    FROM public.bbf_users
   WHERE uid = p_target_uid AND deleted_at IS NULL
   LIMIT 1;
  IF v_target_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'target_not_found');
  END IF;

  -- 4. Validate the protocol payload (defense-in-depth alongside enum/NOT NULL).
  IF nullif(p_protocol->>'zone', '') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_zone');
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

  v_detail := nullif(p_protocol->>'protocol_detail', '');
  IF v_detail IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_protocol');
  END IF;

  v_title     := nullif(p_protocol->>'title', '');
  v_intensity := nullif(p_protocol->>'intensity', '');

  -- 5. Optionally supersede the athlete's prior ACTIVE protocol(s) in this zone
  --    so bbf_get_cardio (which returns ALL active) shows one current Rx per zone.
  IF p_supersede THEN
    UPDATE public.bbf_cardio_protocols
       SET is_active = false
     WHERE user_id = v_target_id AND zone = v_zone AND is_active = true;
    GET DIAGNOSTICS v_superseded = ROW_COUNT;
  END IF;

  -- 6. Insert the new active protocol for the target athlete.
  INSERT INTO public.bbf_cardio_protocols
    (user_id, zone, title, target_duration_min, intensity, protocol_detail, is_active, generated_at)
  VALUES
    (v_target_id, v_zone, v_title, v_dur, v_intensity, v_detail, true, now())
  RETURNING id INTO v_protocol_id;

  RETURN jsonb_build_object(
    'ok', true,
    'protocol_id', v_protocol_id,
    'target_uid', p_target_uid,
    'zone', v_zone,
    'superseded', v_superseded
  );
END;
$function$;

-- Exposure mirrors the other vault RPCs: callable with the anon key from the
-- coach UI; security is the in-function token + role gate, not EXECUTE scope.
REVOKE ALL ON FUNCTION public.bbf_assign_cardio_protocol(text, text, jsonb, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.bbf_assign_cardio_protocol(text, text, jsonb, boolean)
  TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.bbf_assign_cardio_protocol(text, text, jsonb, boolean) IS
  'Coach/admin Smart Cardio write path. Token-gated (bbf_vault_sessions) + role-gated (trainer/coach/admin); inserts a Claude-generated protocol for a target athlete (by uid) into bbf_cardio_protocols and supersedes the prior active same-zone Rx. SECURITY DEFINER is the sole writer (table is force-RLS, no policies).';
