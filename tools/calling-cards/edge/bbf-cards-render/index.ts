// supabase/functions/bbf-cards-render — server-side BBF calling-card renderer.
// SVG → JPEG (resvg-wasm rasterizes to RGBA, jpeg-js encodes), text metrics via
// opentype.js. Faithfully reproduces the blueprint card (bbf-100-card-admap.html) at
// 4:5 (1080×1350): LOCKED Bebas Neue / Barlow Condensed, BBF Purple #6a0dad + Gold
// #f5c800 foundation, per-palette accents.
// Reads bbf_calling_cards_batch_v1 (service-role) and uploads to bucket calling-cards-v1.
// The service-role key is injected by Supabase and never leaves the function (§7).
//
// FORMAT — JPEG, not PNG: Instagram's Content Publishing API rejects PNG image posts
// (400 at container creation); it only accepts JPEG. Facebook tolerates either, which
// masks the bug. resvg only emits PNG/RGBA, so we take its raw RGBA pixels and encode
// JPEG (quality 92) — keeping the whole calling-card pipeline JPEG end-to-end and in
// lockstep with the studio (bbf-studio-queue / bbf-card-distributor).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Resvg, initWasm } from "npm:@resvg/resvg-wasm@2.6.2";
import opentype from "npm:opentype.js@1.3.4";
import jpeg from "npm:jpeg-js@0.4.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "calling-cards-v1";
const TABLE = "bbf_calling_cards_batch_v1";
const svc = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

const W = 1080, H = 1350, PAD = 76;
const ASC = { bebas: 0.9, med: 1.0, bold: 1.0 };

const PAL: Record<string, any> = {
  purDeep: { bg: [["#0d0118", 0], ["#12001e", .55], ["#000000", 1]], tbar: ["#6a0dad", "#f5c800"], eye: "#8b1abf", glow: "rgba(106,13,173,0.32)", rule: "#f5c800" },
  purMid:  { bg: [["#0d0020", 0], ["#000000", 1]], tbar: ["#6a0dad"], eye: "#8b1abf", glow: "rgba(106,13,173,0.25)", rule: "#f5c800" },
  blue:    { bg: [["#001020", 0], ["#000000", 1]], tbar: ["#38bdf8", "#6a0dad"], eye: "#38bdf8", glow: "rgba(56,189,248,0.12)", rule: "#38bdf8" },
  cyan:    { bg: [["#001518", 0], ["#000000", 1]], tbar: ["#00e5ff", "#6a0dad"], eye: "#00e5ff", glow: "rgba(0,229,255,0.10)", rule: "#00e5ff" },
  teal:    { bg: [["#00201c", 0], ["#000000", 1]], tbar: ["#2dd4bf", "#6a0dad"], eye: "#2dd4bf", glow: "rgba(45,212,191,0.12)", rule: "#2dd4bf" },
  green:   { bg: [["#001a08", 0], ["#000000", 1]], tbar: ["#4ade80", "#f5c800"], eye: "#4ade80", glow: "rgba(74,222,128,0.12)", rule: "#4ade80" },
  orange:  { bg: [["#1a0800", 0], ["#000000", 1]], tbar: ["#fb923c", "#f5c800"], eye: "#fb923c", glow: "rgba(251,146,60,0.10)", rule: "#fb923c" },
  yellow:  { solid: "#f5c800", yl: true, rule: "#6a0dad", eye: "rgba(0,0,0,0.5)" },
  border:  { solid: "#000000", border: true, tbar: ["#6a0dad", "#f5c800"], eye: "#f5c800", glow: "rgba(245,200,0,0.06)", rule: "#f5c800" },
};
const SPAN: Record<string, string> = { yl: "#f5c800", pl: "#8b1abf", gl: "#4ade80", bl: "#38bdf8", or: "#fb923c", cy: "#00e5ff", tl: "#2dd4bf" };

const ENT: Record<string, string> = { "&bull;": "•", "&amp;": "&", "&nbsp;": " ", "&#39;": "’", "&apos;": "’", "&quot;": "\"", "&lt;": "<", "&gt;": ">" };
const decode = (s: unknown) => String(s).replace(/&bull;|&amp;|&nbsp;|&#39;|&apos;|&quot;|&lt;|&gt;/g, (m) => ENT[m]);
const esc = (s: unknown) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]!));

