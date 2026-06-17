-- ════════════════════════════════════════════════════════════════════════
-- BBF Deterministic PAR-Q+ Engine — calculator-off-LLM, wave 1 (use case: parq_assessment)
-- ────────────────────────────────────────────────────────────────────────
-- Server-authoritative, BBF-owned PAR-Q+ classifier. PURE RULES, ZERO AI.
-- (The parq_assessment use case had no edge caller; the screen was only ever
--  client-side in bbf-app.html "_classifyPARQ" — "NEVER set by AI". This makes
--  the same standardized logic authoritative server-side so the JS and SQL
--  paths agree, mirroring the wearable-core.mjs ⇄ SQL parity pattern.)
--
-- Standardized PAR-Q+ (2014), 7 self-attested yes/no items q1..q7. Mirrors the
-- client classifier EXACTLY on answered items:
--     0 yes → self_attested · 1 yes → restricted · 2+ yes → contraindicated
-- …with ONE safety-adjacent hardening the task requires: CONSERVATIVE on
-- ambiguity. An incomplete or non-boolean ("unknown") answer is NEVER allowed
-- to auto-clear — an otherwise-clean but incomplete screen escalates to
-- 'restricted' (clearance recommended). Correctness over cleverness.
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.bbf_parq_assess(p_answers jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  v_ids           text[] := ARRAY['q1','q2','q3','q4','q5','q6','q7'];
  v_total         int    := 7;
  v_id            text;
  v_raw           jsonb;
  v_val           text;
  v_yes           int := 0;
  v_unknown       int := 0;
  v_answered      int := 0;
  v_yes_items     text[] := '{}';
  v_unknown_items text[] := '{}';
  v_complete      boolean;
  v_class         text;
  v_recommended   boolean;
  v_now           text := to_char((now() at time zone 'utc'), 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
BEGIN
  -- No usable object → fully conservative: every item unknown, recommend clearance.
  IF p_answers IS NULL OR jsonb_typeof(p_answers) <> 'object' THEN
    RETURN jsonb_build_object(
      'ok', true, 'version', 'parq+_2014', 'total_items', v_total,
      'answered_count', 0, 'yes_count', 0, 'unknown_count', v_total,
      'complete', false, 'yes_items', '[]'::jsonb, 'unknown_items', to_jsonb(v_ids),
      'classification', 'restricted', 'cardiac_clearance', 'restricted',
      'clearance', 'recommended', 'clearance_recommended', true, 'assessed_at', v_now
    );
  END IF;

  FOREACH v_id IN ARRAY v_ids LOOP
    v_raw := p_answers -> v_id;
    IF v_raw IS NULL OR jsonb_typeof(v_raw) = 'null' THEN
      v_unknown := v_unknown + 1; v_unknown_items := array_append(v_unknown_items, v_id); CONTINUE;
    END IF;
    -- Normalize boolean / string / number jsonb to a lowercase token.
    v_val := lower(trim(both '"' from v_raw::text));
    IF v_val IN ('yes','y','true','1') THEN
      v_yes := v_yes + 1; v_answered := v_answered + 1; v_yes_items := array_append(v_yes_items, v_id);
    ELSIF v_val IN ('no','n','false','0') THEN
      v_answered := v_answered + 1;
    ELSE
      v_unknown := v_unknown + 1; v_unknown_items := array_append(v_unknown_items, v_id);
    END IF;
  END LOOP;

  v_complete := (v_unknown = 0);
  -- Mirror client _classifyPARQ on the yes-count…
  v_class := CASE WHEN v_yes = 0 THEN 'self_attested' WHEN v_yes = 1 THEN 'restricted' ELSE 'contraindicated' END;
  -- …but NEVER auto-clear an incomplete screen (conservative escalation).
  IF NOT v_complete AND v_class = 'self_attested' THEN v_class := 'restricted'; END IF;
  v_recommended := (v_class <> 'self_attested');

  RETURN jsonb_build_object(
    'ok', true, 'version', 'parq+_2014', 'total_items', v_total,
    'answered_count', v_answered, 'yes_count', v_yes, 'unknown_count', v_unknown,
    'complete', v_complete,
    'yes_items', to_jsonb(v_yes_items), 'unknown_items', to_jsonb(v_unknown_items),
    'classification', v_class, 'cardiac_clearance', v_class,
    'clearance', CASE WHEN v_recommended THEN 'recommended' ELSE 'cleared' END,
    'clearance_recommended', v_recommended, 'assessed_at', v_now
  );
END;
$function$;

COMMENT ON FUNCTION public.bbf_parq_assess(jsonb) IS
  'Deterministic PAR-Q+ (2014) classifier. Mirrors client _classifyPARQ (0 yes=self_attested, 1=restricted, 2+=contraindicated); conservative — incomplete/ambiguous screens never auto-clear. calculator-off-LLM wave 1.';

GRANT EXECUTE ON FUNCTION public.bbf_parq_assess(jsonb) TO anon, authenticated, service_role;
