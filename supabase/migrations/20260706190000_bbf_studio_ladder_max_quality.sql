-- ═══════════════════════════════════════════════════════════════════════════
-- BBF Studio · Max-Quality AV Floor — lock the export ladder (CEO mandate)
-- ───────────────────────────────────────────────────────────────────────────
-- Progressive perceived-quality loss in posted reels traced to under-spec export
-- bitrate + a memory-tied silent downgrade path. This locks studio_ladder_v1 to the
-- max-quality floor (mirrors _shared/studio-core.ts LADDER_FALLBACK):
--   • EVERY rung is full 1080x1920 (the 720p `low` rung is retired).
--   • Strict ≥12 Mbps minimum on every rung (12 Mbps default/mid, 16 Mbps high) —
--     enough to survive IG / TikTok / YouTube server-side re-encoding.
--   • device_memory_min → 0 on every rung: NO silent downgrade under memory pressure.
--   • heap_pause_frac 0.65 → 0.80 + backpressure watermark 8 → 16 so GC runs without
--     throttling the encoder into dropped frames / lower resolution.
-- Idempotent config UPDATE (data, not schema).
-- ═══════════════════════════════════════════════════════════════════════════
update public.bbf_app_config
set value = '{"high":{"w":1080,"h":1920,"bitrate_bps":16000000,"device_memory_min":0},
   "mid":{"w":1080,"h":1920,"bitrate_bps":12000000,"latency_mode":"quality","device_memory_min":0},
   "low":{"w":1080,"h":1920,"bitrate_bps":12000000,"device_memory_min":0},
   "backpressure_queue_watermark":16,"heap_pause_frac":0.80,"heap_resume_frac":0.60,
   "teardown_gc_timeout_ms":300}',
    updated_at = now()
where key = 'studio_ladder_v1';