let inited = false;
let FONTS: Uint8Array[] = [];
const OT: Record<string, any> = {};
const FU = {
  bebas: "https://raw.githubusercontent.com/google/fonts/main/ofl/bebasneue/BebasNeue-Regular.ttf",
  med: "https://raw.githubusercontent.com/google/fonts/main/ofl/barlowcondensed/BarlowCondensed-Medium.ttf",
  bold: "https://raw.githubusercontent.com/google/fonts/main/ofl/barlowcondensed/BarlowCondensed-Bold.ttf",
};
async function init() {
  if (inited) return;
  await initWasm(fetch("https://unpkg.com/@resvg/resvg-wasm@2.6.2/index_bg.wasm"));
  const [b, m, bo] = await Promise.all(Object.values(FU).map((u) => fetch(u).then((r) => r.arrayBuffer())));
  FONTS = [new Uint8Array(b), new Uint8Array(m), new Uint8Array(bo)];
  OT.bebas = opentype.parse(b); OT.med = opentype.parse(m); OT.bold = opentype.parse(bo);
  inited = true;
}
function measure(which: string, text: string, size: number): number {
  try { return OT[which].getAdvanceWidth(String(text), size); }
  catch { return String(text).length * 0.45 * size; }
}

function parseRuns(html: string, base: string, resolve: (c: string) => string) {
  const src = decode(html).replace(/<br\s*\/?>/gi, "\n");
  const re = /(<span[^>]*class=['"]?(\w+)['"]?[^>]*>)|(<strong>)|(<\/span>|<\/strong>)|([^<]+)/gi;
  const lines: { text: string; color: string }[][] = [[]]; let color = base, m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    if (m[1]) color = resolve(m[2]) || base;
    else if (m[3]) color = resolve("__strong") || base;
    else if (m[4]) color = base;
    else {
      const parts = m[5].split("\n");
      for (let i = 0; i < parts.length; i++) { if (i > 0) lines.push([]); if (parts[i] !== "") lines[lines.length - 1].push({ text: parts[i], color }); }
    }
  }
  return lines.filter((l) => l.length);
}
function wrapText(text: string, size: number, maxW: number): string[] {
  const words = String(text).split(/\s+/).filter(Boolean); const out: string[] = []; let line = "";
  for (const w of words) { const t = line ? line + " " + w : w; if (measure("med", t, size) > maxW && line) { out.push(line); line = w; } else line = t; }
  if (line) out.push(line); return out;
}
function rgba(s: string) { const m = s.match(/rgba?\(([^)]+)\)/); if (m) { const p = m[1].split(",").map((x) => x.trim()); return { c: `rgb(${p[0]},${p[1]},${p[2]})`, o: p[3] === undefined ? 1 : Number(p[3]) }; } return { c: s, o: 1 }; }

