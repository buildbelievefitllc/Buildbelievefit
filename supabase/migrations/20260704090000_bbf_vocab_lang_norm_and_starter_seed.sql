-- ═══════════════════════════════════════════════════════════════════════════
-- BBF Lab · Vocab Gym — language normalization + starter-deck seed (PT queue fix)
-- ───────────────────────────────────────────────────────────────────────────
-- TWO ROOT DEFECTS behind "Portuguese queue is empty":
--
-- 1. NORMALIZATION: the gym RPCs mapped any p_language outside ('es','pt') —
--    including 'pt-BR', 'PT-BR', 'pt_BR', 'Português' — silently to SPANISH.
--    A regional-code caller read (and wrote reviews into!) the wrong language.
--    → public._bbf_norm_taught_lang() normalizes every Portuguese identifier to
--    'pt' and everything else to 'es', in all three RPCs.
--
-- 2. NO SEED PATH: bbf_vocab_mastery rows are only created by immersion errors /
--    linguist flags, so a language with no sessions yet has a permanently empty
--    queue — the nightly language-sentinel has nothing to process and the gym is
--    a dead surface. → §0.3 "No Empty Dashboards" applied to the SRS: on the
--    first read of a language with ZERO rows, bbf_get_vocab_queue seeds a
--    config-backed gym-floor starter deck (bbf_app_config.vocab_starter_deck_v1)
--    at Box 1, due now, source 'seed' (the schema's existing source taxonomy). Idempotent (count=0 guard +
--    ON CONFLICT DO NOTHING); real immersion data simply accretes on top and the
--    sentinel now has rows to age/boost.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 0 · canonical taught-language normalizer ─────────────────────────────────
create or replace function public._bbf_norm_taught_lang(p_language text)
returns text
language sql
immutable
as $$
  select case
    when lower(trim(coalesce(p_language, ''))) ~ '^(pt([-_].*)?|port.*|br|.*brasil.*|.*brazil.*)$' then 'pt'
    else 'es'
  end;
$$;

-- ─── 1 · starter deck (gym-floor imperatives + core lifting vocabulary) ────────
insert into public.bbf_app_config (key, value)
values (
  'vocab_starter_deck_v1',
  '{'
    '"es":["sentadilla","peso muerto","press de banca","remada","flexión","plancha","calentamiento","descanso","serie","repeticiones","carga","activa el core","abre las rodillas","respira profundo"],'
    '"pt":["agachamento","levantamento terra","supino","remada","flexão","prancha","aquecimento","descanso","série","repetições","carga","trave o core","abre os joelhos","respire fundo"]'
  '}'
)
on conflict (key) do nothing;

-- ─── 2 · bbf_get_vocab_queue — normalized + self-seeding ──────────────────────
create or replace function public.bbf_get_vocab_queue(
  p_session_token text,
  p_language      text default 'es',
  p_limit         int  default 20
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid   uuid;
  v_lang  text := public._bbf_norm_taught_lang(p_language);
  v_lim   int  := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_queue jsonb;
  v_due   int;
  v_total int;
begin
  v_uid := public._bbf_uid_from_vault_token(p_session_token);
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'invalid_session'); end if;

  -- COLD-START SEED (§0.3 applied to the SRS): a language the athlete has never
  -- touched gets the config-backed starter deck so the gym is never a dead surface
  -- and the nightly sentinel has rows to process. Fires once per (athlete, lang).
  if not exists (select 1 from public.bbf_vocab_mastery where athlete_id = v_uid and language = v_lang) then
    insert into public.bbf_vocab_mastery (athlete_id, language, term, box_level, source, due_at, last_reviewed)
    select v_uid, v_lang, t, 1, 'seed', now(), now()
      from jsonb_array_elements_text(
             coalesce((select value::jsonb -> v_lang from public.bbf_app_config where key = 'vocab_starter_deck_v1'), '[]'::jsonb)
           ) as t
    on conflict do nothing;
  end if;

  -- The due set (due_at ≤ now, or never scheduled), ranked hardest-first: lowest
  -- Leitner box, then the biggest priority_boost (immersion/flag escalations), then
  -- the longest-overdue. This is the exact shape idx_vocab_mastery_due serves.
  select coalesce(jsonb_agg(q order by q.box_level asc, q.priority_boost desc, q.due_at asc nulls first, q.last_reviewed asc), '[]'::jsonb)
    into v_queue
    from (
      select jsonb_build_object(
               'term',          term,
               'box_level',     box_level,
               'source',        source,
               'error_cluster', error_cluster,
               'priority_boost', priority_boost,
               'correct',       correct,
               'attempts',      attempts,
               'last_reviewed', last_reviewed,
               'due_at',        due_at
             ) as q,
             box_level, priority_boost, due_at, last_reviewed
        from public.bbf_vocab_mastery
       where athlete_id = v_uid
         and language = v_lang
         and (due_at is null or due_at <= now())
       limit v_lim
    ) q;

  select count(*) filter (where due_at is null or due_at <= now()), count(*)
    into v_due, v_total
    from public.bbf_vocab_mastery
   where athlete_id = v_uid and language = v_lang;

  return jsonb_build_object('ok', true, 'language', v_lang, 'queue', v_queue, 'due_count', v_due, 'total', v_total);
