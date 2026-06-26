-- FRONT 3.5.1 — surface the generation timestamp on the Sovereign Briefing tile.
-- Adds created_at to the bbf_get_sovereign_briefing read payload so the Vault Hub
-- tile can show "Freshly generated today at HH:MM". Purely additive (CREATE OR REPLACE).
create or replace function public.bbf_get_sovereign_briefing(p_session_token text, p_locale text default 'en')
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

  select audio_b64, mime, briefing_date, chars, created_at
    into v_row
    from public.bbf_sovereign_audio
   where user_id = v_user_id and locale = v_loc and briefing_date = current_date and status = 'ready'
   order by created_at desc
   limit 1;

  if not found then
    return jsonb_build_object('ok', true, 'found', false, 'locale', v_loc);
  end if;
  return jsonb_build_object('ok', true, 'found', true, 'locale', v_loc,
    'mime', coalesce(v_row.mime, 'audio/mpeg'), 'briefing_date', v_row.briefing_date,
    'chars', v_row.chars, 'created_at', v_row.created_at, 'audio_b64', v_row.audio_b64);
end;
$function$;

revoke all on function public.bbf_get_sovereign_briefing(text, text) from public;
grant execute on function public.bbf_get_sovereign_briefing(text, text) to anon, authenticated, service_role;
