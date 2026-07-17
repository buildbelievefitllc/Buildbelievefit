// src/components/language/LanguageLabContext.jsx
// ─────────────────────────────────────────────────────────────────────────────
// THE BILINGUAL STATE MATRIX + CURRICULUM ENGINE — the Language Lab's global state.
//
// One provider owns the lab-wide concerns:
//   • target — the ACTIVE LEARNING LANGUAGE ('es' | 'pt'). Persisted to
//     localStorage ('bbf_lab_target') so the state survives unmounts and page
//     refreshes — a PT session can never accidentally log into the ES ledger.
//     Every module below the provider keys its DB reads/writes on this value.
//   • narrationEngine — THE SYSTEM NARRATION ENGINE ('natural' | 'akeem'). The
//     global voice-persona toggle that meshes the two voice systems into one:
//       'natural' → the premium native Web Speech player (speechNarrator.js)
//       'akeem'   → Coach Akeem's pre-baked ElevenLabs clips (speakBaked chain)
//     Persisted to 'bbf_lab_narration_engine'; every 🔊 across the Lab reads it
//     through useNarrator so a single toggle re-routes ALL playback at once.
//   • curriculum — the Guided Track state for the active target: current day,
//     the daily dose requirements, live counters, and logModuleProgress — the
//     single write path the modules call (Forge → 'vocab', Path → 'syntax',
//     Video Vault → 'video'). Completing the dose unlocks Day N+1 server-side
//     (bbf_log_curriculum_progress stamps the telemetry flag).
//
// NON-THROWING CONTRACT (house rule, mirrors useVocabGym): no session / RPC
// error → the curriculum reads as unavailable ({ ready:false }) and every write
// is a resolved no-op. Components mounted OUTSIDE the provider (e2e harness
// standalone mounts) get the same inert default — nothing ever crashes.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getCurriculumTrack, logCurriculumProgress } from '../../lib/languageLabApi.js';

const TARGET_KEY = 'bbf_lab_target';
const ENGINE_KEY = 'bbf_lab_narration_engine';
// The 5-item daily dose (Fable Fleet Sync wave 4): 'shadow' is the Echo
// Chamber's dose metric (matches the module name it writes to the session
// ledger); 'clinic' is the Grammar Clinic's.
const FALLBACK_REQ = { vocab: 10, syntax: 1, video: 1, shadow: 1, clinic: 1 };
const DOSE_METRICS = ['vocab', 'syntax', 'video', 'shadow', 'clinic'];

function readStoredTarget() {
  try {
    const t = localStorage.getItem(TARGET_KEY);
    return t === 'pt' ? 'pt' : 'es';
  } catch { return 'es'; }
}

// Default 'natural' — the premium native Web Speech output (per the toggle spec).
function readStoredEngine() {
  try {
    return localStorage.getItem(ENGINE_KEY) === 'akeem' ? 'akeem' : 'natural';
  } catch { return 'natural'; }
}

const INERT_CURRICULUM = {
  ready: false, loading: false,
  day: 1, daysCompleted: 0,
  requirements: FALLBACK_REQ,
  progress: { vocab: 0, syntax: 0, video: 0, shadow: 0, clinic: 0 },
  dayComplete: false, justUnlocked: false,
};

const LanguageLabContext = createContext({
  target: 'es',
  setTarget: () => {},
  narrationEngine: 'natural',
  setNarrationEngine: () => {},
  curriculum: INERT_CURRICULUM,
  logModuleProgress: () => Promise.resolve({ ok: false, error: 'no_provider' }),
});

// eslint-disable-next-line react-refresh/only-export-components
export function useLanguageLab() {
  return useContext(LanguageLabContext);
}

export function LanguageLabProvider({ children }) {
  const [target, setTargetState] = useState(readStoredTarget);
  const [narrationEngine, setEngineState] = useState(readStoredEngine);
  const [curr, setCurr] = useState({ ...INERT_CURRICULUM, loading: true });
  const alive = useRef(true);

  const setTarget = useCallback((tg) => {
    const next = tg === 'pt' ? 'pt' : 'es';
    setTargetState(next);
    try { localStorage.setItem(TARGET_KEY, next); } catch { /* quota / private mode */ }
  }, []);

  // THE SYSTEM NARRATION ENGINE toggle — persisted so the chosen voice persona
  // survives refreshes/unmounts, exactly like the target-language matrix.
  const setNarrationEngine = useCallback((eng) => {
    const next = eng === 'akeem' ? 'akeem' : 'natural';
    setEngineState(next);
    try { localStorage.setItem(ENGINE_KEY, next); } catch { /* quota / private mode */ }
  }, []);

  // Shared shape mapper for both RPC responses (get + log return the same envelope).
  const applyTrack = useCallback((res) => {
    if (!res || !res.ok) return { ...INERT_CURRICULUM };
    return {
      ready: true, loading: false,
      day: Number(res.current_day) || 1,
      daysCompleted: Number(res.days_completed) || 0,
      requirements: {
        vocab: Number(res.requirements?.vocab) || FALLBACK_REQ.vocab,
        syntax: Number(res.requirements?.syntax) || FALLBACK_REQ.syntax,
        video: Number(res.requirements?.video) || FALLBACK_REQ.video,
        shadow: Number(res.requirements?.shadow) || FALLBACK_REQ.shadow,
        clinic: Number(res.requirements?.clinic) || FALLBACK_REQ.clinic,
      },
      progress: {
        vocab: Number(res.progress?.vocab) || 0,
        syntax: Number(res.progress?.syntax) || 0,
        video: Number(res.progress?.video) || 0,
        shadow: Number(res.progress?.shadow) || 0,
        clinic: Number(res.progress?.clinic) || 0,
      },
      dayComplete: res.day_complete === true,
      justUnlocked: res.unlocked_next === true,
    };
  }, []);

  // Hydrate on mount + every target swap — the whole track re-keys per language.
  // No synchronous setState in the effect body (house rule, see useVocabGym) —
  // the awaited fetch resolves and applies in the deferred continuation.
  useEffect(() => {
    alive.current = true;
    getCurriculumTrack(target).then((res) => { if (alive.current) setCurr(applyTrack(res)); });
    return () => { alive.current = false; };
  }, [target, applyTrack]);

  // The modules' single write path. Optimistic local bump, then reconcile with the
  // server envelope (which owns day completion + the unlock). Fire-and-safe.
  const logModuleProgress = useCallback(async (metric, count = 1) => {
    if (!DOSE_METRICS.includes(metric)) return { ok: false, error: 'invalid_metric' };
    setCurr((c) => (c.ready
      ? { ...c, progress: { ...c.progress, [metric]: c.progress[metric] + count } }
      : c));
    const res = await logCurriculumProgress({ language: target, metric, count });
    if (alive.current && res && res.ok) setCurr(applyTrack(res));
    return res;
  }, [target, applyTrack]);

  const value = useMemo(
    () => ({ target, setTarget, narrationEngine, setNarrationEngine, curriculum: curr, logModuleProgress }),
    [target, setTarget, narrationEngine, setNarrationEngine, curr, logModuleProgress],
  );

  return <LanguageLabContext.Provider value={value}>{children}</LanguageLabContext.Provider>;
}