end;
$function$;

-- ─── 3 · bbf_review_vocab_term — normalized (body otherwise identical) ─────────
create or replace function public.bbf_review_vocab_term(
  p_session_token text,
  p_language      text,
  p_term          text,
  p_correct       boolean
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid   uuid;
  v_lang  text := public._bbf_norm_taught_lang(p_language);
  v_term  text := trim(coalesce(p_term, ''));
  v_box   int;
  v_due   timestamptz;
begin
  v_uid := public._bbf_uid_from_vault_token(p_session_token);
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'invalid_session'); end if;
  if length(v_term) = 0 then return jsonb_build_object('ok', false, 'error', 'missing_term'); end if;

  insert into public.bbf_vocab_mastery
    (athlete_id, language, term, box_level, correct, attempts, lapses, last_reviewed, due_at)
  values (
    v_uid, v_lang, v_term,
    case when p_correct then 2 else 1 end,
    case when p_correct then 1 else 0 end,
    1,
    case when p_correct then 0 else 1 end,
    now(),
    now() + (case when p_correct then 1 else 0 end || ' days')::interval
  )
  on conflict (athlete_id, language, term) do update set
    box_level     = case when p_correct then least(5, public.bbf_vocab_mastery.box_level + 1) else 1 end,
    correct       = public.bbf_vocab_mastery.correct + case when p_correct then 1 else 0 end,
    attempts      = public.bbf_vocab_mastery.attempts + 1,
    lapses        = public.bbf_vocab_mastery.lapses + case when p_correct then 0 else 1 end,
    last_reviewed = now(),
    due_at        = now() + (
      case
        when not p_correct then 0
        when least(5, public.bbf_vocab_mastery.box_level + 1) = 2 then 1
        when least(5, public.bbf_vocab_mastery.box_level + 1) = 3 then 3
        when least(5, public.bbf_vocab_mastery.box_level + 1) = 4 then 7
        else 14
      end || ' days')::interval
  returning box_level, due_at into v_box, v_due;

  return jsonb_build_object('ok', true, 'term', v_term, 'language', v_lang, 'box_level', v_box, 'due_at', v_due);
end;
$function$;

-- ─── 4 · bbf_flag_vocab_term — normalized (body otherwise identical) ───────────
create or replace function public.bbf_flag_vocab_term(
  p_session_token text,
  p_language      text,
  p_term          text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid   uuid;
  v_lang  text := public._bbf_norm_taught_lang(p_language);
  v_term  text := trim(coalesce(p_term, ''));
  v_box   int;
begin
  v_uid := public._bbf_uid_from_vault_token(p_session_token);
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'invalid_session'); end if;
  if length(v_term) = 0 then return jsonb_build_object('ok', false, 'error', 'missing_term'); end if;

  insert into public.bbf_vocab_mastery
    (athlete_id, language, term, box_level, source, priority_boost, due_at, last_reviewed)
  values (v_uid, v_lang, v_term, 1, 'linguist_flag', 0.50, now(), now())
  on conflict (athlete_id, language, term) do update set
    priority_boost = greatest(public.bbf_vocab_mastery.priority_boost, 0.50),
    due_at         = now()
  returning box_level into v_box;

  return jsonb_build_object('ok', true, 'term', v_term, 'language', v_lang, 'box_level', v_box, 'flagged', true);
end;
$function$;

grant execute on function public._bbf_norm_taught_lang(text) to anon, authenticated, service_role;

comment on function public._bbf_norm_taught_lang(text) is
  'Canonical taught-language normalizer: any Portuguese identifier (pt, pt-BR, pt_BR, português, Brazilian…) → pt; everything else → es. Shared by the Vocab Gym RPCs so regional codes never leak a caller into the wrong language queue.';
comment on function public.bbf_get_vocab_queue(text, text, int) is
  'BBF Lab P3.2 · Vocab Gym daily SRS due queue (LANGUAGE_MASTERY §2.2). Vault-token gated, language-normalized (pt-BR→pt). Self-seeds the config-backed starter deck on the first read of an untouched language (§0.3 — no dead surfaces), then returns due terms ranked lowest-box → highest priority_boost → oldest due.';
