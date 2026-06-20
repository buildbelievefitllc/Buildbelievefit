// supabase/functions/bbf-readiness-calculator/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// THE READINESS ENGINE — the daily CNS / readiness calculator (Blueprint §4–§5).
//
// Computes an athlete's physiological + psychological capacity for training from
// sleep + a subjective "vibe check", returns the readiness score, the CNS volume
// multiplier that scales the day's prescribed load, and a trilingual alert. The
// morning log is persisted to athlete_readiness_logs (best-effort).
//
// Pure math + a single insert — no Claude call, so no model-router (CLAUDE.md §4
// applies only to Claude-calling functions). §5 conventions: CORS + jsonResponse
// + OPTIONS preflight; success { ok:true, ... }; errors non-2xx { error, detail }.
//
// Formula (exact, Blueprint §4):
//   sleepFactor   = min(sleep_hours, 8) / 8          (capped at 1.0 to prevent over-inflation)
//   readiness     = ((sleepFactor * 0.6) + (vibe * 0.4)) * 10
//   volMultiplier = readiness < 5 → 0.5 ; readiness < 8 → 0.8 ; else 1.0

// Built-in Deno.serve (no deno.land/std fetch) keeps bundling reliable.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-bbf-admin-token, x-bbf-vault-token, x-client-info',
};
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// The Vibe Check Multipliers (Blueprint §4) — exact.
//   chilling           (Sovereign Flow · optimal CNS reserve)  → 1.0
//   chill_restless     (neutral · standard capacity)           → 0.9
//   little_irritated   (minor fatigue · CNS strain)            → 0.8
//   exhausted_irritated(deep fatigue · recovery priority)      → 0.5
const VIBE_MULTIPLIERS: Record<string, number> = {
  chilling: 1.0,
  chill_restless: 0.9,
  little_irritated: 0.8,
  exhausted_irritated: 0.5,
};

// Trilingual alert logic (Blueprint §5) — exact strings.
function alertsFor(score: number) {
  const low = score < 5;
  return {
    en: low ? 'Recovery Focus: Low CNS Reserve.' : 'Ready for Sovereign Performance.',
    es: low ? 'Foco en Recuperación: Reserva CNS baja.' : 'Listo para el Rendimiento Soberano.',
    pt: low ? 'Foco na Recuperação: Reserva CNS baixa.' : 'Pronto para Performance Soberana.',
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  let payload: Record<string, unknown>;
  try { payload = await req.json(); } catch { return jsonResponse({ error: 'invalid_json' }, 400); }

  const athleteId = typeof payload?.athlete_id === 'string' ? payload.athlete_id : null;
  const sleepHours = Number(payload?.sleep_hours);
  const vibeCheck = String(payload?.vibe_check || '');

  if (!Number.isFinite(sleepHours) || sleepHours < 0) {
    return jsonResponse({ error: 'invalid_sleep_hours', detail: 'sleep_hours must be a non-negative number.' }, 400);
  }
  if (!(vibeCheck in VIBE_MULTIPLIERS)) {
    return jsonResponse({ error: 'invalid_vibe_check', detail: `vibe_check must be one of: ${Object.keys(VIBE_MULTIPLIERS).join(', ')}.` }, 400);
  }

  // ── The Readiness Score (Blueprint §4) ─────────────────────────────────────
  const sleepFactor = Math.min(sleepHours / 8, 1.0);          // min(sleep,8)/8
  const vibeFactor = VIBE_MULTIPLIERS[vibeCheck];
  const readinessScore = Math.round((((sleepFactor * 0.6) + (vibeFactor * 0.4)) * 10) * 100) / 100;

  // ── CNS Volume Adjustment (Blueprint §4/§5) ────────────────────────────────
  let volMultiplier = 1.0;                                    // Score 8–10 → Full Training
  if (readinessScore < 5) volMultiplier = 0.5;               // Score 1–4  → Restorative/Prehab
  else if (readinessScore < 8) volMultiplier = 0.8;          // Score 5–7  → Reduced Intensity

  const alerts = alertsFor(readinessScore);

  // Persist the morning log. Best-effort — a write hiccup never blocks the verdict.
  // The athlete_id FK guards against logging against a non-existent athlete.
  let logged = false;
  if (athleteId && SUPABASE_URL && SERVICE_KEY) {
    try {
      const supa = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
      const { error } = await supa.from('athlete_readiness_logs').insert({
        athlete_id: athleteId,
        sleep_hours: sleepHours,
        vibe_check: vibeCheck,
        readiness_score: readinessScore,
        volume_multiplier: volMultiplier,
        wearable_sync_id: typeof payload?.wearable_sync_id === 'string' ? payload.wearable_sync_id : null,
      });
      logged = !error;
      if (error) console.error('[bbf-readiness-calculator] log insert failed:', error.message);
    } catch (e) {
      console.error('[bbf-readiness-calculator] persist error:', (e as Error).message);
    }
  }

  return jsonResponse({ ok: true, readinessScore, volMultiplier, alerts, logged });
});
