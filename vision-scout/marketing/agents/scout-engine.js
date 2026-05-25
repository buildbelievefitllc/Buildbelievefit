// Agent 1 · The Scout Engine · autonomous top-of-funnel ingestion.
//
// Pulls athlete-lead candidates from one or more "sources", sanitizes,
// upserts to bbf_outbound_athletes (safe on email conflict · existing
// funnel state preserved). Run by the orchestrator on the 24h cron OR
// manually via POST /api/v1/marketing/scout-engine.
//
// SOURCES
//   - seed_file  · marketing/sources/seed-leads.json · operator-maintained
//   - demo_seeds · env-gated by BBF_SCOUT_USE_DEMO_SEEDS=true · synthetic
//                  leads for end-to-end orchestrator testing
//
// EXTENDING · real scrapers (Playwright/HTTP/scraping API) go in
// marketing/sources/scrapers/<source-name>.js. Each scraper exports
// `async function fetch(): Promise<Lead[]>`. Register it in SOURCES
// below. The framework handles sanitize + upsert + dedup uniformly.

import { getSb, TABLE } from '../db.js';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED_FILE = join(__dirname, '..', 'sources', 'seed-leads.json');

const USE_DEMO_SEEDS = String(process.env.BBF_SCOUT_USE_DEMO_SEEDS || '').toLowerCase() === 'true';

const DEMO_SEEDS = [
  {
    athlete_name:       'Demo Athlete · Alpha',
    email:              'demo_alpha@bbf-marketing-sentinel.dev',
    discipline:         'Hybrid Athlete',
    public_profile_url: 'https://example.com/demo-alpha',
    performance_notes:  '5K stuck at 18:30 for 6 weeks. Bench plateaued at 225x5 with diminishing rep quality. Recovery HRV trending below 60ms.',
  },
  {
    athlete_name:       'Demo Athlete · Beta',
    email:              'demo_beta@bbf-marketing-sentinel.dev',
    discipline:         'Bodybuilding',
    public_profile_url: 'https://example.com/demo-beta',
    performance_notes:  'Cutting phase · weight stuck at 198 for 3 weeks. Macros logged inconsistently · skipped post-workout window 4 of 7 days.',
  },
];

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sanitizeLeads(rawLeads) {
  const ok       = [];
  const rejected = [];
  if (!Array.isArray(rawLeads)) return { ok, rejected };
  for (let i = 0; i < rawLeads.length; i++) {
    const lead  = rawLeads[i] || {};
    const email = String(lead.email || '').trim().toLowerCase();
    const name  = String(lead.athlete_name || '').trim();
    if (!email || !EMAIL_RX.test(email)) { rejected.push({ index: i, reason: 'invalid_email' }); continue; }
    if (!name)                            { rejected.push({ index: i, reason: 'name_required', email }); continue; }
    ok.push({
      athlete_name:       name,
      email,
      discipline:         lead.discipline       ? String(lead.discipline).trim()       : null,
      public_profile_url: lead.public_profile_url ? String(lead.public_profile_url).trim() : null,
      performance_notes:  lead.performance_notes ? String(lead.performance_notes).trim() : null,
    });
  }
  return { ok, rejected };
}

// SOURCE · seed file (manually maintained by operator)
async function _sourceSeedFile() {
  if (!existsSync(SEED_FILE)) return [];
  try {
    const raw  = readFileSync(SEED_FILE, 'utf-8');
    const data = JSON.parse(raw);
    if (Array.isArray(data?.leads)) return data.leads;
    if (Array.isArray(data))         return data;
    return [];
  } catch (err) {
    console.warn('[marketing/scout-engine] seed file parse failed:', err?.message);
    return [];
  }
}

// SOURCE · demo seeds (env-gated, off by default)
async function _sourceDemoSeeds() {
  if (!USE_DEMO_SEEDS) return [];
  return DEMO_SEEDS;
}

// REGISTERED SOURCES · add new entries as new scrapers come online.
const SOURCES = [
  { name: 'seed_file',  fn: _sourceSeedFile  },
  { name: 'demo_seeds', fn: _sourceDemoSeeds },
];

// runOnce · pull, sanitize, upsert. Returns a per-source summary +
// final accept/reject counts. Used by the orchestrator AND the
// manual-trigger HTTP handler.
export async function runOnce() {
  const sb = getSb();
  if (!sb) return { ok: false, error: 'supabase_unconfigured' };

  const sourceResults = [];
  const allCandidates = [];

  for (const source of SOURCES) {
    try {
      const candidates = await source.fn();
      sourceResults.push({ source: source.name, candidates: candidates.length });
      allCandidates.push(...candidates);
    } catch (err) {
      sourceResults.push({ source: source.name, error: err?.message });
      console.warn(`[marketing/scout-engine] source ${source.name} threw:`, err?.message);
    }
  }

  const { ok: sanitized, rejected } = sanitizeLeads(allCandidates);
  if (!sanitized.length) {
    console.log('[marketing/scout-engine] no candidates from any source · sources=' + JSON.stringify(sourceResults));
    return { ok: true, sources: sourceResults, accepted: 0, rejected, note: 'no_candidates' };
  }

  const { data, error } = await sb
    .from(TABLE)
    .upsert(sanitized, { onConflict: 'email', ignoreDuplicates: false })
    .select('id, email, status, athlete_name, created_at');
  if (error) {
    console.error('[marketing/scout-engine] upsert failed:', error);
    return { ok: false, error: 'db_upsert_failed', detail: error.message };
  }

  console.log('[marketing/scout-engine] sources=' + JSON.stringify(sourceResults) +
              ' accepted=' + (data?.length || 0) + ' rejected=' + rejected.length);

  return {
    ok:       true,
    sources:  sourceResults,
    accepted: data?.length || 0,
    rejected,
    leads:    data?.map((l) => ({ email: l.email, status: l.status })) || [],
  };
}

// HTTP handler · POST /api/v1/marketing/scout-engine (admin-gated)
export async function scoutEngine(req, res) {
  const summary = await runOnce();
  if (!summary.ok) return res.status(503).json(summary);
  return res.json(summary);
}
