// bbf-embed-research — In-House Equity Mandate · zero-API-cost embedding worker
// ----------------------------------------------------------------------------
// Runs the Supabase Edge native `gte-small` ONNX model (384-dim) entirely inside
// our own infra — no external embedding API, no per-call cost. Invoked by the
// research_vault AFTER INSERT/UPDATE OF content webhook (and callable directly),
// it writes the vector back into research_vault.embedding via the service role.
//
// House conventions (CLAUDE.md §5): std-style serve handler, CORS + OPTIONS,
// jsonResponse helper, service-role client from auto-injected env, verify_jwt
// disabled with a custom shared-secret gate (the webhook can't carry a user JWT).
//
// NOTE (deliberate deviation from the verbatim spec): the brief named
// `npm:@supabase/server` / `withSupabase` / `ctx.supabaseAdmin`. That pattern is
// not used anywhere in this codebase and could not be verified to boot on the
// Edge runtime, so this uses the battle-tested `createClient` + service-role-key
// pattern every other bbf-* function uses. Same intent, known-good runtime.
// ----------------------------------------------------------------------------

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-embed-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

// gte-small session — created once at module scope, reused across invocations.
const session = new Supabase.ai.Session("gte-small");

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  try {
    // ── Shared-secret gate ──────────────────────────────────────────────────
    // The trigger signs each call with the Vault secret; verify it here. Fail
    // closed if we can't resolve the expected secret (never silently open).
    const provided = req.headers.get("x-embed-secret") ?? "";
    const { data: expected, error: secretErr } = await admin.rpc("bbf_embed_webhook_secret");
    if (secretErr || !expected) {
      console.error("[bbf-embed-research] cannot resolve webhook secret:", secretErr);
      return jsonResponse({ error: "secret_unavailable" }, 500);
    }
    if (provided !== expected) {
      console.warn("[bbf-embed-research] rejected: bad or missing x-embed-secret");
      return jsonResponse({ error: "unauthorized" }, 401);
    }

    // ── Payload: accept a direct {id, content} OR a DB webhook wrapper ───────
    // Supabase Database Webhooks post { type, table, record, old_record }.
    const raw = await req.json().catch(() => ({}));
    const row = raw?.record ?? raw;              // webhook wrapper → record
    const id: string | undefined = row?.id;
    const content: string | undefined = row?.content;

    if (!id || typeof content !== "string" || content.trim().length === 0) {
      console.warn("[bbf-embed-research] missing id/content", { id, hasContent: !!content });
      return jsonResponse({ error: "missing_id_or_content" }, 400);
    }

    console.log(`[bbf-embed-research] embedding row ${id} (${content.length} chars)`);

    // ── Native gte-small embedding → 384-dim, mean-pooled + L2-normalized ────
    const embedding = (await session.run(content, {
      mean_pool: true,
      normalize: true,
    })) as number[];

    if (!Array.isArray(embedding) || embedding.length !== 384) {
      console.error("[bbf-embed-research] unexpected embedding shape:", embedding?.length);
      return jsonResponse({ error: "embedding_shape", dims: embedding?.length ?? null }, 500);
    }

    // pgvector accepts the JSON-array text form: "[0.1,0.2,...]".
    const vectorLiteral = JSON.stringify(embedding);

    const { error: updErr } = await admin
      .from("research_vault")
      .update({ embedding: vectorLiteral })
      .eq("id", id);

    if (updErr) {
      console.error("[bbf-embed-research] update failed:", updErr);
      return jsonResponse({ error: "db_update_failed", detail: updErr.message }, 500);
    }

    console.log(`[bbf-embed-research] ✓ row ${id} vectorized (384-dim)`);
    return jsonResponse({ ok: true, id, dims: embedding.length });
  } catch (e) {
    console.error("[bbf-embed-research] fatal:", e);
    return jsonResponse({ error: "internal", detail: String(e) }, 500);
  }
});
