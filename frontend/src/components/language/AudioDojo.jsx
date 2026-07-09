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
import { useNarrator } from './useNarrator.js';
import { savePimsleurCheckpoint, getLanguageDashboard, logLanguageAttempt } from '../../lib/languageLabApi.js';
import { warmUpAudioPlayback } from '../../lib/languageSoundboardVoice.js';
import { useLang } from '../../context/LangContext.jsx';
import curriculum from '../../data/audioDojoCurriculum.json';
import './language.css';

const DOJO_STR = {
  en: { kicker: 'Audio Dojo · Pimsleur', title: 'The Stitch Loop', lesson: (n) => `Lesson ${n}`, start: '▶ Start Lesson', resume: (n) => `▶ Resume at fragment ${n + 1}`, stop: '■ Stop', playing: (i, t) => `Fragment ${i + 1} of ${t} — anticipation pauses run on the audio clock.`, locked: '🔒 Screen lock held for the session', done: '✓ Lesson complete — checkpoint saved.', calibrating: 'Calibrating — the native fragment library for this lesson is still baking. Check back soon.', engAkeem: '🎙 Coach Akeem — native baked pronunciation', engNatural: '🎙 The stitch drill always uses Coach Akeem’s native baked voices (native pronunciation is required for recall). The Natural Synthesizer drives the other modules.' },
  es: { kicker: 'Dojo de Audio · Pimsleur', title: 'El Bucle Cosido', lesson: (n) => `Lección ${n}`, start: '▶ Iniciar Lección', resume: (n) => `▶ Continuar en fragmento ${n + 1}`, stop: '■ Detener', playing: (i, t) => `Fragmento ${i + 1} de ${t} — las pausas corren en el reloj de audio.`, locked: '🔒 Pantalla activa durante la sesión', done: '✓ Lección completa — punto de control guardado.', calibrating: 'Calibrando — la biblioteca de fragmentos nativos de esta lección aún se está preparando. Vuelve pronto.', engAkeem: '🎙 Coach Akeem — pronunciación nativa pregrabada', engNatural: '🎙 El bucle siempre usa las voces nativas pregrabadas de Coach Akeem (la pronunciación nativa es esencial para el recuerdo). El Sintetizador Natural gobierna los otros módulos.' },
  pt: { kicker: 'Dojo de Áudio · Pimsleur', title: 'O Loop Costurado', lesson: (n) => `Lição ${n}`, start: '▶ Iniciar Lição', resume: (n) => `▶ Retomar no fragmento ${n + 1}`, stop: '■ Parar', playing: (i, t) => `Fragmento ${i + 1} de ${t} — as pausas correm no relógio de áudio.`, locked: '🔒 Tela ativa durante a sessão', done: '✓ Lição completa — ponto de controle salvo.', calibrating: 'Calibrando — a biblioteca de fragmentos nativos desta lição ainda está sendo preparada. Volte em breve.', engAkeem: '🎙 Coach Akeem — pronúncia nativa pré-gravada', engNatural: '🎙 O loop sempre usa as vozes nativas pré-gravadas do Coach Akeem (a pronúncia nativa é essencial para a memorização). O Sintetizador Natural comanda os outros módulos.' },
};

// Wall-clock read, hoisted to module scope (the render-purity rule forbids a bare
// Date.now() inside component-scope closures — house pattern, see StudioLayout).
const nowMs = () => Date.now();

// Breath-pause between back-chaining pieces — shorter than the anticipation/echo
// pauses (those are for active learner recall; this is just a natural beat).
const SHORT_GAP_MS = 1200;

// Lesson manifest, built straight from audioDojoCurriculum.json's challenges —
// English prompt -> (anticipation pause) -> native target -> back-chaining
// breakdown (or, absent one, the target replayed once) -> (echo pause) -> next
// challenge. Fragment keys are DOJO-<challenge_id>-PROMPT/TARGET/BC<i>, matching
// scripts/build-audio-dojo-cues.mjs's baker exactly — no shared manifest needed.
function lessonFragments(language, lessonNumber) {
  const langName = language === 'pt' ? 'portuguese' : 'spanish';
  const lessons = curriculum.languages[langName] || [];
  const lesson = lessons.find((l) => l.lesson_number === lessonNumber);
  if (!lesson) return [];

  const out = [];
  for (const c of lesson.challenges) {
    out.push({ key: `DOJO-${c.challenge_id}-PROMPT`, gapAfterMs: Math.round((c.anticipation_seconds ?? 4) * 1000) });
    const targetKey = `DOJO-${c.challenge_id}-TARGET`;
    const bc = Array.isArray(c.back_chaining) ? c.back_chaining : [];
    const echoMs = Math.round((c.echo_seconds ?? 2) * 1000);
    if (bc.length) {
      out.push({ key: targetKey, gapAfterMs: SHORT_GAP_MS });
      bc.forEach((_, i) => {
        const isLast = i === bc.length - 1;
        out.push({ key: `DOJO-${c.challenge_id}-BC${i}`, gapAfterMs: isLast ? echoMs : SHORT_GAP_MS });
      });
    } else {
      // No back-chaining authored for this challenge — the target's own replay is the echo.
      out.push({ key: targetKey, gapAfterMs: echoMs });
      out.push({ key: targetKey, gapAfterMs: 0 });
    }
  }
  if (out.length) out[out.length - 1].gapAfterMs = 0; // no trailing pause after the lesson's last cue
  return out;
}

export default function AudioDojo({ language = 'es' }) {
  const { lang } = useLang();
  const { engine } = useNarrator(); // reflect the global SYSTEM NARRATION ENGINE state
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
        const lessonNumber = Number(p.lesson_number) || 1;
        const total = lessonFragments(language, lessonNumber).length;
        setLesson(lessonNumber);
        setResumeSeq(Math.min(Math.max(Number(p.last_fragment_seq) || 0, 0), Math.max(total - 1, 0)));
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
    warmUpAudioPlayback(); // unlock HTMLMediaElement autoplay INSIDE the tap gesture
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

      {/* Engine awareness: the stitch drill is intrinsically native-baked (Zero-API
          law + native-pronunciation pedagogy), so it reflects the toggle honestly
          rather than degrading to a synthetic voice reading foreign text. */}
      <div className={`dojo-engine${engine === 'akeem' ? ' is-akeem' : ''}`} data-testid="dojo-engine-note">
        {engine === 'akeem' ? tr.engAkeem : tr.engNatural}
      </div>

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
