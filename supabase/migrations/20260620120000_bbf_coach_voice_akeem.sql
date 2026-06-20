-- BBF coach voice swap: Julius → "BBF Coach Akeem"
-- ─────────────────────────────────────────────────────────────────────────────
-- The CEO created a new ElevenLabs voice ("BBF Coach Akeem", id ZbKDEqxkr8Ub4psNm5XD)
-- and directed the BBF coach to speak in it. This is a DATA-DRIVEN swap only:
-- bbf-tts-eleven resolves the voice per request from public.voices, so there is NO
-- edge-function code change and NO redeploy — the new voice goes live the instant
-- this row update commits.
--
-- Scope = the coach persona, i.e. the two `fitness` features that both ran on Julius:
--   • virtual_coach  — the Program-tab audio coaching session (COACH_FEATURE in voiceCoachApi.js)
--   • phantom_eye    — the Kinematic Form HUD narration (same coach persona)
-- The nutrition persona (Kelli LaShae → nutrition_vision / virtual_chef) is intentionally
-- left untouched.
--
-- Verified before flipping: the new id synthesizes real MP3 audio via the live
-- ElevenLabs gateway (ok:true, ID3 payload) using an isolated, since-removed probe row.
update public.voices
   set voice_id   = 'ZbKDEqxkr8Ub4psNm5XD',
       voice_name = 'BBF Coach Akeem',
       updated_at = now()
 where feature in ('virtual_coach', 'phantom_eye')
   and category = 'fitness'
   and voice_id = 'VlUmeC1Uzj3NnwiVR9K9';  -- idempotent guard: only flip rows still on Julius
