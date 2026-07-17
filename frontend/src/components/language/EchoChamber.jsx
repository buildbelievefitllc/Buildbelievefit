// src/components/language/EchoChamber.jsx
// ─────────────────────────────────────────────────────────────────────────────
// MODE · THE ECHO CHAMBER — shadowing dojo over the day's Fables scene.
//
// Shadowing is the classic interpreter-training technique: HEAR a native line,
// SPEAK it back immediately, compare. Everything here is compute-first and
// zero-API by design (the Lab's house doctrine):
//   HEAR  — useNarrator (global engine toggle: premium Web Speech ⇄ Coach Akeem)
//   SPEAK — useSpeechEvaluator (on-device webkitSpeechRecognition, es-MX/pt-BR)
//   SCORE — comparePhrases word-diff (accent/punctuation-folded, green/red map)
//
// LINES come from the BBF Fables episode for the athlete's active curriculum
// day (the same scene The Path renders — read it, rebuild it, now SAY it), with
// the canonical fallback trio when no episode/session exists. A finished run
// appends to the closed-loop ledger as module 'shadow' (20260717150000) — but
// ONLY when at least one line was actually spoken; a listen-only walkthrough
// (no mic support / mic declined) never dilutes the fluency EWMA.

import { useEffect, useMemo, useRef, useState } from 'react';
import { getCurriculumEpisode, logLanguageAttempt } from '../../lib/languageLabApi.js';
import { useSpeechEvaluator, comparePhrases } from '../../lib/useSpeechEvaluator.js';
import { useLanguageLab } from './LanguageLabContext.jsx';
import { useNarrator } from './useNarrator.js';
import { useLang } from '../../context/LangContext.jsx';
import './language.css';

const PASS_SCORE = 70; // same bar the legacy Cultural Context drills use

// Canonical fallback lines (mirror The Path's built-in bank — gram-native).
const FALLBACK_LINES = {
  es: ['Activa el core.', 'Abre las rodillas.', 'Carga 90000 g en la barra.'],
  pt: ['Trave o core.', 'Abre os joelhos.', 'Carrega 90000 g na barra.'],
};

const EC_STR = {
  en: { kicker: 'Echo Chamber', title: 'Hear it. Say it. Own it.', hear: '🔊 Hear the line', speak: '🎙 Speak it', stop: '■ Stop', retry: 'Try again', next: 'Next line', finish: 'Finish', progress: (i, n) => `Line ${i} of ${n}`, listening: 'Listening…', unsupported: 'Voice input needs Chrome — you can still listen and repeat out loud.', micError: 'Mic hiccup — tap to retry.', pass: 'Echoed.', close: 'Close — once more for a clean echo.', doneTitle: 'Chamber cleared', done: (avg, p, t) => `${p}/${t} lines echoed · average match ${avg}%`, doneLogged: 'Logged to your ledger.', doneListen: 'Listening walkthrough — nothing logged.', again: 'Run it back' },
  es: { kicker: 'Cámara de Eco', title: 'Escúchala. Dila. Hazla tuya.', hear: '🔊 Escucha la línea', speak: '🎙 Dila', stop: '■ Parar', retry: 'Otra vez', next: 'Siguiente línea', finish: 'Terminar', progress: (i, n) => `Línea ${i} de ${n}`, listening: 'Escuchando…', unsupported: 'La entrada de voz necesita Chrome — aún puedes escuchar y repetir en voz alta.', micError: 'Fallo del micrófono — toca para reintentar.', pass: 'Eco logrado.', close: 'Cerca — una vez más para un eco limpio.', doneTitle: 'Cámara superada', done: (avg, p, t) => `${p}/${t} líneas con eco · coincidencia media ${avg}%`, doneLogged: 'Registrado en tu historial.', doneListen: 'Recorrido de escucha — nada registrado.', again: 'Repetir' },
  pt: { kicker: 'Câmara de Eco', title: 'Ouça. Diga. Domine.', hear: '🔊 Ouça a linha', speak: '🎙 Diga', stop: '■ Parar', retry: 'De novo', next: 'Próxima linha', finish: 'Finalizar', progress: (i, n) => `Linha ${i} de ${n}`, listening: 'Ouvindo…', unsupported: 'A entrada de voz precisa do Chrome — você ainda pode ouvir e repetir em voz alta.', micError: 'Falha no microfone — toque para tentar de novo.', pass: 'Eco conquistado.', close: 'Quase — mais uma vez para um eco limpo.', doneTitle: 'Câmara concluída', done: (avg, p, t) => `${p}/${t} linhas ecoadas · correspondência média ${avg}%`, doneLogged: 'Registrado no seu histórico.', doneListen: 'Percurso de escuta — nada registrado.', again: 'Repetir tudo' },
};

// Scene → shadowing lines: split on sentence enders, strip dialogue dashes,
// keep lines with ≥3 words, cap at 8 so a session stays a session.
function sceneToLines(sceneText) {
  return String(sceneText || '')
    .split(/(?<=[.!?…])\s+/u)
    .map((s) => s.replace(/^[—–-]\s*/, '').trim())
    .filter((s) => s.split(/\s+/).filter(Boolean).length >= 3)
    .slice(0, 8);
}

