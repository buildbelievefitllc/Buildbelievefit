#!/usr/bin/env node
// scripts/warm-meal-images.mjs — one-time pre-warm of the bbf-meal-image edge-
// function cache. For every meal × language it POSTs the SAME localized name the
// frontend will later send, so real traffic gets a guaranteed cache hit (Imagen 4
// is only billed on the first miss). Node 18+ (built-in fetch), zero dependencies.
//
// Idempotent: the edge function returns source:'cache' for anything already
// generated, so re-running only pays for clips still missing. Requires the es/pt
// name fields on each meal in bbf_meals.json (branch claude/gemini-api-usage-audit-*).
//
// Imagen 4 GA enforces a HARD daily cap — 70 predict requests per model per day
// on paid Tier 1 (HTTP 429 upstream, RESOURCE_EXHAUSTED). Once spent, no throttle
// helps until the quota resets (~midnight Pacific). We stay under the per-minute
// rate with a global request spacer + exponential backoff-and-retry on 429 / on
// transient empty responses. Cache hits are free and instant. So the intended
// workflow when >70 clips are missing is: run today (fills ~70), then re-run each
// day after reset — this script skips everything already cached each pass.
//
//   node scripts/warm-meal-images.mjs            # fire the batch
//   DRY_RUN=1 node scripts/warm-meal-images.mjs  # print the jobs, POST nothing
//
// Env overrides: SUPABASE_PROJECT_REF, SUPABASE_ANON_KEY, MEALS_PATH,
//                CONCURRENCY, SPACING_MS, MAX_ATTEMPTS.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// ── Config (defaults match the client bundle's env.js) ──────────────────────
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'ihclbceghxpuawymlvgi';
const ANON_KEY    = process.env.SUPABASE_ANON_KEY   || 'sb_publishable_QgvJzz4pVy7TzIIyg4RcSg_Tydy_nxU';
const FN_URL      = `https://${PROJECT_REF}.supabase.co/functions/v1/bbf-meal-image`;
const LANGS       = ['en', 'es', 'pt'];
const CONCURRENCY = Number(process.env.CONCURRENCY || 3);
const SPACING_MS  = Number(process.env.SPACING_MS  || 4500); // min gap between request STARTS (global) → ~13/min
const TIMEOUT_MS  = 120_000;         // Imagen generation can be slow
const MAX_ATTEMPTS = Number(process.env.MAX_ATTEMPTS || 8);  // per job, for 429 / transient
const BACKOFF_BASE_MS = 15_000;      // first retry wait; grows *1.7 with jitter, capped
const BACKOFF_CAP_MS  = 90_000;
const DRY_RUN     = process.env.DRY_RUN === '1';

const HERE = dirname(fileURLToPath(import.meta.url));
const MEALS_PATH = process.env.MEALS_PATH || resolve(HERE, '..', 'bbf_meals.json');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function buildJobs(meals) {
  const jobs = [];
  for (const meal of meals) {
    for (const lang of LANGS) {
      const name = (meal.name && (meal.name[lang] || meal.name.en)) || '';
      const ingredients = Array.isArray(meal.core_ingredients) ? meal.core_ingredients.join(', ') : '';
      jobs.push({ id: meal.id, lang, name, ingredients });
    }
  }
  return jobs;
}

// Global request spacer: guarantees ≥ SPACING_MS between the START of any two
// requests across all workers, so we never burst past the per-minute quota.
let nextSlot = 0;
async function waitForSlot() {
  const now = Date.now();
  const slot = Math.max(now, nextSlot);
  nextSlot = slot + SPACING_MS;
  const wait = slot - now;
  if (wait > 0) await sleep(wait);
}

async function postOnce(job) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(FN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify({ name: job.name, ingredients: job.ingredients }),
      signal: ctrl.signal,
    });
    let body = null;
    try { body = await res.json(); } catch { /* non-JSON */ }
    return { status: res.status, ok: res.ok && body?.ok !== false, body };
  } catch (err) {
    return { status: 0, ok: false, body: null, error: String(err?.message || err) };
  } finally {
    clearTimeout(t);
  }
}

// Retry on quota (upstream 429) and on transient empties (upstream 200 no_bytes)
// or network aborts (status 0). Hard 4xx (bad name etc.) are NOT retried.
function isRetryable(r) {
  if (r.status === 0) return true;                              // network/timeout
  const us = r.body?.upstream_status;
  if (r.body?.error === 'imagen_generation_failed' && (us === 429 || us === 200 || us === 500 || us === 503)) return true;
  return false;
}

