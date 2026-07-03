-- ═══════════════════════════════════════════════════════════════════════════
-- BBF Lab P3.4 · Athlete Fitness & Cardio Command reads (PREHAB §2 · STITCHING §3)
-- ───────────────────────────────────────────────────────────────────────────
-- The two vault-token reads the athlete-facing Prehab matrix + Audio Brief player
-- need. The Phase 3.1 hub-hydration RPC returns only SUMMARIES (a prehab count, a
-- brief fragment_count) — insufficient for a standalone matrix (needs the flagged
-- joints) or a player (needs the full stitched playlist array). These fill that gap.
--
-- Both are vault-token gated via public._bbf_uid_from_vault_token() (the live gym /
-- biometric pattern). _bbf_uid_from_vault_token resolves bbf_users.id; prehab_queue
-- and sovereign_brief_playlists key on athlete_profiles.id, so each RPC resolves the
-- profile (earliest by created_at) exactly as bbf_hub_hydration does.
--
--   bbf_get_prehab_queue  — today's open queue, priority-ordered, top N (default 2).
--                           all_clear=true when nothing is flagged (degradation state).
--   bbf_get_brief_playlist — today's stitched morning-brief playlist (the full JSONB
--                            fragment array) in the athlete's locale. ZERO-API: this
--                            returns storage references only; no TTS is ever invoked.
--
-- Idempotent (CREATE OR REPLACE). No schema changes.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1 · bbf_get_prehab_queue — today's flagged joints (top N) ─────────────────
create or replace function public.bbf_get_prehab_queue(
  p_session_token text,
  p_limit         int default 2
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid     uuid;
  v_profile uuid;
  v_day     date := (now() at time zone 'utc')::date;
  v_lim     int  := least(greatest(coalesce(p_limit, 2), 1), 10);
  v_queue   jsonb;
  v_total   int;
begin
  v_uid := public._bbf_uid_from_vault_token(p_session_token);
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'invalid_session'); end if;

  select id into v_profile
    from public.athlete_profiles
   where user_id = v_uid
   order by created_at asc
   limit 1;

  -- No profile yet → a clean all-clear (degradation state), never an error.
  if v_profile is null then
    return jsonb_build_object('ok', true, 'queue', '[]'::jsonb, 'count', 0, 'all_clear', true);
  end if;

  -- Top N flagged joints, hardest-first (mandatory → strong → advisory, then risk).
  select coalesce(jsonb_agg(q.obj order by q.rank, q.risk desc, q.joint), '[]'::jsonb)
    into v_queue
    from (
      select jsonb_build_object(
               'joint_zone', joint_zone, 'priority', priority,
               'risk_score', risk_score, 'protocol', protocol
             ) as obj,
             (case priority when 'mandatory' then 0 when 'strong' then 1 else 2 end) as rank,
             coalesce(risk_score, 0) as risk, joint_zone as joint
        from public.prehab_queue
       where athlete_id = v_profile and scheduled_for = v_day and status in ('queued', 'served')
       order by (case priority when 'mandatory' then 0 when 'strong' then 1 else 2 end),
                coalesce(risk_score, 0) desc, joint_zone
       limit v_lim
    ) q;

  select count(*) into v_total
    from public.prehab_queue
   where athlete_id = v_profile and scheduled_for = v_day and status in ('queued', 'served');

  return jsonb_build_object('ok', true, 'queue', v_queue, 'count', v_total, 'all_clear', (v_total = 0));
end;
$function$;

-- ─── 2 · bbf_get_brief_playlist — today's stitched morning brief (full array) ──
create or replace function public.bbf_get_brief_playlist(
  p_session_token text,
  p_locale        text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid     uuid;
  v_profile uuid;
  v_pref    text;
  v_loc     text;
  v_day     date := (now() at time zone 'utc')::date;
  v_row     record;
begin
  v_uid := public._bbf_uid_from_vault_token(p_session_token);
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'invalid_session'); end if;

  select id, coalesce(nullif(preferred_language, ''), 'en')
    into v_profile, v_pref
    from public.athlete_profiles
   where user_id = v_uid
   order by created_at asc
   limit 1;

  if v_profile is null then
    return jsonb_build_object('ok', true, 'found', false, 'locale', 'en');
  end if;

  -- Locale: explicit request → athlete's preferred_language → en. Normalized to the
  -- three supported codes so it matches the stored fragment locale exactly.
  v_loc := lower(coalesce(nullif(p_locale, ''), v_pref, 'en'));
  v_loc := case
    when v_loc like 'es%' then 'es'
    when v_loc like 'pt%' or v_loc like '%bras%' or v_loc like '%braz%' or v_loc = 'br' then 'pt'
    else 'en'
  end;

  select tone, total_duration_ms, status, playlist, screen_facts
    into v_row
    from public.sovereign_brief_playlists
   where athlete_id = v_profile and day = v_day and locale = v_loc
   order by computed_at desc
   limit 1;

  if not found then
    return jsonb_build_object('ok', true, 'found', false, 'locale', v_loc);
  end if;

  return jsonb_build_object(
    'ok', true, 'found', true, 'locale', v_loc,
    'tone', v_row.tone, 'total_duration_ms', v_row.total_duration_ms, 'status', v_row.status,
    'playlist', v_row.playlist,           -- the full ordered fragment array (Zero-API refs)
    'screen_facts', v_row.screen_facts
  );
end;
$function$;

-- Vault-token gated internally; client roles may execute (like the gym reads).
grant execute on function public.bbf_get_prehab_queue(text, int)      to anon, authenticated, service_role;
grant execute on function public.bbf_get_brief_playlist(text, text)   to anon, authenticated, service_role;

comment on function public.bbf_get_prehab_queue(text, int) is
  'BBF Lab P3.4 · today''s prehab_queue for the vault session — top N flagged joints (default 2), priority-ordered, with all_clear for the degradation state. Vault-token gated.';
comment on function public.bbf_get_brief_playlist(text, text) is
  'BBF Lab P3.4 · today''s sovereign_brief_playlists row (full stitched fragment array) in the athlete''s locale. Zero-API: storage references only, no TTS. Vault-token gated.';
