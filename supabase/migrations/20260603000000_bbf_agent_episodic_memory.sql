-- ════════════════════════════════════════════════════════════════════════════
-- BBF SUPABASE — CROSS-SESSION EPISODIC MEMORY SPINE (Brief 6 · Opus Max Sprint)
-- Migration: bbf_agent_episodic_memory + bbf_episodic_write / bbf_episodic_recall
-- ════════════════════════════════════════════════════════════════════════════
-- The cross-session memory spine for the 22-agent fleet. One per-user episodic
-- ledger that any agent can WRITE at the end of a session and READ at the start
-- of the next, so context (what happened, what was decided, what was flagged)
-- survives across sessions instead of dying with each stateless edge invocation.
--
-- This is the FLEET-WIDE per-user spine. It is deliberately distinct from the
-- pre-existing `bbf_orchestrator_memory` (Phase 6), which is the orchestrator's
-- own arbitration/decision ledger keyed on uid+pattern_hash. No table, RPC, or
-- routing name collides.
--
-- ── RECORD SHAPE ────────────────────────────────────────────────────────────
--   kind ∈ { 'session_summary', 'key_decision', 'flag' }
--     • session_summary — the durable 1-paragraph recap an agent emits at the
--       end of a session.
--     • key_decision    — a discrete decision worth recalling (plan change,
--       tier move, protocol swap). `decisions` carries the structured detail.
--     • flag            — a safety / wellbeing / behavioral marker that should
--       ride HIGH salience so it surfaces first on the next session.
--   salience (0..10) is the retrieval weight; recall orders by salience then
--   recency. expires_at is an optional TTL (NULL = persist indefinitely).
--
-- ── SECURITY MODEL (mirrors the Phase F RLS lockdown, NOT the legacy anon model)
--   • RLS: owner-or-admin only (user_id = auth.uid() OR public.bbf_is_admin()).
--     anon gets NO direct table access — we do not repeat the permissive-anon
--     drift that Phase F (20260601121000) had to tear out.
--   • The agent access path is two SECURITY DEFINER RPCs callable ONLY by
--     service_role (the role every edge function authenticates as via
--     SUPABASE_SERVICE_ROLE_KEY). They resolve uid→user_id server-side and
--     stamp the row with the resolved id, so a caller can never forge memory
--     under another user's identity from the client bundle.
--
-- Idempotent: CREATE TABLE/INDEX IF NOT EXISTS, CREATE OR REPLACE on functions,
-- DROP POLICY IF EXISTS before CREATE. Safe to re-apply.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. Table ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bbf_agent_episodic_memory (
  id          uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id     uuid NOT NULL REFERENCES public.bbf_users(id) ON DELETE CASCADE,
  agent       text NOT NULL,                                  -- authoring fleet agent (e.g. 'bbf-co-coach')
  session_id  text,                                           -- optional grouping for one session/turn
  kind        text NOT NULL DEFAULT 'session_summary'
              CHECK (kind IN ('session_summary', 'key_decision', 'flag')),
  summary     text NOT NULL,                                  -- human-readable episodic recap
  decisions   jsonb NOT NULL DEFAULT '[]'::jsonb,             -- structured key decisions
  flags       jsonb NOT NULL DEFAULT '[]'::jsonb,             -- safety/wellbeing/behavioral flags
  tags        text[] NOT NULL DEFAULT '{}',                   -- coarse retrieval tags
  salience    smallint NOT NULL DEFAULT 1 CHECK (salience BETWEEN 0 AND 10),
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,             -- free-form agent context
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz                                     -- optional TTL; NULL = persist
);

COMMENT ON TABLE public.bbf_agent_episodic_memory IS
  'Cross-session episodic memory spine for the BBF agent fleet (Brief 6). Per-user session summaries, key decisions, and flags. Read at session start, written at session end via the bbf_episodic_* RPCs.';

