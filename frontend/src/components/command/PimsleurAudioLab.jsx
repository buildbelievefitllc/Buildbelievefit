// src/components/command/PimsleurAudioLab.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Pimsleur-style audio lesson player — Task 7 of the Language Mastery Protocol.
// Reads pimsleurAudioCurriculum.json (20 lessons) and plays each lesson's
// dialogue_flow end-to-end: narrator cues + two distinct native-speaker
// voices + timed silent "your turn" recall pauses, exactly like a physical
// Pimsleur cassette — spoken in Coach Akeem's ElevenLabs voice clone, played from
// the pre-baked static clip library (languageSoundboardVoice.js's speakBaked; see
// scripts/build-language-soundboard-cues.mjs) with a live-synth-then-browser-voice
// fallback chain for anything added after the last bake.
//
// All 20 lessons ship a fully hand-authored dialogue_flow. If a future lesson
// ever ships without one, pimsleurAudioEngine.js generates a script from just
// its vocabulary, following the same three principles (Graduated Interval
// Recall, Anticipation, Back-Chaining) the curriculum declares — so the lesson
// still plays instead of going silent.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { warmUpSpeech } from '../../lib/speechFallback.js';
import { speakBaked, warmUpAudioPlayback } from '../../lib/languageSoundboardVoice.js';
import { getLessonFlow, SPEAKER_VOICE, SPEAKER_LABEL } from '../../lib/pimsleurAudioEngine.js';
import curriculum from '../../data/pimsleurAudioCurriculum.json';
import './languageRoadmap.css';

const PROGRESS_KEY = 'bbf_pimsleur_audio_progress';
const LESSONS = curriculum.lessons;

function loadCompleted() {
  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch { return new Set(); }
}
function saveCompleted(set) {
  try { window.localStorage.setItem(PROGRESS_KEY, JSON.stringify([...set])); } catch { /* noop */ }
}

// Rate: native lines play a touch under natural pace for learner clarity; the
// English narrator stays at natural conversational pace.
function rateFor(speaker) { return speaker === 'narrator' ? 1 : 0.92; }

function speakStep(entry, isCancelled, controllerRef) {
  return new Promise((resolve) => {
    if (isCancelled()) { resolve(); return; }
    const voice = SPEAKER_VOICE[entry.speaker] || SPEAKER_VOICE.narrator;
    speakBaked({
      text: entry.text,
      lang: voice.lang,
      voiceGender: voice.voiceGender,
      rate: rateFor(entry.speaker),
      onEnd: resolve,
      onError: resolve,
    }).then((ctrl) => {
      controllerRef.current = ctrl;
      if (isCancelled()) ctrl.stop();
    }).catch(() => resolve());
  });
}

function pauseStep(seconds, isCancelled, onTick, timeoutRef) {
  return new Promise((resolve) => {
    let remaining = seconds;
    onTick(remaining);
    const tick = () => {
      if (isCancelled()) { resolve(); return; }
      remaining -= 1;
      onTick(Math.max(remaining, 0));
      if (remaining <= 0) { resolve(); return; }
      timeoutRef.current = setTimeout(tick, 1000);
    };
    timeoutRef.current = setTimeout(tick, 1000);
  });
}

// Nearest preceding non-pause line — shown as caption context during a "your
// turn" pause WITHOUT revealing the pause's own answer (it hasn't played yet).
function contextBefore(flow, idx) {
  for (let i = idx - 1; i >= 0; i -= 1) if (flow[i].speaker !== 'silent_pause') return flow[i];
  return null;
}