async function runJob(job, idx, total) {
  let last;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    await waitForSlot();
    last = await postOnce(job);
    const src = last.body?.source || (last.ok ? '?' : (last.body?.error || last.error || 'error'));
    if (last.ok) {
      const tag = src === 'gemini_imagen_4' ? 'NEW ' : src === 'cache' ? 'HIT ' : 'ok  ';
      log(`[${String(idx + 1).padStart(3)}/${total}] ${tag} ${job.id.padEnd(28)} ${job.lang}  HTTP ${last.status}  source=${src}${attempt > 1 ? `  (attempt ${attempt})` : ''}`);
      return { ...job, ...last, attempts: attempt };
    }
    if (!isRetryable(last) || attempt === MAX_ATTEMPTS) {
      const us = last.body?.upstream_status != null ? ` upstream=${last.body.upstream_status}` : '';
      log(`[${String(idx + 1).padStart(3)}/${total}] FAIL ${job.id.padEnd(28)} ${job.lang}  HTTP ${last.status}  ${src}${us}  (gave up after ${attempt})`);
      return { ...job, ...last, attempts: attempt };
    }
    const backoff = Math.min(BACKOFF_CAP_MS, Math.round(BACKOFF_BASE_MS * Math.pow(1.7, attempt - 1)));
    const jitter = Math.round(Math.random() * 4000);
    const wait = backoff + jitter;
    const us = last.body?.upstream_status != null ? `upstream=${last.body.upstream_status}` : (last.error || 'transient');
    log(`[${String(idx + 1).padStart(3)}/${total}] .... ${job.id.padEnd(28)} ${job.lang}  ${us} → retry ${attempt + 1}/${MAX_ATTEMPTS} in ${Math.round(wait / 1000)}s`);
    await sleep(wait);
  }
  return { ...job, ...last, attempts: MAX_ATTEMPTS };
}

function log(msg) { console.log(`  ${msg}`); }

async function run() {
  const meals = JSON.parse(await readFile(MEALS_PATH, 'utf8'));
  const jobs = buildJobs(meals);

  const missingLoc = meals.filter((m) => !m.name || !m.name.es || !m.name.pt).length;
  console.log(`bbf-meal-image cache warm-up`);
  console.log(`  endpoint : ${FN_URL}`);
  console.log(`  project  : ${PROJECT_REF}`);
  console.log(`  anon key : ${ANON_KEY.slice(0, 16)}…`);
  console.log(`  meals    : ${meals.length}  ·  langs: ${LANGS.join('/')}  ·  jobs: ${jobs.length}`);
  if (missingLoc) console.log(`  ⚠ WARNING: ${missingLoc} meal(s) lack es/pt names — checked out the wrong branch? Localized keys will fall back to EN.`);
  console.log(`  mode     : ${DRY_RUN ? 'DRY_RUN (no POST)' : `live, concurrency=${CONCURRENCY}, spacing=${SPACING_MS}ms (~${Math.round(60000 / SPACING_MS)}/min), retry≤${MAX_ATTEMPTS}`}`);
  console.log('');

  if (DRY_RUN) {
    for (const j of jobs) console.log(`  [dry] ${j.id.padEnd(28)} ${j.lang}  ${j.name}`);
    console.log(`\n${jobs.length} jobs would be sent.`);
    return;
  }

  const results = new Array(jobs.length);
  let cursor = 0;
  async function worker() {
    while (cursor < jobs.length) {
      const idx = cursor++;
      results[idx] = await runJob(jobs[idx], idx, jobs.length);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  // ── Summary ───────────────────────────────────────────────────────────────
  const done = results.filter(Boolean);
  const ok      = done.filter((r) => r.ok);
  const failed  = done.filter((r) => !r.ok);
  const fresh   = ok.filter((r) => r.body?.source === 'gemini_imagen_4');
  const cached  = ok.filter((r) => r.body?.source === 'cache');
  const otherOk = ok.filter((r) => r.body?.source !== 'gemini_imagen_4' && r.body?.source !== 'cache');
  const quotaHit = failed.filter((r) => r.body?.upstream_status === 429).length;

  console.log('\n──────────── SUMMARY ────────────');
  console.log(`  total              : ${done.length}`);
  console.log(`  ok                 : ${ok.length}`);
  console.log(`  failed             : ${failed.length}`);
  console.log(`  freshly generated  : ${fresh.length}  (gemini_imagen_4, billed)`);
  console.log(`  already cached      : ${cached.length}  (cache, free)`);
  if (otherOk.length) console.log(`  ok · other source  : ${otherOk.length}`);
  if (quotaHit) console.log(`  ⚠ ${quotaHit} failed on the daily Imagen-4 quota (429) — re-run after it resets (~midnight Pacific).`);
  if (failed.length) {
    console.log('\n  FAILURES:');
    for (const f of failed) {
      const us = f.body?.upstream_status != null ? `upstream_status=${f.body.upstream_status}` : '';
      const er = f.body?.error || f.error || 'unknown';
      console.log(`    ✗ ${f.id} ${f.lang}  HTTP ${f.status}  ${er} ${us}`);
    }
  }
  console.log('─────────────────────────────────');
  process.exitCode = failed.length ? 1 : 0;
}

run().catch((e) => { console.error('fatal:', e); process.exitCode = 1; });
