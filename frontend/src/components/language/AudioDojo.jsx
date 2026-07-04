// src/components/language/AudioDojo.jsx
// ─────────────────────────────────────────────────────────────────────────────
// MODE 3 · AUDIO DOJO — the screen-locked Pimsleur stitch player.
// Drives the dynamic lesson loop through useDojoPlayer (Web Audio: bucket-pulled
// native fragments · N+1/N+2 lookahead preload · pauses on the context timeline)
// and checkpoints every advance into bbf_pimsleur_progress so a dropped session
// resumes exactly where it stopped. A Screen Wake Lock keeps the display alive
// through the anticipation pauses (best-effort — unsupported browsers still play).
// Unbaked fragment library → the Calibrating notice, never a raw error.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useDojoPlayer } from './useDojoPlayer.js';
import { savePimsleurCheckpoint, getLanguageDashboard, logLanguageAttempt } from '../../lib/languageLabApi.js';
import { useLang } from '../../context/LangContext.jsx';
import './language.css';

const DOJO_STR = {
  en: { kicker: 'Audio Dojo · Pimsleur', title: 'The Stitch Loop', lesson: (n) => `Lesson ${n}`, start: '▶ Start Lesson', resume: (n) => `▶ Resume at fragment ${n + 1}`, stop: '■ Stop', playing: (i, t) => `Fragment ${i + 1} of ${t} — anticipation pauses run on the audio clock.`, locked: '🔒 Screen lock held for the session', done: '✓ Lesson complete — checkpoint saved.', calibrating: 'Calibrating — the native fragment library for this lesson is still baking. Check back soon.' },
  es: { kicker: 'Dojo de Audio · Pimsleur', title: 'El Bucle Cosido', lesson: (n) => `Lección ${n}`, start: '▶ Iniciar Lección', resume: (n) => `▶ Continuar en fragmento ${n + 1}`, stop: '■ Detener', playing: (i, t) => `Fragmento ${i + 1} de ${t} — las pausas corren en el reloj de audio.`, locked: '🔒 Pantalla activa durante la sesión', done: '✓ Lección completa — punto de control guardado.', calibrating: 'Calibrando — la biblioteca de fragmentos nativos de esta lección aún se está preparando. Vuelve pronto.' },
  pt: { kicker: 'Dojo de Áudio · Pimsleur', title: 'O Loop Costurado', lesson: (n) => `Lição ${n}`, start: '▶ Iniciar Lição', resume: (n) => `▶ Retomar no fragmento ${n + 1}`, stop: '■ Parar', playing: (i, t) => `Fragmento ${i + 1} de ${t} — as pausas correm no relógio de áudio.`, locked: '🔒 Tela ativa durante a sessão', done: '✓ Lição completa — ponto de controle salvo.', calibrating: 'Calibrando — a biblioteca de fragmentos nativos desta lição ainda está sendo preparada. Volte em breve.' },
};

// Wall-clock read, hoisted to module scope (the render-purity rule forbids a bare
// Date.now() inside component-scope closures — house pattern, see StudioLayout).
const nowMs = () => Date.now();

// Lesson manifest: PIM fragment keys with the Pimsleur anticipation pauses —
// 3.0s after a prompt, 4.0s after a recall beat (generated on the context timeline).
function lessonFragments(language, lesson) {
  const L = String(lesson).padStart(2, '0');
  const P = language === 'pt' ? 'PT' : 'ES';
  return [
    { key: `PIM-${P}-L${L}-01`, gapAfterMs: 3000 },
    { key: `PIM-${P}-L${L}-02`, gapAfterMs: 4000 },
    { key: `PIM-${P}-L${L}-03`, gapAfterMs: 3000 },
    { key: `PIM-${P}-L${L}-04`, gapAfterMs: 4000 },
    { key: `PIM-${P}-L${L}-05`, gapAfterMs: 0 },
  ];
}

