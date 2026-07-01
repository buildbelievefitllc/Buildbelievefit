// bbf-science-digest — Weekly exercise-science digest for the AI Studio Science Hub.
// ─────────────────────────────────────────────────────────────────────────────
// Returns a JSON array of { tag, finding, cite } items for the Science Hub UI in
// bbf-app.html (BBF_SCIENCE_HUB).
//
// COST CONTROL (CEO burn-rate order, 2026-07):
//   • FULLY STATIC. No LLM call, no Gemini, no external API cost of any kind.
//   • Content is a hand-curated, trilingual BASELINE below. To "switch it up",
//     edit BASELINE and redeploy, or write a new row into public.bbf_science_digest
//     (scope = "<scope>:<lang>") — a DB row, if present, is served in preference
//     to BASELINE with no code change required.
//
// Request:  POST { scope?: string, max_items?: number }
//           Authorization: Bearer <anon|user jwt>   (verify_jwt on)
// Success:  200 { ok:true, items:[{tag,finding,cite}], model, generated_at, cached }
// Errors:   non-2xx { error:"<slug>", detail?:"..." }
//
// Secrets:  SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (auto-injected by runtime)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

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

const TABLE = 'bbf_science_digest';
const MAX_ITEMS_CAP = 10;

// Hand-curated, trilingual baseline. Evergreen exercise-science findings — no live
// regeneration needed. Edit directly and redeploy whenever the content should change.
const BASELINE_I18N: Record<string, Array<{ tag: string; finding: string; cite: string }>> = {
  en: [
    { tag: 'Hypertrophy · Volume', finding: 'Muscle growth follows a dose-response to weekly hard-set volume; roughly 10+ challenging sets per muscle per week drive more hypertrophy than lower volumes.', cite: 'Schoenfeld, Ogborn & Krieger, 2017 — Journal of Sports Sciences (meta-analysis)' },
    { tag: 'Protein · Intake', finding: 'Resistance-training gains in lean mass are maximized near ~1.6 g of protein per kg of bodyweight per day; intake beyond this yields little additional benefit for most lifters.', cite: 'Morton et al., 2018 — British Journal of Sports Medicine (meta-analysis)' },
    { tag: 'Training Frequency', finding: 'When weekly volume is equated, training a muscle group at least twice per week tends to produce greater hypertrophy than training it once per week.', cite: 'Schoenfeld, Ogborn & Krieger, 2016 — Sports Medicine (meta-analysis)' },
    { tag: 'Effort · Proximity to Failure', finding: 'Hypertrophy is driven by high effort. Sets taken close to failure maximize the growth stimulus; the final few hard reps carry the bulk of the adaptive signal.', cite: 'Schoenfeld & Grgic, 2019 — Strength & Conditioning Journal (review)' },
    { tag: 'Range of Motion', finding: 'Training through a full range of motion — emphasizing the lengthened (stretched) position of the muscle — generally produces superior hypertrophy compared with partial-range work.', cite: 'Schoenfeld & Grgic, 2020 — exercise-science review' },
    { tag: 'Progressive Overload', finding: 'Adaptation requires progressively increasing mechanical tension over time via load, reps, or total volume. Without progression, gains plateau.', cite: 'ACSM Position Stand — Progression Models in Resistance Training, Med Sci Sports Exerc' },
  ],
  es: [
    { tag: 'Hipertrofia · Volumen', finding: 'El crecimiento muscular sigue una relación dosis-respuesta con el volumen semanal de series exigentes; alrededor de 10+ series duras por músculo por semana generan más hipertrofia que volúmenes menores.', cite: 'Schoenfeld, Ogborn & Krieger, 2017 — Journal of Sports Sciences (metaanálisis)' },
    { tag: 'Proteína · Ingesta', finding: 'Las ganancias de masa magra por entrenamiento de fuerza se maximizan cerca de ~1.6 g de proteína por kg de peso corporal al día; más allá de eso aporta poco beneficio adicional para la mayoría.', cite: 'Morton et al., 2018 — British Journal of Sports Medicine (metaanálisis)' },
    { tag: 'Frecuencia de Entrenamiento', finding: 'Con el volumen semanal igualado, entrenar un grupo muscular al menos dos veces por semana tiende a producir más hipertrofia que una vez por semana.', cite: 'Schoenfeld, Ogborn & Krieger, 2016 — Sports Medicine (metaanálisis)' },
    { tag: 'Esfuerzo · Cercanía al Fallo', finding: 'La hipertrofia se impulsa con alto esfuerzo. Las series llevadas cerca del fallo maximizan el estímulo; las últimas repeticiones duras aportan la mayor parte de la señal adaptativa.', cite: 'Schoenfeld & Grgic, 2019 — Strength & Conditioning Journal (revisión)' },
    { tag: 'Rango de Movimiento', finding: 'Entrenar en un rango de movimiento completo — enfatizando la posición alargada (estirada) del músculo — generalmente produce mayor hipertrofia que el trabajo parcial.', cite: 'Schoenfeld & Grgic, 2020 — revisión de ciencia del ejercicio' },
    { tag: 'Sobrecarga Progresiva', finding: 'La adaptación requiere aumentar progresivamente la tensión mecánica con el tiempo mediante carga, repeticiones o volumen. Sin progresión, las ganancias se estancan.', cite: 'ACSM Position Stand — Progression Models in Resistance Training, Med Sci Sports Exerc' },
  ],
  pt: [
    { tag: 'Hipertrofia · Volume', finding: 'O crescimento muscular segue uma relação dose-resposta com o volume semanal de séries exigentes; cerca de 10+ séries difíceis por músculo por semana geram mais hipertrofia do que volumes menores.', cite: 'Schoenfeld, Ogborn & Krieger, 2017 — Journal of Sports Sciences (metanálise)' },
    { tag: 'Proteína · Ingestão', finding: 'Os ganhos de massa magra com treino de força são maximizados perto de ~1,6 g de proteína por kg de peso corporal por dia; além disso, há pouco benefício adicional para a maioria.', cite: 'Morton et al., 2018 — British Journal of Sports Medicine (metanálise)' },
    { tag: 'Frequência de Treino', finding: 'Com o volume semanal igualado, treinar um grupo muscular pelo menos duas vezes por semana tende a produzir mais hipertrofia do que uma vez por semana.', cite: 'Schoenfeld, Ogborn & Krieger, 2016 — Sports Medicine (metanálise)' },
    { tag: 'Esforço · Proximidade da Falha', finding: 'A hipertrofia é impulsionada por alto esforço. Séries levadas perto da falha maximizam o estímulo; as últimas repetições difíceis carregam a maior parte do sinal adaptativo.', cite: 'Schoenfeld & Grgic, 2019 — Strength & Conditioning Journal (revisão)' },
    { tag: 'Amplitude de Movimento', finding: 'Treinar em amplitude completa — enfatizando a posição alongada (esticada) do músculo — geralmente produz mais hipertrofia do que o trabalho parcial.', cite: 'Schoenfeld & Grgic, 2020 — revisão de ciência do exercício' },
    { tag: 'Sobrecarga Progressiva', finding: 'A adaptação exige aumentar progressivamente a tensão mecânica ao longo do tempo via carga, repetições ou volume. Sem progressão, os ganhos estagnam.', cite: 'ACSM Position Stand — Progression Models in Resistance Training, Med Sci Sports Exerc' },
  ],
};

