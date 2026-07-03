// src/components/fitness/useBriefPlayer.js
// ─────────────────────────────────────────────────────────────────────────────
// Phase 3.4 — the morning-brief playback engine (CARDIO_AUDIO_STITCHING §3).
//
// Reads today's stitched playlist via the vault-token RPC bbf_get_brief_playlist,
// then plays the fragment array in order, inserting each fragment's gap_after_ms of
// silence before the next — the gapless-with-intended-padding sequencing the stitch
// router encodes.
//
// ⛔ ZERO-API LAW (non-negotiable): audio URLs are CONSTRUCTED, pointing only at the
// Supabase Storage public buckets (sovereign-fragments · language-fragments). This
// module NEVER calls ElevenLabs or any external TTS — it resolves storage refs and
// plays them. An unbaked fragment (no resolvable URL) is skipped, never synthesized.
//
// @typedef {Object} BriefFragment  // one sovereign_brief_playlists.playlist entry
// @property {number} seq @property {string} slot @property {string} variant_key
// @property {string|null} url @property {number} duration_ms @property {number} gap_after_ms
// @property {string} [storage_path] @property {string} [bucket]

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, FUNCTIONS_BASE } from '../../lib/supabaseClient.js';
import { getStoredVaultToken } from '../../context/AuthContext.jsx';

// Public storage base, derived from the same project URL as the functions base.
const STORAGE_BASE = String(FUNCTIONS_BASE || '').replace(/\/functions\/v1$/, '/storage/v1/object/public');

// Language fragments (Pimsleur/Vocab/Phrase keys) live in language-fragments; the
// brief/cardio fragments live in sovereign-fragments. An explicit bucket wins.
function inferBucket(item) {
  if (item.bucket) return String(item.bucket);
  const k = String(item.variant_key || item.fragment_key || item.slot || '');
  return (/^(VOC|PIM|PHR)/i.test(k) || item.kind === 'language' || item.source === 'language')
    ? 'language-fragments' : 'sovereign-fragments';
}

