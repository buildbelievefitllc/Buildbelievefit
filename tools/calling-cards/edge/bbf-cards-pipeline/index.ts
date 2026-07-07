// supabase/functions/bbf-cards-pipeline — batch helper for the calling-card pipeline.
// Server-side data export + Storage upload for the BBF calling-card render job.
// The service-role key is injected by Supabase and never leaves the function (§7).
//
// Actions (querystring ?action=):
//   export        → all bbf_calling_cards_batch_v1 rows (service-role read, RLS-bypassing)
//   ensure_bucket → create public bucket calling-cards-v1 (idempotent)
//   upload        → body {path, b64}: write one image into the bucket (upsert).
//                   Content-Type is derived from the path extension (.jpg→image/jpeg,
//                   .png→image/png) so JPEG cards land labeled correctly for Instagram.
//   count         → number of objects currently in the bucket
//
// Auth: standard Supabase JWT (verify_jwt = true) — invoke with the project anon key.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "calling-cards-v1";
const TABLE = "bbf_calling_cards_batch_v1";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const svc = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };

async function ensureBucket() {
  const r = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method: "POST",
    headers: { ...svc, "Content-Type": "application/json" },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }),
  });
  if (r.ok) return;
  const t = await r.text();
  if (r.status === 409 || /exist/i.test(t)) return; // already there → fine
  throw new Error(`bucket ${r.status}: ${t}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const action = new URL(req.url).searchParams.get("action") || "upload";

    if (action === "export") {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/${TABLE}?select=id,headline,body,eye_label,cta,color_palette,platform_target,status&order=created_at`,
        { headers: svc },
      );
      const rows = await r.json();
      return json({ ok: true, count: Array.isArray(rows) ? rows.length : 0, rows });
    }

    if (action === "ensure_bucket") {
      await ensureBucket();
      return json({ ok: true, bucket: BUCKET });
    }

    if (action === "upload") {
      const { path, b64 } = await req.json();
      if (!path || !b64) return json({ error: "missing_path_or_b64" }, 400);
      await ensureBucket();
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      // Derive Content-Type from the path extension — Instagram needs image/jpeg on
      // .jpg cards; default to jpeg (the pipeline's format) for anything unlabeled.
      const ext = String(path).toLowerCase().split(".").pop();
      const contentType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
      const up = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
        method: "POST",
        headers: { ...svc, "Content-Type": contentType, "x-upsert": "true" },
        body: bytes,
      });
      if (!up.ok) return json({ error: "upload_failed", status: up.status, detail: await up.text() }, 500);
      return json({ ok: true, path, bytes: bytes.length });
    }

    if (action === "count") {
      const r = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`, {
        method: "POST",
        headers: { ...svc, "Content-Type": "application/json" },
        body: JSON.stringify({ prefix: "", limit: 10000 }),
      });
      const list = await r.json();
      return json({ ok: true, bucket: BUCKET, count: Array.isArray(list) ? list.length : 0 });
    }

    return json({ error: "unknown_action", action }, 400);
  } catch (e) {
    return json({ error: "exception", detail: String(e) }, 500);
  }
});
