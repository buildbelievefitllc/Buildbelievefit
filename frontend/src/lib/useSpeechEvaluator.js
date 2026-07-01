// src/lib/useSpeechEvaluator.js
// ─────────────────────────────────────────────────────────────────────────────
// Browser-native pronunciation evaluator for the Language Mastery Protocol's
// Voice Studio (Pillar 2 of the BBF Lab gamified-language directive). Zero API
// key, zero cost: it drives the device's built-in webkitSpeechRecognition engine
// and scores the spoken transcript against a target phrase with a word-by-word
// diff. Mirrors the token-free philosophy of speechFallback.js (which owns the
// TTS half via window.speechSynthesis).
//
// No mocks — per the directive, this runs the real SpeechRecognition API where
// the platform exposes it, and fail-closes (supported:false) where it does not
// so the UI can show a graceful "voice unsupported" notice instead of throwing.

import { useCallback, useEffect, useRef, useState } from 'react';

// BBF lang code → BCP-47 locale for the recognizer. es-MX / pt-BR per the spec
// (Latin-American Spanish + Brazilian Portuguese are the CEO's target dialects).
const RECOG_LANG = { es: 'es-MX', pt: 'pt-BR', en: 'en-US' };

// Strip accents, punctuation and case so "isquiotibiales" matches "Isquiotibiales,"
// and "está" matches "esta" — pronunciation practice should not be failed by a
// transcriber's missing diacritic. Folding keeps the scoring about the SOUNDS.
function normalize(str) {
  return String(str ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')        // drop combining accents
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?¿¡"'’“”]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Compare a target phrase against what was actually spoken. Returns a 0–100 score
// and a per-word match map so the UI can color each word green (matched) or red
// (missed). Uses a consume-once multiset so repeated target words aren't all
// satisfied by a single spoken token.
export function comparePhrases(original, spoken) {
  const origWords = normalize(original).split(' ').filter(Boolean);
  const spokenPool = normalize(spoken).split(' ').filter(Boolean);
  const pool = [...spokenPool];

  let matched = 0;
  const words = origWords.map((text) => {
    const idx = pool.indexOf(text);
    const hit = idx !== -1;
    if (hit) { pool.splice(idx, 1); matched += 1; }
    return { text, matched: hit };
  });

  const score = origWords.length ? Math.round((matched / origWords.length) * 100) : 0;
  return { score, words, matchedCount: matched, totalCount: origWords.length };
}

export function speechRecognitionSupported() {
  return typeof window !== 'undefined'
    && (typeof window.webkitSpeechRecognition !== 'undefined'
      || typeof window.SpeechRecognition !== 'undefined');
}

// React hook wrapping a single SpeechRecognition session. The recognizer is
// instantiated lazily on start() (inside the user gesture) and torn down on stop()
// / unmount so we never leak a hot microphone. Exposes live + final transcript so
// the wave UI can show interim words while speaking.
export function useSpeechEvaluator(lang = 'es') {
  const [supported] = useState(speechRecognitionSupported);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const recogRef = useRef(null);

  const stop = useCallback(() => {
    const r = recogRef.current;
    if (r) { try { r.stop(); } catch { /* already stopped */ } }
    setListening(false);
  }, []);

  const start = useCallback(() => {
    if (!supported) { setError('unsupported'); return; }
    // Tear down any previous session before opening a new one.
    if (recogRef.current) { try { recogRef.current.abort(); } catch { /* noop */ } }

    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recog = new Ctor();
    recog.lang = RECOG_LANG[lang] || RECOG_LANG.es;
    recog.interimResults = true;
    recog.continuous = false;
    recog.maxAlternatives = 1;

    setTranscript('');
    setInterim('');
    setError(null);

    recog.onresult = (event) => {
      let finalText = '';
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const res = event.results[i];
        if (res.isFinal) finalText += res[0].transcript;
        else interimText += res[0].transcript;
      }
      if (finalText) setTranscript((prev) => (prev ? `${prev} ${finalText}` : finalText).trim());
      setInterim(interimText);
    };
    recog.onerror = (ev) => {
      // 'no-speech' / 'aborted' are benign user-flow outcomes, not failures.
      if (ev?.error && ev.error !== 'no-speech' && ev.error !== 'aborted') {
        setError(ev.error);
      }
      setListening(false);
    };
    recog.onend = () => { setListening(false); setInterim(''); };

    try {
      recog.start();
      recogRef.current = recog;
      setListening(true);
      setRetryCount(0);
    } catch {
      setError('start_failed');
      setListening(false);
    }
  }, [lang, supported]);

  const reset = useCallback(() => { setTranscript(''); setInterim(''); setError(null); }, []);

  const retry = useCallback(() => {
    setRetryCount((r) => r + 1);
    start();
  }, [start]);

  // Safety net: kill the recognizer if the component unmounts mid-listen.
  useEffect(() => () => {
    const r = recogRef.current;
    if (r) { try { r.abort(); } catch { /* noop */ } }
  }, []);

  return { supported, listening, transcript, interim, error, start, stop, reset, retry, retryCount };
}
