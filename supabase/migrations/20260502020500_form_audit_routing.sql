-- ============================================================================
-- BBF FORM AUDIT ROUTING
-- Description: Table for granular form audit data and pre-hab routing
-- Reference: AG DIRECTIVE — PHASE 6
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.bbf_audit_logs (
  id            UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id       UUID REFERENCES public.bbf_users(id) ON DELETE CASCADE,
  session_id    UUID, -- Nullable, client-generated per workout (sessionStorage), no FK
  movement_name TEXT NOT NULL,
  tension_zone  TEXT NOT NULL CHECK (tension_zone IN ('lower-back','knees','shoulders','target-muscle','hips')),
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created ON public.bbf_audit_logs(user_id, created_at);

ALTER TABLE public.bbf_audit_logs ENABLE ROW LEVEL SECURITY;

-- ALLOW ANON INSERTS/SELECTS
-- NOTE: This matches the existing loose pattern in BBF (PIN auth model, no JWT).
-- We use WITH CHECK (true) and USING (true) for the anon role as a known limitation.
CREATE POLICY "Allow Anon Inserts" 
  ON public.bbf_audit_logs 
  FOR INSERT 
  TO anon 
  WITH CHECK (true);

CREATE POLICY "Allow Anon Select" 
  ON public.bbf_audit_logs 
  FOR SELECT 
  TO anon 
  USING (true);
