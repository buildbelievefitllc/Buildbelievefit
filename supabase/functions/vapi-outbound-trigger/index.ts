// vapi-outbound-trigger — Vapi phone agent dialer + voice sync.
// Follows Deno edge function architecture.
//
// BBF Lab Voice Engine · Part 3 (External Systems): goal is to lock the phone agent to the
// BBF Coach Akeem Professional Voice Clone (Architect profile). A token-gated
// { action: 'sync_voice' } (1) ensures the ElevenLabs account credential is connected to
// Vapi so the CUSTOM clone is resolvable, then (2) PATCHes the STORED assistants to Akeem.
//
// STATUS: the Akeem voice is NOT yet applied to live calls — Vapi cannot validate/connect
// the ElevenLabs credential for the custom clone (400 'Couldn't Validate 11labs Credential').
// Until that's resolved in Vapi, outbound calls intentionally do NOT override the voice (so
// they keep working on the assistants' current voice). Re-run sync_voice once the Vapi
// ElevenLabs credential is connected and it will lock both assistants to Akeem.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-bbf-token',
};

const AKEEM_VAPI_VOICE = {
  provider: '11labs',
  voiceId: 'ZbKDEqxkr8Ub4psNm5XD',
  model: 'eleven_turbo_v2_5',
  stability: 0.35,
  similarityBoost: 0.85,
  style: 0.15,
  useSpeakerBoost: true,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status });
}

// Ensure an ElevenLabs (11labs) provider credential is connected to Vapi so custom
// account voices (the Akeem clone) resolve. Returns a small status object; never throws.
async function ensureElevenLabsCredential(vapiKey: string): Promise<Record<string, unknown>> {
  const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY') || '';
  if (!ELEVENLABS_API_KEY) return { ensured: false, reason: 'no_elevenlabs_key' };
  try {
    const listRes = await fetch('https://api.vapi.ai/credential', { headers: { Authorization: `Bearer ${vapiKey}` } });
    const raw = listRes.ok ? await listRes.json().catch(() => null) : null;
    const arr = Array.isArray(raw) ? raw : (raw?.results || raw?.data || []);
    const existing = Array.isArray(arr) ? arr.find((c: any) => String(c?.provider).toLowerCase() === '11labs') : null;
    if (existing) return { ensured: true, already_present: true, credential_id: existing.id };
    const mk = await fetch('https://api.vapi.ai/credential', {
      method: 'POST',
      headers: { Authorization: `Bearer ${vapiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: '11labs', apiKey: ELEVENLABS_API_KEY }),
    });
    const mkBody = await mk.json().catch(() => null);
    return { ensured: mk.ok, created: mk.ok, create_status: mk.status, credential_id: mkBody?.id, detail: mk.ok ? undefined : JSON.stringify(mkBody).slice(0, 300) };
  } catch (e) {
    return { ensured: false, error: (e as Error).message };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const BBF_VAPI_INVOKE_TOKEN = Deno.env.get('BBF_VAPI_INVOKE_TOKEN');
    if (!BBF_VAPI_INVOKE_TOKEN) {
      return jsonResponse({ ok: false, error: "vapi_not_configured" }, 503);
    }

    const incomingToken = req.headers.get('x-bbf-token');
    if (incomingToken !== BBF_VAPI_INVOKE_TOKEN) {
      return jsonResponse({ ok: false, error: "unauthorized" }, 401);
    }

    const VAPI_API_KEY = Deno.env.get('VAPI_API_KEY');
    const VAPI_ASSISTANT_ID = Deno.env.get('VAPI_ASSISTANT_ID');                    // accountability (Rex)
    const VAPI_SALES_ASSISTANT_ID = Deno.env.get('VAPI_SALES_ASSISTANT_ID');         // sales recovery
    const VAPI_PHONE_NUMBER_ID = Deno.env.get('VAPI_PHONE_NUMBER_ID');

    if (!VAPI_API_KEY || !VAPI_ASSISTANT_ID || !VAPI_SALES_ASSISTANT_ID || !VAPI_PHONE_NUMBER_ID) {
      throw new Error("Missing Vapi configuration environment variables");
    }

    const body = await req.json().catch(() => ({}));

    // ─── Voice sync: connect the 11labs credential, then lock BOTH stored assistants to Akeem ───
    if (body?.action === 'sync_voice') {
      const credential = await ensureElevenLabsCredential(VAPI_API_KEY);
      const ids = [
        { role: 'accountability', id: VAPI_ASSISTANT_ID },
        { role: 'sales_recovery', id: VAPI_SALES_ASSISTANT_ID },
      ];
      const results: any[] = [];
      for (const a of ids) {
        const r = await fetch(`https://api.vapi.ai/assistant/${a.id}`, {
          method: 'PATCH',
          headers: { "Authorization": `Bearer ${VAPI_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ voice: AKEEM_VAPI_VOICE }),
        });
        const txt = await r.text().catch(() => '');
        results.push({ role: a.role, status: r.status, ok: r.ok, detail: r.ok ? undefined : txt.slice(0, 300) });
        console.log(`[vapi-sync] ${a.role} assistant voice PATCH -> ${r.status}`);
      }
      const allOk = results.every((x) => x.ok);
      return jsonResponse({ ok: allOk, action: 'sync_voice', voice: AKEEM_VAPI_VOICE.voiceId, credential, results }, allOk ? 200 : 502);
    }

    // ─── Outbound call (voice intentionally NOT overridden until the Vapi credential is connected) ───
    const {
      use_case = 'accountability',
      client_email,
      client_name,
      client_phone,
      days,
      days_missed,
      protocol
    } = body;

    if (!client_phone) {
      throw new Error(`Cannot initiate call for ${client_email}: No phone number provided.`);
    }

    if (!['accountability', 'sales_recovery'].includes(use_case)) {
      throw new Error(`Unknown use_case: ${use_case}`);
    }

    const effectiveDays = days ?? days_missed ?? 3;
    const assistantId = use_case === 'sales_recovery' ? VAPI_SALES_ASSISTANT_ID : VAPI_ASSISTANT_ID;
    const variableValues = use_case === 'sales_recovery'
      ? {
          clientName: client_name || 'Client',
          daysSincePathfinder: String(effectiveDays),
          programFocus: protocol || 'Training Protocol',
          coachName: 'Akeem'
        }
      : {
          clientName: client_name || 'Client',
          daysMissed: String(effectiveDays),
          programFocus: protocol || 'Training Protocol',
          coachName: 'Akeem'
        };

    const vapiPayload = {
      phoneNumberId: VAPI_PHONE_NUMBER_ID,
      customer: { number: client_phone },
      assistantId,
      assistantOverrides: { variableValues }
    };

    console.log(`Initiating Vapi outbound call to ${client_name} (${client_phone})...`);

    const vapiRes = await fetch("https://api.vapi.ai/call/phone", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${VAPI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(vapiPayload)
    });

    if (!vapiRes.ok) {
      const errorText = await vapiRes.text();
      throw new Error(`Vapi API responded with status ${vapiRes.status}: ${errorText}`);
    }

    const responseData = await vapiRes.json();
    console.log("Vapi call initiated successfully", responseData);

    return jsonResponse({ ok: true, message: 'Vapi call triggered successfully', data: responseData }, 200);

  } catch (error) {
    console.error("Error in vapi-outbound-trigger:", (error as Error).message);
    return jsonResponse({ ok: false, error: (error as Error).message }, 400);
  }
});