// Owns all playback state for exactly ONE lesson's flow. The parent mounts this
// with `key={lesson.lesson_number}` so switching lessons remounts it — a fresh
// instance starts at the correct idle state with no reset effect required (an
// effect calling setState synchronously on every lesson swap would cascade).
function useLessonPlayer(flow, onComplete) {
  const [status, setStatus] = useState('idle'); // idle | playing | done
  const [stepIndex, setStepIndex] = useState(-1);
  const [pauseRemaining, setPauseRemaining] = useState(0);
  const runIdRef = useRef(0);
  const playingRef = useRef(false);
  const controllerRef = useRef(null);
  const timeoutRef = useRef(null);

  const hardStop = useCallback(() => {
    runIdRef.current += 1;
    playingRef.current = false;
    if (controllerRef.current) { try { controllerRef.current.stop(); } catch { /* noop */ } controllerRef.current = null; }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    try { window.speechSynthesis?.cancel(); } catch { /* noop */ }
  }, []);

  // Stop any in-flight speech/timer the instant this lesson is swapped away from.
  useEffect(() => () => hardStop(), [hardStop]);

  const runFrom = useCallback((startIdx) => {
    const myRun = runIdRef.current;
    const isCancelled = () => myRun !== runIdRef.current || !playingRef.current;
    playingRef.current = true;
    setStatus('playing');

    const step = async (i) => {
      if (isCancelled()) return;
      if (i >= flow.length) { setStatus('done'); setStepIndex(-1); onComplete?.(); return; }
      setStepIndex(i);
      const entry = flow[i];
      if (entry.speaker === 'silent_pause') {
        await pauseStep(entry.duration_seconds, isCancelled, setPauseRemaining, timeoutRef);
      } else {
        setPauseRemaining(0);
        await speakStep(entry, isCancelled, controllerRef);
      }
      if (!isCancelled()) step(i + 1);
    };
    step(startIdx);
  }, [flow, onComplete]);

  const play = useCallback(() => {
    warmUpSpeech();
    warmUpAudioPlayback();
    runIdRef.current += 1;
    runFrom(stepIndex < 0 ? 0 : stepIndex);
  }, [runFrom, stepIndex]);

  const pause = useCallback(() => {
    playingRef.current = false;
    if (controllerRef.current) { try { controllerRef.current.stop(); } catch { /* noop */ } }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    setStatus('idle');
  }, []);

  const restart = useCallback(() => {
    hardStop();
    setStepIndex(-1);
    setPauseRemaining(0);
    setStatus('idle');
  }, [hardStop]);

  return { status, stepIndex, pauseRemaining, play, pause, restart };
}

function SpeakerDot({ speaker }) {
  const cls = speaker === 'narrator' ? 'lr-audio-dot--narrator'
    : speaker === 'pt_native_female' ? 'lr-audio-dot--female' : 'lr-audio-dot--male';
  return <span className={`lr-audio-dot ${cls}`} aria-hidden="true" />;
}

function PreviewSpeakBtn({ text, voice }) {
  const speak = () => {
    warmUpSpeech();
    warmUpAudioPlayback();
    speakBaked({ text, lang: voice.lang, voiceGender: voice.voiceGender, rate: rateFor('pt') }).catch(() => { /* silent */ });
  };
  return <button type="button" className="lr-speak" onClick={speak} aria-label={`Listen: ${text}`}>🔊</button>;
}

// Mounted with key={lesson.lesson_number} by the parent so every lesson switch
// gets a brand-new player instance — see the reset comment on useLessonPlayer.
function LessonPlayer({ lesson, flow, onComplete, onPrev, onNext, hasPrev, hasNext }) {
  const { status, stepIndex, pauseRemaining, play, pause, restart } = useLessonPlayer(flow, onComplete);
  const current = stepIndex >= 0 ? flow[stepIndex] : null;
  const isPause = current?.speaker === 'silent_pause';
  const promptLine = isPause ? contextBefore(flow, stepIndex) : current;
  const progressPct = flow.length ? Math.round((Math.max(stepIndex, 0) / flow.length) * 100) : 0;

  return (
    <div className="lr-audio-player">
      <div className="lr-audio-progress"><div className="lr-audio-progress-fill" style={{ width: `${progressPct}%` }} /></div>

      {status === 'done' ? (
        <div className="lr-audio-done">
          <div className="lr-audio-done-title">✓ LESSON {lesson.lesson_number} COMPLETE</div>
          {hasNext ? (
            <button type="button" className="lr-game-btn" onClick={onNext}>NEXT LESSON →</button>
          ) : (
            <div className="lr-audio-lesson-desc">All {LESSONS.length} lessons complete. Restart any lesson to drill it again.</div>
          )}
        </div>
      ) : isPause ? (
        <div className="lr-audio-pause">
          <div className="lr-audio-pause-title">🎙️ YOUR TURN — {pauseRemaining}</div>
          {promptLine ? <div className="lr-audio-pause-hint">{promptLine.text}</div> : null}
        </div>
      ) : current ? (
        <div className="lr-audio-line">
          <SpeakerDot speaker={current.speaker} />
          <div>
            <div className="lr-audio-line-speaker">{SPEAKER_LABEL[current.speaker]}</div>
            <div className="lr-audio-line-text">{current.text}</div>
          </div>
        </div>
      ) : (
        <div className="lr-audio-line-text lr-audio-idle">Press play to begin Lesson {lesson.lesson_number}.</div>
      )}

      <div className="lr-audio-controls">
        <button type="button" className="lr-game-btn" onClick={restart}>⟲ RESTART</button>
        {status === 'playing' ? (
          <button type="button" className="lr-game-btn" onClick={pause}>⏸ PAUSE</button>
        ) : (
          <button type="button" className="lr-game-btn" onClick={play} disabled={status === 'done'}>▶ {stepIndex > 0 ? 'RESUME' : 'PLAY'}</button>
        )}
        <button type="button" className="lr-game-btn" onClick={onPrev} disabled={!hasPrev}>‹ PREV</button>
        <button type="button" className="lr-game-btn" onClick={onNext} disabled={!hasNext}>NEXT ›</button>
      </div>
    </div>
  );
}