function buildSVG(row: any, idx: number): string {
  const p = PAL[row.color_palette] || PAL.purDeep;
  const yl = !!p.yl;
  const ink = {
    base: yl ? "#0a0a0a" : "#f9f5ff", body: yl ? "rgba(0,0,0,0.62)" : "rgba(255,255,255,0.62)",
    brand: yl ? "rgba(0,0,0,0.30)" : "rgba(255,255,255,0.26)", accent: yl ? "#6a0dad" : "#f5c800",
    num: yl ? "rgba(0,0,0,0.20)" : "rgba(255,255,255,0.18)", cta: yl ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.34)",
  };
  const spanResolve = (c: string) => c === "__strong" ? ink.base : (yl ? "#6a0dad" : SPAN[c]);
  let defs = "", g = "";

  if (p.solid) g += `<rect width="${W}" height="${H}" fill="${p.solid}"/>`;
  else {
    defs += `<linearGradient id="bg" x1="${W * .18}" y1="0" x2="${W * .82}" y2="${H}" gradientUnits="userSpaceOnUse">` +
      p.bg.map(([c, s]: [string, number]) => `<stop offset="${s}" stop-color="${c}"/>`).join("") + `</linearGradient>`;
    g += `<rect width="${W}" height="${H}" fill="url(#bg)"/>`;
  }
  if (p.glow) { const q = rgba(p.glow);
    defs += `<radialGradient id="gl" cx="${W * .86}" cy="${H * .84}" r="${W * .72}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${q.c}" stop-opacity="${q.o}"/><stop offset="1" stop-color="${q.c}" stop-opacity="0"/></radialGradient>`;
    g += `<rect width="${W}" height="${H}" fill="url(#gl)"/>`;
  }
  if (p.tbar) { let f = p.tbar[0];
    if (p.tbar.length > 1) { defs += `<linearGradient id="tb" x1="0" y1="0" x2="${W}" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${p.tbar[0]}"/><stop offset="1" stop-color="${p.tbar[1]}"/></linearGradient>`; f = "url(#tb)"; }
    g += `<rect x="0" y="0" width="${W}" height="9" fill="${f}"/>`;
  }
  // number + eye
  g += `<text x="${W - PAD}" y="${PAD + 16}" font-family="Bebas Neue" font-size="40" fill="${ink.num}" text-anchor="end">${esc(String(idx + 1).padStart(2, "0"))}</text>`;
  g += `<text x="${PAD}" y="${PAD + 28}" font-family="Barlow Condensed" font-weight="700" font-size="30" fill="${p.eye || ink.accent}" letter-spacing="2">${esc(decode("BBF • " + (row.eye_label || "")).toUpperCase())}</text>`;
  // foot
  const footY = H - PAD;
  g += `<text x="${PAD}" y="${footY}" font-family="Bebas Neue" font-size="34" letter-spacing="2"><tspan fill="${ink.brand}">BUILD </tspan><tspan fill="${ink.accent}">BELIEVE </tspan><tspan fill="${ink.brand}">FIT</tspan></text>`;
  g += `<text x="${W - PAD}" y="${footY}" font-family="Barlow Condensed" font-weight="700" font-size="30" fill="${ink.cta}" text-anchor="end">${esc(decode(row.cta || "Link in bio").toUpperCase())}</text>`;

  // middle block
  const maxW = W - PAD * 2, BPX = 38, BLH = 50, lh = 0.92;
  const hlines = parseRuns(row.headline || "", ink.base, spanResolve);
  const bodyText = decode(String(row.body || "")).replace(/<\/?strong>/gi, "");
  const bodyLines = wrapText(bodyText, BPX, maxW);
  const regionTop = PAD + 78, regionBot = footY - 70;
  let size = 150; const minSize = 70;
  const widest = () => Math.max(...hlines.map((ln) => ln.reduce((s, r) => s + measure("bebas", r.text, size), 0)));
  const fits = () => (widest() <= maxW) && ((hlines.length * size * lh + 34 + bodyLines.length * BLH) <= (regionBot - regionTop));
  while (size > minSize && !fits()) size -= 2;
  const headH = hlines.length * size * lh;
  const blockH = headH + 34 + bodyLines.length * BLH;
  const blockTop = regionTop + Math.max(0, (regionBot - regionTop - blockH) / 2);

  let yt = blockTop;
  for (const ln of hlines) {
    let lx = PAD; const by = yt + ASC.bebas * size;
    for (const run of ln) { g += `<text x="${lx.toFixed(1)}" y="${by.toFixed(1)}" font-family="Bebas Neue" font-size="${size}" fill="${run.color}">${esc(run.text)}</text>`; lx += measure("bebas", run.text, size); }
    yt += size * lh;
  }
  const ry = blockTop + headH + 22;
  g += `<rect x="${PAD}" y="${ry.toFixed(1)}" width="70" height="6" fill="${p.rule || ink.accent}"/>`;
  let by = blockTop + headH + 58;
  for (const ln of bodyLines) { g += `<text x="${PAD}" y="${(by + ASC.med * BPX).toFixed(1)}" font-family="Barlow Condensed" font-weight="500" font-size="${BPX}" fill="${ink.body}">${esc(ln)}</text>`; by += BLH; }
  if (p.border) g += `<rect x="2" y="2" width="${W - 4}" height="${H - 4}" fill="none" stroke="#f5c800" stroke-width="4"/>`;

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"><defs>${defs}</defs>${g}</svg>`;
}

// Rasterize the card SVG to a JPEG (Instagram-compatible). resvg renders to RGBA
// pixels; jpeg-js encodes them (quality 92). JPEG has no alpha, but every palette
// paints a full-bleed opaque background rect, so flattening is lossless here.
function renderJpeg(row: any, idx: number, fitWidth?: number): Uint8Array {
  const opts: any = { font: { fontBuffers: FONTS, loadSystemFonts: false, defaultFontFamily: "Barlow Condensed" } };
  if (fitWidth) opts.fitTo = { mode: "width", value: fitWidth };
  const rendered = new Resvg(buildSVG(row, idx), opts).render();
  const { width, height, pixels } = rendered;
  return jpeg.encode({ width, height, data: pixels }, 92).data;
}
function toB64(u8: Uint8Array) { let s = ""; const c = 0x8000; for (let i = 0; i < u8.length; i += c) s += String.fromCharCode(...u8.subarray(i, i + c)); return btoa(s); }
async function sha256(u8: Uint8Array) { const h = await crypto.subtle.digest("SHA-256", u8); return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join(""); }

