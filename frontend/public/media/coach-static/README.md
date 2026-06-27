# /media/coach-static — static coach-cue MP3s

This directory holds the **repo-static** exercise-library voice cues (program form
cues + prehab drills) in Coach Akeem's cloned voice — **110 slugs × en/es/pt = 330
`<slug>.<locale>.mp3`** files. They let the Program and Prehab tabs play coaching
audio with **zero ElevenLabs spend** (no backend ping), via `<CoachVoiceNote>`.

The clips are **generated once** and uploaded to the public `coach-static` Supabase
Storage bucket by `bbf-bake-coach-static`. Mirror them into this folder with:

```bash
node scripts/sync-coach-static.mjs
```

Until the mirror runs, `<CoachVoiceNote>` serves the clips from the bucket CDN
automatically (still 100% static). See `scripts/README-coach-static.md` for the
full pipeline.

> The `.mp3` files are intentionally not committed from the locked CI session that
> generated them (no egress to Storage there); run the sync above from any shell
> with network access to populate this folder, then commit the audio.