export default function PimsleurAudioLab() {
  const [completed, setCompleted] = useState(loadCompleted);
  const [lessonIdx, setLessonIdx] = useState(() => {
    const done = loadCompleted();
    const firstOpen = LESSONS.findIndex((l) => !done.has(l.lesson_number));
    return firstOpen === -1 ? 0 : firstOpen;
  });

  const lesson = LESSONS[lessonIdx];
  const priorLessons = useMemo(() => LESSONS.slice(0, lessonIdx), [lessonIdx]);
  const flow = useMemo(() => getLessonFlow(lesson, priorLessons), [lesson, priorLessons]);

  const markComplete = useCallback(() => {
    setCompleted((prev) => {
      const next = new Set(prev);
      next.add(lesson.lesson_number);
      saveCompleted(next);
      return next;
    });
  }, [lesson]);

  const goToLesson = (idx) => setLessonIdx(idx);

  return (
    <div>
      <div className="lr-section-label">TASK 7 · GRADUATED INTERVAL AUDIO</div>
      <div className="lr-section-title">PIMSLEUR <span>AUDIO LAB</span></div>
      <div className="lr-section-desc">
        {curriculum.curriculum_title.replace('BBF Lab 90-Day Language Mastery: ', '')} — a native
        male + female voice drill every phrase with back-chained pronunciation and timed
        recall pauses, spoken live in Coach Akeem's ElevenLabs voice. Put in headphones,
        press play, and answer out loud during every silence.
      </div>

      <div className="lr-stats">
        <div className="lr-stat"><div className="lr-stat-num">{LESSONS.length}</div><div className="lr-stat-label">Lessons</div></div>
        <div className="lr-stat"><div className="lr-stat-num">{completed.size}</div><div className="lr-stat-label">Completed</div></div>
        <div className="lr-stat"><div className="lr-stat-num">{lesson.duration_minutes}</div><div className="lr-stat-label">Min · This Lesson</div></div>
      </div>

      <div className="lr-chips">
        {LESSONS.map((l, idx) => (
          <button
            key={l.lesson_number}
            type="button"
            className={`lr-chip lr-chip--pt${lessonIdx === idx ? ' is-active' : ''}`}
            onClick={() => goToLesson(idx)}
          >
            {completed.has(l.lesson_number) ? '✓ ' : ''}Lesson {l.lesson_number}
          </button>
        ))}
      </div>

      <div className="lr-audio-lesson">
        <div className="lr-audio-lesson-title">{lesson.title}</div>
        <div className="lr-audio-lesson-desc">{lesson.description}</div>
      </div>

      <LessonPlayer
        key={lesson.lesson_number}
        lesson={lesson}
        flow={flow}
        onComplete={markComplete}
        onPrev={() => goToLesson(Math.max(lessonIdx - 1, 0))}
        onNext={() => goToLesson(Math.min(lessonIdx + 1, LESSONS.length - 1))}
        hasPrev={lessonIdx > 0}
        hasNext={lessonIdx < LESSONS.length - 1}
      />

      <hr className="lr-divider" />
      <div className="lr-card-title">LESSON {lesson.lesson_number} VOCABULARY</div>
      <div className="lr-vocab-grid">
        {lesson.vocabulary.map((v, i) => (
          <div className="lr-vocab-item" key={i}>
            <div>
              <div className="lr-audio-term">{v.portuguese}</div>
              <div className="lr-vocab-cat">PT-BR</div>
            </div>
            <div className="lr-vocab-rhs">
              <div className="lr-vocab-en">{v.english}</div>
              <PreviewSpeakBtn text={v.portuguese} voice={{ lang: 'pt', voiceGender: i % 2 === 0 ? 'male' : 'female' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
