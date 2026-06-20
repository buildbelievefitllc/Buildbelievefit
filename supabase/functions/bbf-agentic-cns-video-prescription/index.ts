// bbf-agentic-cns-video-prescription — CNS-Triggered Video Prescription
// ─────────────────────────────────────────────────────────────────────────
// Wires check-in data (sleep + stress) → video selection (guided meditation
// from 30-video library). Fallback: manual "Motivation Level" slider for
// users who skip check-in.
//
// Two paths:
//   1. CHECK-IN: sleep_hours + stress_level → CNS state calculation
//   2. SLIDER: cns_state provided directly
//
// Returns: video metadata (title, url, duration, language)
// Logs to: bbf_video_prescriptions table (optional analytics)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.4';
import { videoLibrary } from './videoLibrary.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-bbf-admin-token',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// ─── CNS State Calculation ────────────────────────────────────────────────
// Deterministic (no LLM). Routes based on sleep + stress metrics.
function calculateCNSState(sleepHours: number, stressLevel: number): string {
  if (sleepHours < 6 && stressLevel > 7) {
    return 'DECOMPRESS'; // High stress + low recovery
  }
  if (sleepHours >= 6 && sleepHours <= 8 && stressLevel >= 4 && stressLevel <= 7) {
    return 'BALANCED'; // OK sleep + mid stress
  }
  if (sleepHours > 8 && stressLevel < 4) {
    return 'ENERGIZED'; // Great recovery + low stress
  }
  if (sleepHours >= 6 && stressLevel < 4) {
    return 'GROUNDED'; // Good sleep + low stress
  }
  return 'BALANCED'; // Fallback
}

// ─── Video Selection ──────────────────────────────────────────────────────
// Filter library by language + CNS state, rotate/randomize selection.
function selectVideo(
  cnsState: string,
  language: string,
  userId?: string
): { video: (typeof videoLibrary)[0]; index: number } {
  const lang = (language || 'en').toLowerCase() as 'en' | 'es' | 'pt';
  const validLang = ['en', 'es', 'pt'].includes(lang) ? lang : 'en';

  // Get videos for this language
  const allVideos = videoLibrary.filter((v) => v.language === validLang);
  if (allVideos.length === 0) {
    // Fallback to English if language not found
    const fallback = videoLibrary.filter((v) => v.language === 'en');
    return {
      video: fallback[Math.floor(Math.random() * fallback.length)],
      index: 0,
    };
  }

  // Category mapping (all videos are confidence/mindset, so we rotate fairly)
  // In production, you might tag videos by intensity/vibe to match CNS state.
  // For now, we rotate through all available videos for that language.
  const seed = userId ? parseInt(userId.slice(0, 8), 16) % allVideos.length : Math.floor(Math.random() * allVideos.length);
  const index = seed;

  return {
    video: allVideos[index],
    index,
  };
}

// ─── Edge Function Handler ────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405);
  }

  try {
    const body = await req.json();

    // Validate required fields
    if (!body.user_id) {
      return jsonResponse({ error: 'missing_user_id' }, 400);
    }

    const language = (body.language || 'en').toLowerCase();
    if (!['en', 'es', 'pt'].includes(language)) {
      return jsonResponse({ error: 'invalid_language' }, 400);
    }

    let cnsState: string;

    // Path 1: Check-in (sleep + stress)
    if (body.source === 'checkin') {
      if (typeof body.sleep_hours !== 'number' || typeof body.stress_level !== 'number') {
        return jsonResponse({ error: 'invalid_checkin_data' }, 400);
      }
      cnsState = calculateCNSState(body.sleep_hours, body.stress_level);
    }
    // Path 2: Slider (direct CNS state)
    else if (body.source === 'slider') {
      if (!body.cns_state) {
        return jsonResponse({ error: 'missing_cns_state' }, 400);
      }
      cnsState = body.cns_state.toUpperCase();
    } else {
      return jsonResponse({ error: 'invalid_source' }, 400);
    }

    // Select video
    const { video, index } = selectVideo(cnsState, language, body.user_id);

    // Optional: log to database for analytics
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const supabase = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY
        );
        await supabase.from('bbf_video_prescriptions').insert({
          user_id: body.user_id,
          cns_state: cnsState,
          video_id: video.id,
          source: body.source,
          created_at: new Date().toISOString(),
        });
      } catch (err) {
        console.warn('[bbf-agentic-cns-video-prescription] DB logging failed:', err);
        // Non-fatal: continue
      }
    }

    // Build response
    const response = {
      ok: true,
      cns_state: cnsState,
      video_id: video.id,
      video_title: video.title,
      video_url: video.url,
      duration_minutes: video.duration_minutes || 10,
      language,
    };

    return jsonResponse(response);
  } catch (err) {
    console.error('[bbf-agentic-cns-video-prescription] Error:', err);
    return jsonResponse(
      { error: 'internal_server_error', detail: err instanceof Error ? err.message : String(err) },
      500
    );
  }
});