// ZERO-API: build a PUBLIC bucket URL for a fragment. Resolution order:
//   1. a pre-resolved public_url on the item (already a bucket URL)
//   2. a bucket-prefixed storage_path ("sovereign-fragments/<key>-<loc>.mp3")
//   3. constructed from bucket + variant_key/fragment_key (+ locale for sovereign)
// Returns null when nothing resolves (unbaked → skipped; never synthesized).
export function resolveFragmentUrl(item, locale) {
  if (!item) return null;
  const direct = String(item.url || '').trim();
  if (/^https?:\/\//i.test(direct)) return direct;
  const path = String(item.storage_path || '').trim();
  if (path) return `${STORAGE_BASE}/${path.replace(/^\/+/, '')}`;
  const bucket = inferBucket(item);
  const key = String(item.variant_key || item.fragment_key || '').trim();
  if (!key) return null;
  const file = bucket === 'language-fragments' ? `${key}.mp3` : `${key}-${locale}.mp3`;
  return `${STORAGE_BASE}/${bucket}/${file}`;
}

async function fetchPlaylist(locale) {
  const token = getStoredVaultToken();
  if (!token) return { ok: false, error: 'no_session' };
  try {
    const { data, error } = await supabase.rpc('bbf_get_brief_playlist', { p_session_token: token, p_locale: locale });
    if (error) return { ok: false, error: error.message };
    return data || { ok: false, error: 'empty' };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
}

/**
 * @param {'en'|'es'|'pt'} [locale]
 * @returns {{ loading:boolean, error:string|null, found:boolean, tone:string|null,
 *            totalDurationMs:number, segments:Array<BriefFragment&{audioUrl:string}>,
 *            status:'idle'|'playing'|'paused'|'ended', currentIndex:number,
 *            play:()=>void, pause:()=>void, replay:()=>void }}
 */
export function useBriefPlayer(locale = 'en') {
  const [meta, setMeta] = useState({ loading: true, error: null, found: false, tone: null, totalDurationMs: 0, segments: [] });
  const [status, setStatus] = useState('idle');
  const [currentIndex, setCurrentIndex] = useState(0);

  const audioRef = useRef(null);
  const idxRef = useRef(0);
  const gapRef = useRef(null);
  const segRef = useRef([]);
  const alive = useRef(true);
  // Latest-closure holders so the audio element's onended (wired once) always sees
  // fresh segment state. Assigned in a mount effect — never during render.
  const startSegRef = useRef(() => {});
  const advanceRef = useRef(() => {});

  const clearGap = useCallback(() => { if (gapRef.current) { clearTimeout(gapRef.current); gapRef.current = null; } }, []);

  // Wire the mutually-recursive sequencing closures ONCE. They read only refs +
  // stable setters, so a single assignment always operates on fresh segment state.
  useEffect(() => {
    startSegRef.current = (i) => {
      const segs = segRef.current;
      if (i >= segs.length) { setStatus('ended'); setCurrentIndex(segs.length); return; }
      idxRef.current = i; setCurrentIndex(i);
      let a = audioRef.current;
      if (!a && typeof Audio !== 'undefined') {
        a = new Audio(); a.preload = 'auto';
        a.onended = () => advanceRef.current();
        a.onerror = () => advanceRef.current(); // a missing bucket object never stalls the brief
        audioRef.current = a;
      }
      if (!a) return;
      a.src = segs[i].audioUrl;
      const p = a.play();
      if (p && typeof p.then === 'function') {
        p.then(() => { if (alive.current) setStatus('playing'); }).catch(() => { if (alive.current) advanceRef.current(); });
      } else {
        setStatus('playing');
      }
    };
    // A fragment ended → honor its gap_after_ms padding, then advance (or finish).
    advanceRef.current = () => {
      clearGap();
      const segs = segRef.current;
      const cur = idxRef.current;
      const gap = Math.max(0, Number(segs[cur]?.gap_after_ms) || 0);
      const next = cur + 1;
      if (next >= segs.length) { setStatus('ended'); setCurrentIndex(segs.length); return; }
      gapRef.current = setTimeout(() => { if (alive.current) startSegRef.current(next); }, gap);
    };
  }, [clearGap]);

  const play = useCallback(() => {
    const segs = segRef.current;
    if (!segs.length) return;
    const a = audioRef.current;
    // Resume a mid-fragment pause; otherwise (start / after end) play from the cursor.
    if (a && a.paused && a.src && a.currentTime > 0 && idxRef.current < segs.length) {
      a.play().then(() => { if (alive.current) setStatus('playing'); }).catch(() => {});
      return;
    }
    startSegRef.current(idxRef.current >= segs.length ? 0 : idxRef.current);
  }, []);

  const pause = useCallback(() => {
    clearGap();
    if (audioRef.current) audioRef.current.pause();
    setStatus('paused');
  }, [clearGap]);

  const replay = useCallback(() => { clearGap(); idxRef.current = 0; startSegRef.current(0); }, [clearGap]);

  // Fetch / resolve the playlist on mount + locale change. No synchronous setState
  // in the effect body — reset via refs, apply results in the deferred continuation.
  useEffect(() => {
    alive.current = true;
    clearGap();
    if (audioRef.current) audioRef.current.pause();
    idxRef.current = 0;

    fetchPlaylist(locale).then((res) => {
      if (!alive.current) return;
      if (!res.ok || res.found === false) {
        segRef.current = [];
        setMeta({ loading: false, error: res.ok ? null : res.error, found: false, tone: null, totalDurationMs: 0, segments: [] });
        setStatus('idle'); setCurrentIndex(0);
        return;
      }
      const arr = Array.isArray(res.playlist) ? res.playlist : [];
      // Construct each URL (Zero-API) and drop unbaked fragments (no resolvable URL).
      const resolved = arr
        .map((it) => ({ ...it, audioUrl: resolveFragmentUrl(it, res.locale || locale) }))
        .filter((s) => s.audioUrl);
      segRef.current = resolved;
      setMeta({ loading: false, error: null, found: true, tone: res.tone || null, totalDurationMs: Number(res.total_duration_ms) || 0, segments: resolved });
      setStatus('idle'); setCurrentIndex(0);
    });

    return () => { alive.current = false; clearGap(); if (audioRef.current) audioRef.current.pause(); };
  }, [locale, clearGap]);

  return { ...meta, status, currentIndex, play, pause, replay };
}