function isItemArray(x: unknown): boolean {
  return Array.isArray(x) && x.every((it: any) => it && typeof it === 'object' && typeof it.finding === 'string');
}

function sanitize(items: any[], max: number) {
  return items
    .slice(0, max)
    .map((it) => ({
      tag: String(it.tag || 'Evidence').slice(0, 80),
      finding: String(it.finding || '').slice(0, 600),
      cite: it.cite ? String(it.cite).slice(0, 200) : '',
    }))
    .filter((it) => it.finding.length > 0);
}

// ─── PostgREST cache access (service-role; bypasses RLS) ───────────────────────
async function dbReadLatest(url: string, key: string, scope: string) {
  const q = `${url}/rest/v1/${TABLE}?scope=eq.${encodeURIComponent(scope)}` +
    `&select=items,model,generated_at&order=generated_at.desc&limit=1`;
  try {
    const res = await fetch(q, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!res.ok) return null;
    const rows = await res.json();
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  } catch (_) {
    return null;
  }
}

// ─── Handler ───────────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')    return jsonResponse({ error: 'method_not_allowed' }, 405);

  let payload: any = {};
  try { payload = await req.json(); } catch (_) { payload = {}; }

  const scope = String(payload.scope || 'exercise-science').slice(0, 60);
  const lang = (['en', 'es', 'pt'].indexOf(String(payload.lang)) !== -1) ? String(payload.lang) : 'en';
  const cacheScope = scope + ':' + lang;   // per-language cache key
  const maxItems = Math.max(3, Math.min(MAX_ITEMS_CAP, parseInt(payload.max_items, 10) || 8));

  const baseline = BASELINE_I18N[lang] || BASELINE_I18N.en;

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return jsonResponse({ ok: true, items: sanitize(baseline, maxItems), model: 'baseline', generated_at: new Date().toISOString(), cached: false, baseline: true });
  }

  // A hand-written DB row (inserted directly via SQL when the content should be
  // "switched up") takes precedence over BASELINE — no redeploy required.
  const row = await dbReadLatest(SUPABASE_URL, SERVICE_KEY, cacheScope);
  if (row && isItemArray(row.items) && row.items.length) {
    return jsonResponse({ ok: true, items: sanitize(row.items, maxItems), model: row.model || 'static', generated_at: row.generated_at, cached: true });
  }

  return jsonResponse({ ok: true, items: sanitize(baseline, maxItems), model: 'baseline', generated_at: new Date().toISOString(), cached: false, baseline: true });
});
