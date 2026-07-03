-- ═══════════════════════════════════════════════════════════════════════════
-- BBF Lab P3.2 · Vocab Gym SRS RPC layer (LANGUAGE_MASTERY §2.2 · §1.3)
-- ───────────────────────────────────────────────────────────────────────────
-- The schedule-aware Vocab Gym RPCs that migration 20260702134000 explicitly
-- DEFERRED ("The schedule-aware v2 RPC (due_at / boost) lands in the Language
-- RPC-layer deliverable"). It also built idx_vocab_mastery_due precisely for the
-- session-start read below (due_at ≤ now()). This is that deliverable.
--
-- All three are vault-token gated via public._bbf_uid_from_vault_token() — the
-- SAME SECURITY DEFINER pattern the live gym RPCs use (bbf_record_vocab_attempt /
-- bbf_get_language_progress). RLS denies direct table access; only these reach it.
-- athlete_id = bbf_users.id, resolved from the caller's own session token.
--
--   bbf_get_vocab_queue   — today's due SRS queue (due_at ≤ now OR null), ranked
--                           lowest-box first, then priority_boost, then oldest due.
--   bbf_review_vocab_term — record one flip: Leitner box +1 / reset-to-1, and write
--                           the next due_at from the box interval (0·1·3·7·14 d,
--                           srs_weights_v1 §2.2). Language-aware (matches the widened
--                           UNIQUE (athlete_id, language, term)).
--   bbf_flag_vocab_term   — the flag_term action: escalate a term to priority review
--                           (due now + a major priority_boost); inserts it at Box 1
--                           if the athlete flags a term not yet tracked.
--
-- The legacy 3-arg bbf_record_vocab_attempt stays UNTOUCHED (its callers — the
-- Speed/Match/Sentence games — don't pass a language and don't schedule).
--
-- Idempotent (CREATE OR REPLACE). No column changes — reuses the v2 shape from
-- 20260702134000 (language · source · due_at · lapses · priority_boost · error_cluster).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1 · bbf_get_vocab_queue — the session-start SRS due read ──────────────────
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
  v_lang  text := case when p_language in ('es', 'pt') then p_language else 'es' end;
  v_lim   int  := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_queue jsonb;
  v_due   int;
  v_total int;
begin
  v_uid := public._bbf_uid_from_vault_token(p_session_token);
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'invalid_session'); end if;

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

-- ─── 2 · bbf_review_vocab_term — schedule-aware flip writer ────────────────────
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
  v_lang  text := case when p_language in ('es', 'pt') then p_language else 'es' end;
  v_term  text := trim(coalesce(p_term, ''));
  v_box   int;
  v_due   timestamptz;
begin
  v_uid := public._bbf_uid_from_vault_token(p_session_token);
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'invalid_session'); end if;
  if length(v_term) = 0 then return jsonb_build_object('ok', false, 'error', 'missing_term'); end if;

  -- Leitner move (matches the live 3-arg RPC): +1 box on a hit (cap 5), reset to 1
  -- on a miss. Then schedule the next review from the NEW box's interval
  -- (srs_weights_v1 §2.2 · box→days 1:0 2:1 3:3 4:7 5:14). A miss also increments
  -- lapses and decays any priority_boost is left intact for the sentinel to age.
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
        when not p_correct then 0                                                   -- reset → due now
        when least(5, public.bbf_vocab_mastery.box_level + 1) = 2 then 1
        when least(5, public.bbf_vocab_mastery.box_level + 1) = 3 then 3
        when least(5, public.bbf_vocab_mastery.box_level + 1) = 4 then 7
        else 14
      end || ' days')::interval
  returning box_level, due_at into v_box, v_due;

  return jsonb_build_object('ok', true, 'term', v_term, 'language', v_lang, 'box_level', v_box, 'due_at', v_due);
end;
$function$;

-- ─── 3 · bbf_flag_vocab_term — the flag_term action (priority escalation) ──────
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
  v_lang  text := case when p_language in ('es', 'pt') then p_language else 'es' end;
  v_term  text := trim(coalesce(p_term, ''));
  v_box   int;
begin
  v_uid := public._bbf_uid_from_vault_token(p_session_token);
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'invalid_session'); end if;
  if length(v_term) = 0 then return jsonb_build_object('ok', false, 'error', 'missing_term'); end if;

  -- Flag = "I need to drill this NOW." Due immediately + a MAJOR priority_boost
  -- (0.50, the immersion major-miss weight) so it surfaces at the top of the queue.
  -- Inserts at Box 1 if the athlete flags a term not yet tracked. Never lowers an
  -- already-higher boost.
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

-- Vault-token gated (they authorize on the caller's own session internally), so
-- the client roles may execute — exactly like the live gym RPCs.
grant execute on function public.bbf_get_vocab_queue(text, text, int)             to anon, authenticated, service_role;
grant execute on function public.bbf_review_vocab_term(text, text, text, boolean)  to anon, authenticated, service_role;
grant execute on function public.bbf_flag_vocab_term(text, text, text)             to anon, authenticated, service_role;

comment on function public.bbf_get_vocab_queue(text, text, int) is
  'BBF Lab P3.2 · Vocab Gym daily SRS due queue (LANGUAGE_MASTERY §2.2). Vault-token gated. Returns due terms (due_at ≤ now or null) ranked lowest-box → highest priority_boost → oldest due. Serves idx_vocab_mastery_due.';
comment on function public.bbf_review_vocab_term(text, text, text, boolean) is
  'BBF Lab P3.2 · schedule-aware Vocab Gym flip writer. Leitner box +1/reset + next due_at from the box interval (0·1·3·7·14 d). Language-aware; the legacy bbf_record_vocab_attempt stays for the non-scheduled games.';
comment on function public.bbf_flag_vocab_term(text, text, text) is
  'BBF Lab P3.2 · flag_term action. Escalates a term to priority review (due now + 0.50 priority_boost); inserts at Box 1 if not yet tracked.';