export default function AudioDojo({ language = 'es' }) {
  const { lang } = useLang();
  const tr = DOJO_STR[lang] || DOJO_STR.en;
  const [lesson, setLesson] = useState(1);
  const [resumeSeq, setResumeSeq] = useState(0);
  const [wakeLocked, setWakeLocked] = useState(false);
  const wakeRef = useRef(null);
  const startedAtRef = useRef(0);

  const fragments = useMemo(() => lessonFragments(language, lesson), [language, lesson]);

  const { status, index, play, stop } = useDojoPlayer(fragments, {
    // Checkpoint every advance — the resume tracker survives any drop.
    onAdvance: (i) => {
      savePimsleurCheckpoint({ language, lesson, fragmentSeq: i + 1, listenedMs: 0 });
    },
    onEnded: () => {
      const listened = startedAtRef.current ? nowMs() - startedAtRef.current : 0;
      savePimsleurCheckpoint({ language, lesson, fragmentSeq: fragments.length, listenedMs: listened, status: 'completed' });
      logLanguageAttempt({ language, module: 'pimsleur', itemsTotal: fragments.length, itemsCorrect: fragments.length, durationS: Math.round(listened / 1000) });
      releaseWake();
    },
  });

  // Resume point from the checkpoint tracker (one read on mount / language swap).
  useEffect(() => {
    let cancelled = false;
    getLanguageDashboard(language).then((res) => {
      if (cancelled || !res?.ok) return;
      const p = res.pimsleur;
      if (p && p.status === 'in_progress') {
        setLesson(Number(p.lesson_number) || 1);
        setResumeSeq(Math.min(Number(p.last_fragment_seq) || 0, 4));
      }
    });
    return () => { cancelled = true; };
  }, [language]);

  async function acquireWake() {
    try {
      if (navigator.wakeLock?.request) {
        wakeRef.current = await navigator.wakeLock.request('screen');
        setWakeLocked(true);
        wakeRef.current.addEventListener?.('release', () => setWakeLocked(false));
      }
    } catch { /* unsupported / denied — audio still plays */ }
  }
  function releaseWake() {
    try { wakeRef.current?.release?.(); } catch { /* noop */ }
    wakeRef.current = null;
    setWakeLocked(false);
  }
  useEffect(() => () => releaseWake(), []);

  const begin = async () => {
    startedAtRef.current = nowMs();
    await acquireWake();
    play(resumeSeq);
  };
  const halt = () => { stop(); releaseWake(); };

  const playing = status === 'playing';

  return (
    <section className="dojo-shell" data-testid="audio-dojo">
      <span className="lm-kicker">{tr.kicker}</span>
      <h3 className="lm-title">{tr.title}</h3>
      <div className="dojo-lesson">{tr.lesson(lesson)}</div>

      {status === 'calibrating' ? (
        <div className="dojo-status dojo-status--calibrating" data-testid="dojo-calibrating">{tr.calibrating}</div>
      ) : status === 'ended' ? (
        <div className="dojo-status dojo-status--done">{tr.done}</div>
      ) : (
        <>
          <div className="dojo-controls">
            {playing ? (
              <button type="button" className="dojo-btn dojo-btn--stop" onClick={halt}>{tr.stop}</button>
            ) : (
              <button type="button" className="dojo-btn" onClick={begin} data-testid="dojo-start">
                {resumeSeq > 0 ? tr.resume(resumeSeq) : tr.start}
              </button>
            )}
          </div>
          {playing ? <div className="dojo-status" data-testid="dojo-playing">{tr.playing(index, fragments.length)}</div> : null}
          {wakeLocked ? <div className="dojo-lock" data-testid="dojo-wake-lock">{tr.locked}</div> : null}
          <div className="dojo-rail" aria-hidden="true">
            {fragments.map((f, i) => (
              <span key={f.key} className={`dojo-pip${i < index ? ' is-done' : ''}${i === index && playing ? ' is-active' : ''}`} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
