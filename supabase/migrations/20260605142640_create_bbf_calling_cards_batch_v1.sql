-- ════════════════════════════════════════════════════════════════════════
-- BBF · Calling Cards Batch V1 · staging table
-- ────────────────────────────────────────────────────────────────────────
-- Queue/staging table for generated "calling card" creative (headline, body,
-- eye label, CTA, palette, caption + platform target). Rows land here as
-- status='queued' for a downstream shipper to pick up. The 100 seed rows
-- (25 × online / hybrid / everyday / athlete) were loaded separately as data,
-- not schema, and are intentionally NOT part of this migration.
--
-- Repo parity note: this file mirrors migration 20260605142640 exactly as it
-- was applied to project ihclbceghxpuawymlvgi via the Supabase MCP. RLS is
-- enabled in the companion migration 20260605152251 (service-only lockdown).
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE bbf_calling_cards_batch_v1 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  headline TEXT,
  body TEXT,
  eye_label TEXT,
  cta TEXT,
  color_palette TEXT,
  caption TEXT,
  platform_target TEXT,
  status TEXT DEFAULT 'queued',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