-- ─── 2. Indexes (recency · per-agent · salience · tags) ─────────────────────
CREATE INDEX IF NOT EXISTS bbf_episodic_user_created_idx
  ON public.bbf_agent_episodic_memory (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS bbf_episodic_user_agent_idx
  ON public.bbf_agent_episodic_memory (user_id, agent, created_at DESC);
CREATE INDEX IF NOT EXISTS bbf_episodic_user_salience_idx
  ON public.bbf_agent_episodic_memory (user_id, salience DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS bbf_episodic_tags_gin
  ON public.bbf_agent_episodic_memory USING gin (tags);

-- ─── 3. RLS — owner-or-admin only (anon has no direct access) ───────────────
ALTER TABLE public.bbf_agent_episodic_memory ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bbf_agent_episodic_memory TO authenticated;

DROP POLICY IF EXISTS "bbf_episodic owner or admin select" ON public.bbf_agent_episodic_memory;
CREATE POLICY "bbf_episodic owner or admin select" ON public.bbf_agent_episodic_memory
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.bbf_is_admin());

DROP POLICY IF EXISTS "bbf_episodic owner or admin insert" ON public.bbf_agent_episodic_memory;
CREATE POLICY "bbf_episodic owner or admin insert" ON public.bbf_agent_episodic_memory
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.bbf_is_admin());

DROP POLICY IF EXISTS "bbf_episodic owner or admin update" ON public.bbf_agent_episodic_memory;
CREATE POLICY "bbf_episodic owner or admin update" ON public.bbf_agent_episodic_memory
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.bbf_is_admin())
  WITH CHECK (user_id = auth.uid() OR public.bbf_is_admin());

DROP POLICY IF EXISTS "bbf_episodic admin delete" ON public.bbf_agent_episodic_memory;
CREATE POLICY "bbf_episodic admin delete" ON public.bbf_agent_episodic_memory
  FOR DELETE TO authenticated
  USING (public.bbf_is_admin());

