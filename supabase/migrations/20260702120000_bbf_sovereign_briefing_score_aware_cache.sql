-- FRONT 3.5.2 — score-aware Sovereign Briefing cache.
-- ─────────────────────────────────────────────────────────────────────────────
-- BUG: bbf_sovereign_audio is keyed (user_id, briefing_date, locale) — NO score
-- component. Whichever check-in fires FIRST in a UTC day permanently caches the
-- narrative (with whatever readiness score existed at that instant); a LATER
-- check-in that recomputes the score updates the on-screen dial live but the
-- cached spoken narrative never regenerates until the date rolls. The short
-- "Your readiness is N out of 100" clip (bbf-readiness-score-voice) IS correctly
-- keyed by (locale, score) and stays live — which is exactly why an athlete can
-- now hear an accurate "88" immediately followed by a stale narrative still
-- built around "80" from an earlier sync.
--
-- FIX: tag each cached row with the readiness_score it was generated from. The
-- read RPC accepts the caller's CURRENT known score and reports found=false when
-- it disagrees with the cached row's score — the frontend's existing on-demand
-- generation fallback (fetchSovereignBriefing) then kicks in exactly as it
-- already does for a true cache miss. No new state machine, no new UI: a stale
-- cache now just looks like "not generated yet."
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.bbf_sovereign_audio
  add column if not exists readiness_score integer;

comment on column public.bbf_sovereign_audio.readiness_score is
  'The readiness_score (0-100) the cached narrative was generated from. NULL for rows written before this column existed — those are trusted as-is (never force-missed on an unknown score) and age out via the existing 7-day prune.';

create or replace function public.bbf_get_sovereign_briefing(
  p_session_token text,
  p_locale text default 'en',
  p_current_score integer default null
)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_user_id uuid;
  v_loc     text;
  v_row     record;
begin
  v_user_id := public._bbf_uid_from_vault_token(p_session_token);
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_session');
  end if;
  v_loc := lower(coalesce(nullif(p_locale, ''), 'en'));
  v_loc := case
    when v_loc like 'es%' then 'es'
    when v_loc like 'pt%' or v_loc like '%bras%' or v_loc like '%braz%' or v_loc = 'br' then 'pt'
    else 'en'
  end;

  select audio_b64, mime, briefing_date, chars, created_at, readiness_score
    into v_row
    from public.bbf_sovereign_audio
   where user_id = v_user_id and locale = v_loc and briefing_date = current_date and status = 'ready'
   order by created_at desc
   limit 1;

  if not found then
    return jsonb_build_object('ok', true, 'found', false, 'locale', v_loc);
  end if;

  -- STALE CACHE GUARD: a known current score that disagrees with what this
  -- narrative was generated from is reported as a miss — the caller's existing
  -- on-demand generation path regenerates fresh instead of playing a mismatched
  -- number. A NULL on either side (unknown current score, or a pre-column row)
  -- is trusted rather than force-missed.
  if p_current_score is not null and v_row.readiness_score is not null
     and p_current_score is distinct from v_row.readiness_score then
    return jsonb_build_object('ok', true, 'found', false, 'locale', v_loc, 'stale', true);
  end if;

  return jsonb_build_object('ok', true, 'found', true, 'locale', v_loc,
    'mime', coalesce(v_row.mime, 'audio/mpeg'), 'briefing_date', v_row.briefing_date,
    'chars', v_row.chars, 'created_at', v_row.created_at, 'audio_b64', v_row.audio_b64);
end;
$function$;

revoke all on function public.bbf_get_sovereign_briefing(text, text, integer) from public;
grant execute on function public.bbf_get_sovereign_briefing(text, text, integer) to anon, authenticated, service_role;

-- The old 2-arg overload becomes obsolete now that the frontend always calls the
-- 3-arg form — drop it so there is exactly one signature to reason about (the
-- default on p_current_score already covers any other caller).
drop function if exists public.bbf_get_sovereign_briefing(text, text);
