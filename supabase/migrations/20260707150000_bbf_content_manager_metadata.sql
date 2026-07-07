-- ═══════════════════════════════════════════════════════════════════════════
-- BBF · DIGITAL CONTENT MANAGER — QUEUE METADATA (additive)
-- ───────────────────────────────────────────────────────────────────────────
-- The 30-day evergreen library (bbf_master_content_engine.json) carries richer
-- per-post fields than the v1 queue: trilingual `language`, the render `format`
-- (Reel Cover / Phone / Spotlight / CTA Card), the social `hashtags`, the
-- `recommended_post_time` band, and the `cut_sheet` (visual shot direction that
-- pairs with the voiceover). Persist them so the whole approved payload survives
-- into the queue for the eventual auto-poster. Purely additive columns.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.bbf_content_manager_queue
  add column if not exists language              text,
  add column if not exists format                text,
  add column if not exists hashtags              text,
  add column if not exists recommended_post_time text,
  add column if not exists cut_sheet             text;