-- ─── 4. uid → user_id resolver (internal, SECURITY DEFINER) ─────────────────
-- Accepts either the human uid ('akeem') or a raw bbf_users.id UUID. Returns
-- NULL when no live user matches. Centralized so both RPCs resolve identically.
CREATE OR REPLACE FUNCTION public.bbf_episodic_resolve_user(p_uid text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF p_uid IS NULL OR length(trim(p_uid)) = 0 THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_user_id FROM public.bbf_users WHERE uid = p_uid LIMIT 1;
  IF v_user_id IS NOT NULL THEN
    RETURN v_user_id;
  END IF;

  -- Fall back to treating the argument as the surrogate id itself.
  IF p_uid ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT id INTO v_user_id FROM public.bbf_users WHERE id = p_uid::uuid LIMIT 1;
  END IF;

  RETURN v_user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.bbf_episodic_resolve_user(text) FROM public;
-- Supabase default privileges auto-grant EXECUTE to anon/authenticated on new
-- public functions; strip them so only service_role (the edge-function role)
-- can invoke this definer resolver. (Caught by the security advisor.)
REVOKE EXECUTE ON FUNCTION public.bbf_episodic_resolve_user(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bbf_episodic_resolve_user(text) TO service_role;

-- ─── 5. WRITE — persist one episodic record at session end ──────────────────
CREATE OR REPLACE FUNCTION public.bbf_episodic_write(
  p_uid        text,
  p_agent      text,
  p_summary    text,
  p_kind       text        DEFAULT 'session_summary',
  p_decisions  jsonb       DEFAULT '[]'::jsonb,
  p_flags      jsonb       DEFAULT '[]'::jsonb,
  p_tags       text[]      DEFAULT '{}',
  p_salience   int         DEFAULT 1,
  p_session_id text        DEFAULT NULL,
  p_metadata   jsonb       DEFAULT '{}'::jsonb,
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id  uuid;
  v_kind     text;
  v_salience smallint;
  v_id       uuid;
BEGIN
  IF p_agent IS NULL OR length(trim(p_agent)) = 0 THEN
    RETURN json_build_object('ok', false, 'error', 'missing_agent');
  END IF;
  IF p_summary IS NULL OR length(trim(p_summary)) = 0 THEN
    RETURN json_build_object('ok', false, 'error', 'missing_summary');
  END IF;

  v_user_id := public.bbf_episodic_resolve_user(p_uid);
  IF v_user_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'user_not_found');
  END IF;

  -- Normalize enum + clamp salience so a bad caller can't poison the ledger.
  v_kind := lower(coalesce(p_kind, 'session_summary'));
  IF v_kind NOT IN ('session_summary', 'key_decision', 'flag') THEN
    v_kind := 'session_summary';
  END IF;
  v_salience := greatest(0, least(10, coalesce(p_salience, 1)))::smallint;

  INSERT INTO public.bbf_agent_episodic_memory
    (user_id, agent, session_id, kind, summary, decisions, flags, tags, salience, metadata, expires_at)
  VALUES (
    v_user_id, p_agent, p_session_id, v_kind, p_summary,
    coalesce(p_decisions, '[]'::jsonb),
    coalesce(p_flags, '[]'::jsonb),
    coalesce(p_tags, '{}'),
    v_salience,
    coalesce(p_metadata, '{}'::jsonb),
    p_expires_at
  )
  RETURNING id INTO v_id;

  RETURN json_build_object('ok', true, 'id', v_id, 'user_id', v_user_id, 'kind', v_kind, 'salience', v_salience);
END;
$$;
REVOKE ALL ON FUNCTION public.bbf_episodic_write(text, text, text, text, jsonb, jsonb, text[], int, text, jsonb, timestamptz) FROM public;
-- Service-role only: an anon-callable definer write that resolves uid->user_id
-- would let the public anon key forge memory under any user's identity.
REVOKE EXECUTE ON FUNCTION public.bbf_episodic_write(text, text, text, text, jsonb, jsonb, text[], int, text, jsonb, timestamptz) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bbf_episodic_write(text, text, text, text, jsonb, jsonb, text[], int, text, jsonb, timestamptz) TO service_role;

-- ─── 6. RECALL — pull relevant prior context at session start ───────────────
-- Orders by salience DESC, created_at DESC (highest-stakes + freshest first).
-- p_agent NULL → fleet-wide recall; non-null → that agent's own thread.
-- p_kinds NULL → all kinds; otherwise filter to the given kinds.
CREATE OR REPLACE FUNCTION public.bbf_episodic_recall(
  p_uid             text,
  p_agent           text    DEFAULT NULL,
  p_kinds           text[]  DEFAULT NULL,
  p_limit           int     DEFAULT 5,
  p_include_expired boolean DEFAULT false
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id uuid;
  v_limit   int;
  v_records json;
BEGIN
  v_user_id := public.bbf_episodic_resolve_user(p_uid);
  IF v_user_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'user_not_found', 'records', '[]'::json);
  END IF;

  v_limit := greatest(1, least(50, coalesce(p_limit, 5)));

  SELECT coalesce(json_agg(r), '[]'::json) INTO v_records
  FROM (
    SELECT id, agent, session_id, kind, summary, decisions, flags, tags, salience, metadata, created_at, expires_at
    FROM public.bbf_agent_episodic_memory m
    WHERE m.user_id = v_user_id
      AND (p_agent IS NULL OR m.agent = p_agent)
      AND (p_kinds IS NULL OR m.kind = ANY(p_kinds))
      AND (p_include_expired OR m.expires_at IS NULL OR m.expires_at > now())
    ORDER BY m.salience DESC, m.created_at DESC
    LIMIT v_limit
  ) r;

  RETURN json_build_object('ok', true, 'user_id', v_user_id, 'count', json_array_length(v_records), 'records', v_records);
END;
$$;
REVOKE ALL ON FUNCTION public.bbf_episodic_recall(text, text, text[], int, boolean) FROM public;
-- Service-role only: an anon-callable definer recall would let the public anon
-- key read any user's memory by uid (cross-user exfiltration).
REVOKE EXECUTE ON FUNCTION public.bbf_episodic_recall(text, text, text[], int, boolean) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bbf_episodic_recall(text, text, text[], int, boolean) TO service_role;
