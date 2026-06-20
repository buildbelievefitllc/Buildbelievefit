-- BBF Lab Voice Engine · State B (Lounge Talk): Akeem takes over the nutrition domain.
-- ─────────────────────────────────────────────────────────────────────────────
-- Retire the legacy Kelli LaShae voice — the nutrition features (nutrition_vision,
-- virtual_chef) now speak in the BBF Coach Akeem Professional Voice Clone (the same
-- voice id as the coach surfaces) for total 1-on-1 coaching immersion. Data-driven
-- swap; bbf-tts-eleven applies the Lounge Talk profile (Akeem payload + multilingual_v2)
-- to the nutrition category. Idempotent guard: only flip rows not already on Akeem.
update public.voices
   set voice_id   = 'ZbKDEqxkr8Ub4psNm5XD',
       voice_name = 'BBF Coach Akeem',
       updated_at = now()
 where category = 'nutrition'
   and voice_id <> 'ZbKDEqxkr8Ub4psNm5XD';
