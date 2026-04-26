// ═══════════════════════════════════════════════════════════════════
// COMLINK-ENGINE.JS — Phantom Comlink (Phase 4)
// Secure asynchronous video-drop communication system between the
// Client and the Architect. Pure client-side persistence via
// localStorage + BBF_SYNC.patchUserFields for cloud mirroring.
//
// Data flow:
//   CLIENT  → BBF_COMLINK.sendSOS(text, audio) writes sos_outbox
//   MM      → BBF_COMLINK.fetchPendingSOSQueue() aggregates across
//             all local users (dev workstation / trainer view)
//   MM      → BBF_COMLINK.deployReply(targetUid, {videoId, note})
//             writes architect_comlink_intercept on the client row
//   CLIENT  → BBF_COMLINK.peekIntercept(uid) runs on dashboard load
//             → if present, full-screen takeover renders
//   CLIENT  → BBF_COMLINK.dismissIntercept(uid) clears the flag
//
// This is the UI + contract layer. Real cross-user cloud relay is a
// downstream sprint; metadata rides bbf_users via patchUserFields.
// ═══════════════════════════════════════════════════════════════════

var BBF_COMLINK = (function() {
  'use strict';

  // ── PRE-RECORDED CLINICAL VIDEO LIBRARY ──────────────────────────
  // Mirrors the MOBILITY_PRESCRIPTIONS ladder in auditor-engine.js +
  // adds two high-level Architect drops. Each entry carries duration,
  // accent colour, and a 3-language title. poster_color drives the
  // SVG title-card placeholder until real video assets are uploaded.
  var VIDEO_LIBRARY = [
    {
      id: 'lumbar-decomp',
      duration: '4:12',
      poster_color: '#6A0DAD',
      en: 'Lumbar Decompression Protocol',
      es: 'Protocolo de Descompresi\u00f3n Lumbar',
      pt: 'Protocolo de Descompress\u00e3o Lombar'
    },
    {
      id: 'thoracic-reset',
      duration: '5:30',
      poster_color: '#4A0880',
      en: 'Thoracic Extension & Posterior Chain Reset',
      es: 'Extensi\u00f3n Tor\u00e1cica y Reset de Cadena Posterior',
      pt: 'Extens\u00e3o Tor\u00e1cica e Reset de Cadeia Posterior'
    },
    {
      id: 'rotator-cuff',
      duration: '4:45',
      poster_color: '#2D0555',
      en: 'Rotator Cuff Reset & Thoracic Mobility',
      es: 'Reset del Manguito Rotador y Movilidad Tor\u00e1cica',
      pt: 'Reset do Manguito Rotador e Mobilidade Tor\u00e1cica'
    },
    {
      id: 'cns-recovery',
      duration: '7:20',
      poster_color: '#1E0340',
      en: 'CNS Recovery Protocol',
      es: 'Protocolo de Recuperaci\u00f3n del SNC',
      pt: 'Protocolo de Recupera\u00e7\u00e3o do SNC'
    },
    {
      id: 'mobility-flow',
      duration: '6:00',
      poster_color: '#110128',
      en: '6-Minute Sovereign Mobility Flow',
      es: 'Flujo de Movilidad Soberana de 6 Minutos',
      pt: 'Fluxo de Mobilidade Soberana de 6 Minutos'
    }
  ];

  var SOS_MAX_CHARS          = 280;
  var SOS_OUTBOX_LIMIT        = 10;   // keep last 10 SOSes per user
  var RECORDING_MAX_MS        = 30000; // 30-second cap

  // ── LOCAL STORE HELPERS ──────────────────────────────────────────
  function _readStore() {
    try { return JSON.parse(localStorage.getItem('bbf_v7') || '{}') || {}; }
    catch(_) { return {}; }
  }
  function _writeStore(d) {
    try { localStorage.setItem('bbf_v7', JSON.stringify(d)); } catch(_) {}
  }
  function _ensureUser(d, uid) {
    if (!d.u) d.u = {};
    if (!d.u[uid]) d.u[uid] = {};
    return d.u[uid];
  }
  function _now() { return new Date().toISOString(); }
  function _uid() {
    if (typeof VC !== 'undefined' && VC) return VC;
    if (typeof CU !== 'undefined' && CU) return CU;
    return null;
  }
  function _lang() {
    return (typeof BBF_LANG !== 'undefined' && BBF_LANG.get) ? BBF_LANG.get() : 'en';
  }

  // ── VIDEO LIBRARY LOOKUP + POSTER GEN ────────────────────────────
  function getVideoById(videoId) {
    for (var i = 0; i < VIDEO_LIBRARY.length; i++) {
      if (VIDEO_LIBRARY[i].id === videoId) return VIDEO_LIBRARY[i];
    }
    return null;
  }

  // Synthetic poster: SVG data-URI with the protocol title over the
  // assigned brand-ramp colour. Used as <video poster="...">
  // until real video assets exist in Supabase Storage.
  function getPosterDataUri(videoId) {
    var v = getVideoById(videoId);
    if (!v) return '';
    var title = v[_lang()] || v.en;
    // Split long titles into two lines at the first ampersand or dash.
    var lineBreak = title.indexOf(' & ');
    var line1 = lineBreak > -1 ? title.substring(0, lineBreak) : title;
    var line2 = lineBreak > -1 ? title.substring(lineBreak + 3) : '';
    var svg =
      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 640 360'>" +
        "<defs><linearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'>" +
          "<stop offset='0%25' stop-color='#0a0a0a'/>" +
          "<stop offset='60%25' stop-color='" + v.poster_color + "'/>" +
          "<stop offset='100%25' stop-color='#0a0a0a'/>" +
        "</linearGradient></defs>" +
        "<rect width='640' height='360' fill='url(%23g)'/>" +
        "<rect x='16' y='16' width='24' height='24' fill='none' stroke='%23D4AF37' stroke-width='2'/>" +
        "<rect x='600' y='320' width='24' height='24' fill='none' stroke='%23D4AF37' stroke-width='2'/>" +
        "<text x='320' y='" + (line2 ? 170 : 190) + "' font-family='Bebas Neue, Impact, sans-serif' font-size='34' font-weight='400' fill='%23F5C800' text-anchor='middle' letter-spacing='3'>" +
          encodeURIComponent(line1.toUpperCase()).replace(/'/g, "%27") +
        "</text>" +
        (line2 ? "<text x='320' y='210' font-family='Bebas Neue, Impact, sans-serif' font-size='34' font-weight='400' fill='%23F5C800' text-anchor='middle' letter-spacing='3'>" +
          encodeURIComponent(line2.toUpperCase()).replace(/'/g, "%27") + "</text>" : '') +
        "<text x='320' y='260' font-family='Barlow Condensed, sans-serif' font-size='13' font-weight='700' fill='rgba(255,255,255,0.6)' text-anchor='middle' letter-spacing='4'>THE%20ARCHITECT%20%E2%80%A2%20" + v.duration + "</text>" +
      "</svg>";
    return 'data:image/svg+xml;utf8,' + svg;
  }

  // ── CLIENT: SOS SEND / LIST ──────────────────────────────────────
  function sendSOS(text, audioMeta) {
    var uid = _uid();
    if (!uid) return { ok: false, error: 'no active user' };
    text = String(text || '').trim().slice(0, SOS_MAX_CHARS);
    if (!text && !(audioMeta && audioMeta.url)) {
      return { ok: false, error: 'SOS must contain text or voice note' };
    }
    var sos = {
      id:         'sos_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      user_id:    uid,
      text:       text,
      audio_url:  (audioMeta && audioMeta.url) || null,
      duration_sec: (audioMeta && audioMeta.duration_sec) || 0,
      created_at: _now(),
      status:     'pending_architect'
    };
    var d = _readStore();
    var u = _ensureUser(d, uid);
    if (!Array.isArray(u.sos_outbox)) u.sos_outbox = [];
    u.sos_outbox.push(sos);
    if (u.sos_outbox.length > SOS_OUTBOX_LIMIT) {
      u.sos_outbox = u.sos_outbox.slice(-SOS_OUTBOX_LIMIT);
    }
    u.last_sos_at = sos.created_at;
    _writeStore(d);

    // Mirror to bbf_users so the architect's separate workstation
    // can pick it up. Non-blocking.
    if (typeof BBF_SYNC !== 'undefined' && BBF_SYNC.patchUserFields) {
      BBF_SYNC.patchUserFields(uid, {
        sos_outbox:   u.sos_outbox,
        last_sos_at:  sos.created_at
      }).catch(function(){});
    }
    return { ok: true, sos: sos };
  }

  function listSOS(userId) {
    userId = userId || _uid();
    if (!userId) return [];
    var d = _readStore();
    return (d.u && d.u[userId] && d.u[userId].sos_outbox) || [];
  }

  // ── MASTERMIND: AGGREGATED SOS QUEUE ─────────────────────────────
  // Returns flat list of pending-architect SOSes across every user
  // in the local cache. In a full deployment this would query
  // bbf_users WHERE last_sos_at > [last check]; the client-local
  // aggregation is correct for the trainer's workstation.
  function fetchPendingSOSQueue() {
    var d = _readStore();
    var out = [];
    if (!d.u) return out;
    Object.keys(d.u).forEach(function(uid){
      var u = d.u[uid] || {};
      if (u.role === 'trainer') return;
      (u.sos_outbox || []).forEach(function(sos){
        if (sos.status !== 'pending_architect') return;
        out.push(Object.assign({}, sos, {
          client_name: u.name || uid,
          client_id:   uid
        }));
      });
    });
    out.sort(function(a, b){
      return (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0);
    });
    return out;
  }

  // ── ARCHITECT: DEPLOY REPLY ──────────────────────────────────────
  function deployReply(targetUid, opts) {
    opts = opts || {};
    if (!targetUid) return { ok: false, error: 'no target' };
    var video = getVideoById(opts.videoId);
    if (!video) return { ok: false, error: 'unknown video id' };
    var intercept = {
      id:          'int_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      deployed_at: _now(),
      video_id:    video.id,
      video_title: video[_lang()] || video.en,
      video_duration: video.duration,
      video_poster: getPosterDataUri(video.id),
      note:        String(opts.note || '').trim().slice(0, 400),
      deployed_by: _uid() || 'architect',
      status:      'pending_view',
      sos_id:      opts.sosId || null
    };

    var d = _readStore();
    var target = _ensureUser(d, targetUid);
    target.architect_comlink_intercept = intercept;

    // Mark the originating SOS as answered if referenced.
    if (opts.sosId && Array.isArray(target.sos_outbox)) {
      for (var i = 0; i < target.sos_outbox.length; i++) {
        if (target.sos_outbox[i].id === opts.sosId) {
          target.sos_outbox[i].status = 'architect_replied';
          target.sos_outbox[i].replied_at = intercept.deployed_at;
          break;
        }
      }
    }
    _writeStore(d);

    if (typeof BBF_SYNC !== 'undefined' && BBF_SYNC.patchUserFields) {
      BBF_SYNC.patchUserFields(targetUid, {
        architect_comlink_intercept: intercept,
        sos_outbox:                  target.sos_outbox || []
      }).catch(function(){});
    }
    return { ok: true, intercept: intercept };
  }

  // ── CLIENT: INTERCEPT PEEK + DISMISS ─────────────────────────────
  function peekIntercept(userId) {
    userId = userId || _uid();
    if (!userId) return null;
    var d = _readStore();
    var u = (d.u && d.u[userId]) || {};
    var intercept = u.architect_comlink_intercept;
    if (!intercept || intercept.status !== 'pending_view') return null;
    return intercept;
  }

  function dismissIntercept(userId) {
    userId = userId || _uid();
    if (!userId) return { ok: false };
    var d = _readStore();
    var u = _ensureUser(d, userId);
    if (u.architect_comlink_intercept) {
      u.architect_comlink_intercept.status     = 'viewed';
      u.architect_comlink_intercept.viewed_at  = _now();
    }
    _writeStore(d);
    if (typeof BBF_SYNC !== 'undefined' && BBF_SYNC.patchUserFields) {
      BBF_SYNC.patchUserFields(userId, {
        architect_comlink_intercept: u.architect_comlink_intercept
      }).catch(function(){});
    }
    return { ok: true };
  }

  return {
    VIDEO_LIBRARY:        VIDEO_LIBRARY,
    SOS_MAX_CHARS:        SOS_MAX_CHARS,
    RECORDING_MAX_MS:     RECORDING_MAX_MS,
    getVideoById:         getVideoById,
    getPosterDataUri:     getPosterDataUri,
    sendSOS:              sendSOS,
    listSOS:              listSOS,
    fetchPendingSOSQueue: fetchPendingSOSQueue,
    deployReply:          deployReply,
    peekIntercept:        peekIntercept,
    dismissIntercept:     dismissIntercept
  };

})();