async function ensureBucket() {
  const r = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, { method: "POST", headers: { ...svc, "Content-Type": "application/json" }, body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }) });
  if (r.ok) return; const t = await r.text(); if (r.status === 409 || /exist/i.test(t)) return; throw new Error(`bucket ${r.status}: ${t}`);
}
async function uploadJpeg(path: string, jpg: Uint8Array) {
  const up = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, { method: "POST", headers: { ...svc, "Content-Type": "image/jpeg", "x-upsert": "true" }, body: jpg });
  if (!up.ok) throw new Error(`upload ${up.status}: ${await up.text()}`);
}
// Best-effort delete (used to retire a stale .png once its .jpg twin is written).
// A 404/absent object is not an error — nothing to retire.
async function deleteObject(path: string) {
  try { await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, { method: "DELETE", headers: { ...svc } }); }
  catch (_) { /* best effort — a leftover .png is inert (distributor prefers .jpg) */ }
}
async function fetchRows(offset: number, limit: number) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?select=id,headline,body,eye_label,cta,color_palette,platform_target&order=created_at.asc,id.asc&offset=${offset}&limit=${limit}`, { headers: svc });
  return await r.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const u = new URL(req.url);
    const action = u.searchParams.get("action") || "run";
    await init();
    await ensureBucket();

    if (action === "preview") {
      const i = Number(u.searchParams.get("i") || "0");
      const rows = await fetchRows(i, 1);
      if (!rows.length) return json({ error: "no_row", i }, 404);
      const jpg = renderJpeg(rows[0], i);
      await uploadJpeg(`${rows[0].id}.jpg`, jpg);
      const small = renderJpeg(rows[0], i, Number(u.searchParams.get("w") || "150"));
      return json({ ok: true, id: rows[0].id, palette: rows[0].color_palette, jpgBytes: jpg.length, preview_sha256: await sha256(small), preview_b64: toB64(small) });
    }
    if (action === "run") {
      const offset = Number(u.searchParams.get("offset") || "0");
      const limit = Number(u.searchParams.get("limit") || "10");
      const rows = await fetchRows(offset, limit);
      const done: string[] = []; const errors: any[] = [];
      for (let k = 0; k < rows.length; k++) {
        try {
          await uploadJpeg(`${rows[k].id}.jpg`, renderJpeg(rows[k], offset + k));
          await deleteObject(`${rows[k].id}.png`); // retire any stale PNG so nothing is left non-JPEG
          done.push(rows[k].id);
        }
        catch (e) { errors.push({ id: rows[k]?.id, e: String(e) }); }
      }
      return json({ ok: true, offset, limit, processed: rows.length, uploaded: done.length, errors });
    }
    if (action === "count") {
      const r = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`, { method: "POST", headers: { ...svc, "Content-Type": "application/json" }, body: JSON.stringify({ prefix: "", limit: 10000 }) });
      const list = await r.json();
      return json({ ok: true, count: Array.isArray(list) ? list.length : 0 });
    }
    // Retire stale PNGs via the Storage API (direct DB deletes are blocked). Removes a
    // .png when it has a .jpg twin (redundant) OR no backing card row (orphan) — so the
    // bucket ends up JPEG-only, matching the Instagram-safe pipeline.
    if (action === "cleanup") {
      const r = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`, { method: "POST", headers: { ...svc, "Content-Type": "application/json" }, body: JSON.stringify({ prefix: "", limit: 10000 }) });
      const list = await r.json();
      const names = new Set((Array.isArray(list) ? list : []).map((o: any) => o.name));
      const pngs = [...names].filter((n) => String(n).endsWith(".png"));
      const removed: string[] = []; const kept: string[] = [];
      for (const png of pngs) {
        const stem = String(png).replace(/\.png$/, "");
        const hasTwin = names.has(`${stem}.jpg`);
        let hasRow = false;
        if (!hasTwin) {
          const rr = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?select=id&id=eq.${stem}&limit=1`, { headers: svc });
          const rows = await rr.json().catch(() => []);
          hasRow = Array.isArray(rows) && rows.length > 0;
        }
        if (hasTwin || !hasRow) { await deleteObject(String(png)); removed.push(String(png)); }
        else kept.push(String(png));
      }
      return json({ ok: true, removed_count: removed.length, kept_count: kept.length, removed, kept });
    }
    return json({ error: "unknown_action", action }, 400);
  } catch (e) {
    return json({ error: "exception", detail: String(e) }, 500);
  }
});