export default function EchoChamber({ language = 'es' }) {
  const { lang } = useLang();
  const { curriculum, logModuleProgress } = useLanguageLab();
  const { narrate } = useNarrator();
  const tr = EC_STR[lang] || EC_STR.en;
  const target = language === 'pt' ? 'pt' : 'es';

  const { supported, listening, transcript, interim, error, start, stop, reset } = useSpeechEvaluator(target);

  const [lines, setLines] = useState(FALLBACK_LINES[target]);
  const [idx, setIdx] = useState(0);
  const [summary, setSummary] = useState(null);  // { avg, passed, total, spoke } → the done screen
  const startedRef = useRef(false);              // freeze the line set once shadowing starts
  // Best score per line + did-they-speak live in refs (house rule: no sync
  // setState in effects) — nothing renders from them until the done screen,
  // and the done transition re-renders with the refs already current.
  const bestRef = useRef({});
  const spokeRef = useRef(false);

  // Hydrate the day's scene (the same episode The Path renders). Fallback trio
  // stands until (and unless) the episode lands before the first attempt.
  const day = curriculum.ready ? curriculum.day : null;
  useEffect(() => {
    if (!day) return undefined;
    let alive = true;
    getCurriculumEpisode(language, day).then((res) => {
      if (!alive || startedRef.current) return;
      const scene = res && res.ok && res.episode ? sceneToLines(res.episode.scene_text) : [];
      if (scene.length) setLines(scene);
    });
    return () => { alive = false; };
  }, [language, day]);

  const line = lines[idx];

  // Live word-diff against the current transcript (interim shows raw underneath).
  const result = useMemo(() => (transcript ? comparePhrases(line, transcript) : null), [line, transcript]);

  // Track the best echo per line — retries can only improve the record.
  useEffect(() => {
    if (!result) return;
    spokeRef.current = true;
    if (result.score > (bestRef.current[idx] ?? -1)) bestRef.current = { ...bestRef.current, [idx]: result.score };
  }, [result, idx]);

  const speakToggle = () => {
    startedRef.current = true;
    if (listening) { stop(); return; }
    reset();
    start();
  };

  const goNext = () => {
    stop();
    reset();
    if (idx + 1 >= lines.length) {
      // Fold the run into a render-safe summary (handler-time ref reads only).
      const spoke = spokeRef.current;
      const scores = lines.map((_, i) => bestRef.current[i] ?? 0);
      const avg = Math.round(scores.reduce((s, n) => s + n, 0) / (scores.length || 1));
      const passed = scores.filter((s) => s >= PASS_SCORE).length;
      setSummary({ avg, passed, total: lines.length, spoke });
      // Guided Track dose: a FINISHED run (spoken or listen-only) counts — the
      // daily habit is "did the rep", not "did it perfectly with a mic". Ledger
      // logging below stays spoke-gated (fluency data quality is a separate bar).
      logModuleProgress('shadow', 1);
      if (spoke) {
        logLanguageAttempt({
          language, module: 'shadow',
          itemsTotal: lines.length,
          itemsCorrect: passed,
          fluencyScore: avg,
          items: lines.map((text, i) => ({ sentence: text, score: bestRef.current[i] ?? 0 })),
        });
      }
      return;
    }
    setIdx((i) => i + 1);
  };

  const runBack = () => { stop(); reset(); setIdx(0); bestRef.current = {}; spokeRef.current = false; setSummary(null); };

  if (summary) {
    return (
      <section className="ec-shell" data-testid="echo-chamber">
        <span className="lm-kicker">{tr.kicker}</span>
        <h3 className="lm-title">{tr.doneTitle}</h3>
        <div className="ec-done" data-testid="echo-done">
          {summary.spoke ? tr.done(summary.avg, summary.passed, summary.total) : null}
          <p className="ec-done-note">{summary.spoke ? tr.doneLogged : tr.doneListen}</p>
        </div>
        <div className="tp-actions">
          <button type="button" className="tp-btn" onClick={runBack}>{tr.again}</button>
        </div>
      </section>
    );
  }

  const scored = result != null;
  const passLine = scored && result.score >= PASS_SCORE;

  return (
    <section className="ec-shell" data-testid="echo-chamber">
      <span className="lm-kicker">{tr.kicker}</span>
      <h3 className="lm-title">{tr.title}</h3>
      <div className="ec-progress">{tr.progress(idx + 1, lines.length)}</div>

      {/* the target line — word chips flip green as the echo lands */}
      <div className="ec-line" data-testid="echo-line" lang={target}>
        {(result ? result.words : line.split(/\s+/).map((text) => ({ text, matched: null }))).map((w, i) => (
          <span key={`${w.text}-${i}`} className={`ec-word${w.matched === true ? ' is-hit' : w.matched === false ? ' is-miss' : ''}`}>
            {w.text}
          </span>
        ))}
      </div>

      {scored ? (
        <div className={`ec-score${passLine ? ' is-pass' : ''}`} data-testid="echo-score">
          {result.score}% — {passLine ? tr.pass : tr.close}
        </div>
      ) : null}

      {(listening || interim) ? <div className="ec-interim" aria-live="polite">{interim || tr.listening}</div> : null}
      {!supported ? <div className="ec-notice" data-testid="echo-unsupported">{tr.unsupported}</div> : null}
      {supported && error ? (
        <button type="button" className="ec-notice is-error" onClick={speakToggle}>{tr.micError}</button>
      ) : null}

      <div className="tp-actions ec-actions">
        <button
          type="button"
          className="tp-btn tp-btn--ghost"
          onClick={() => narrate({ text: line, lang: target })}
          data-testid="echo-hear"
        >
          {tr.hear}
        </button>
        {supported ? (
          <button
            type="button"
            className={`tp-btn${listening ? '' : ' tp-btn--ghost'}`}
            onClick={speakToggle}
            data-testid="echo-speak"
          >
            {listening ? tr.stop : scored ? `🎙 ${tr.retry}` : tr.speak}
          </button>
        ) : null}
        <button type="button" className="tp-btn" onClick={goNext} data-testid="echo-next">
          {idx + 1 >= lines.length ? tr.finish : tr.next}
        </button>
      </div>
    </section>
  );
}
