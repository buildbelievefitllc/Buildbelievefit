// src/lib/convaiSession.js
// ─────────────────────────────────────────────────────────────────────────────
// LIVE MINDSET & ACCOUNTABILITY COACH — client session driver (Product 2,
// blueprint c509f26 §3). Mint → connect → converse → settle:
//
//   1. MINT    bbf-convai-session (fail-closed Apex gate + voice-ledger precheck)
//              → short-TTL WebRTC conversation token + signed-WS fallback +
//              server-packaged dynamic variables (name, streak, readiness, the
//              LAST session's commitments).
//   2. CONNECT @elevenlabs/client Conversation — WebRTC primary (echo
//              cancellation / noise removal, ConvAI 2.0 turn-taking,
//              eleven_flash_v2_5 ~75ms), WebSocket fallback. The SDK is
//              DYNAMICALLY imported so the main bundle never carries it.
//   3. TOOLS   log_commitment / flag_wellbeing_concern are registered as client
//              tools — acknowledged locally; the authoritative record is the
//              post-call webhook settlement (bbf-convai-postcall).
//
// The client never sees the ElevenLabs API key or the agent id — only the
// single-conversation token the gateway minted for THIS athlete.

import { FUNCTIONS_BASE, SUPABASE_ANON_KEY } from './supabaseClient.js';
import { getStoredVaultToken } from '../context/AuthContext.jsx';

function fnHeaders(vaultToken) {
  const h = {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  };
  if (vaultToken) h['x-bbf-vault-token'] = vaultToken;
  return h;
}

// Mint a live session (throws a slug-bearing Error on denial: tier_not_entitled /
// quota_exhausted / agent_unconfigured / token_mint_failed).
export async function mintConvaiSession({ mode = 'mindset', locale = 'en' } = {}) {
  const token = getStoredVaultToken();
  const res = await fetch(`${FUNCTIONS_BASE}/bbf-convai-session`, {
    method: 'POST',
    headers: fnHeaders(token),
    body: JSON.stringify({ mode, locale, vault_token: token }),
  });
  if (!res.ok) {
    let slug = `convai_mint_failed_${res.status}`;
    try { slug = (await res.json())?.error || slug; } catch { /* non-JSON body */ }
    throw new Error(slug);
  }
  const j = await res.json();
  if (!j?.ok) throw new Error(j?.error || 'convai_mint_failed');
  return j;
}

// Start a live conversation. Returns a controller: { end(), sessionId, capMin }.
// hooks: { onStatus, onModeChange, onTranscript, onAgentResponse, onCommitment,
//          onWellbeingFlag, onError, onDisconnect }
export async function startConvaiSession({ mode = 'mindset', locale = 'en', hooks = {}, mintOverride } = {}) {
  const mint = mintOverride ? await mintOverride({ mode, locale }) : await mintConvaiSession({ mode, locale });

  // Lazy-load the SDK — vite code-splits this chunk out of the main bundle.
  const { Conversation } = await import('@elevenlabs/client');

  const common = {
    dynamicVariables: mint.dynamic_variables || {},
    clientTools: {
      // Local acknowledgement only — bbf-convai-postcall's settlement of the
      // webhook transcript is the authoritative commitments record.
      log_commitment: async ({ text, due } = {}) => {
        hooks.onCommitment?.({ text: String(text || ''), due: due ? String(due) : null });
        return 'Commitment logged.';
      },
      flag_wellbeing_concern: async () => {
        hooks.onWellbeingFlag?.();
        return 'Flagged for the coaching team.';
      },
    },
    onStatusChange: (s) => hooks.onStatus?.(typeof s === 'string' ? s : s?.status),
    onModeChange: (m) => hooks.onModeChange?.(typeof m === 'string' ? m : m?.mode),
    onMessage: (msg) => {
      const source = msg?.source || msg?.role;
      const text = msg?.message ?? msg?.text ?? '';
      if (!text) return;
      if (source === 'user') hooks.onTranscript?.(text);
      else hooks.onAgentResponse?.(text);
    },
    onError: (e) => hooks.onError?.(e),
    onDisconnect: () => hooks.onDisconnect?.(),
  };

  let conversation;
  if (mint.conversation_token) {
    // PRIMARY — WebRTC (echo cancellation, noise removal, lowest glass-to-glass).
    conversation = await Conversation.startSession({
      conversationToken: mint.conversation_token,
      connectionType: 'webrtc',
      ...common,
    });
  } else if (mint.signed_ws_url) {
    // FALLBACK — signed WebSocket transport.
    conversation = await Conversation.startSession({
      signedUrl: mint.signed_ws_url,
      connectionType: 'websocket',
      ...common,
    });
  } else {
    throw new Error('convai_no_transport');
  }

  // The UI cap is a hard client ceiling (the platform holds its own 10-min max).
  const capMin = Number(mint.session_cap_min) || 8;
  const capTimer = setTimeout(() => { end().catch(() => {}); }, capMin * 60_000);

  async function end() {
    clearTimeout(capTimer);
    try { await conversation.endSession(); } catch { /* already closed */ }
  }

  return { end, sessionId: mint.session_id, capMin, conversation };
}
