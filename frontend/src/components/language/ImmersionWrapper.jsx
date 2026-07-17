// src/components/language/ImmersionWrapper.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 3.2 — the Immersion chat interface (LANGUAGE_MASTERY §1.4).
//
// Hooks the upgraded bbf-agentic-immersion (v2) edge function. The engine returns
// { ai_reply, grammar_correction, fluency_score, errors[], session_id, injected }.
//
// THE CONVERSATIONAL ILLUSION (hard constraint): ONLY ai_reply enters a chat
// bubble — the partner stays fully in character. The grammar_correction + the
// structured errors[] block are NEVER injected into a bubble; they surface in a
// SEPARATE, brand-styled (Purple → Gold) "Grammar Correction" instructional panel
// below the thread. Break this and the roleplay stops feeling like a real chat.
//
// AUTH: bbf-agentic-immersion is gated on the shared secret (X-BBF-Admin-Token ===
// BBF_COACH_AGENT_TOKEN) — it is a CEO/Command-Center surface (cmd-tab-language is
// admin-only). We replay the runtime-hydrated admin token via the same gateway
// header pattern rosterApi uses; without it, the panel shows a localized locked state.
//
// TRILINGUAL: all chrome resolves through useLangUiStr by preferred_locale; the
// error-cluster names localize the closed §4.4 taxonomy. The roleplay itself is in
// the target language (es/pt) — that is data, never localized away.
//
// SCAFFOLDING (Curriculum Engine · friction reduction): with scaffold=true (early
// curriculum days), the module offers GUIDED DIALOGUE options — static A/B openers
// before the first turn, then the engine's suggested_replies (v3) after every AI
// turn. Tapping an option sends it; the free-form composer stays available always.
//
// THE CAMPAIGN (Fable Fleet Sync · v4): the single hardcoded scenario is now a
// scenario PICKER over immersionScenarios.js — each scene carries a persistent
// language-native persona (the BBF Fables cast: Marisol, Doña Rosa, Dona Marta,
// Seu Chico…) threaded to the engine via the v4 `persona` param, so the same
// character meets the athlete every session. Switching scenes resets the thread
// (a new conversation with a different person). Passing a `scenario` prop pins
// legacy fixed-scenario mode: no picker, no persona.
//
// @param {{ uid?:string, scenario?:string, scenarioKey?:string, initialSceneKey?:string, targetLanguage?:'es'|'pt', phase?:number, scaffold?:boolean }} props

import { useEffect, useRef, useState } from 'react';
import { FUNCTIONS_BASE, SUPABASE_ANON_KEY } from '../../lib/supabaseClient.js';
import { getCoachAdminToken, hasAdminToken } from '../../lib/adminAuth.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLangUiStr } from './languageStrings.js';
import { IMMERSION_SCENARIOS, DEFAULT_SCENARIO_KEY, getScenario, personaCard, personaName } from './immersionScenarios.js';
import './language.css';

// Fallback openers (legacy fixed-scenario mode, where no library scene is active).
const STARTER_OPENERS = {
  es: [
    'Hola, buenas. Quiero información sobre la membresía.',
    'Buenos días. ¿Qué horarios tienen para las clases y cuánto cuesta el mes?',
  ],
  pt: [
    'Olá, tudo bem? Quero informações sobre o plano da academia.',
    'Bom dia. Quais são os horários das aulas e quanto custa a mensalidade?',
  ],
};

// Admin-token-gated POST to the immersion edge function (rosterApi gateway pattern).
async function callImmersion(body) {
  const headers = { 'Content-Type': 'application/json' };
  if (SUPABASE_ANON_KEY) { headers.apikey = SUPABASE_ANON_KEY; headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`; }
  const adminToken = getCoachAdminToken();
  if (adminToken) headers['X-BBF-Admin-Token'] = adminToken;
  try {
    const res = await fetch(`${FUNCTIONS_BASE}/bbf-agentic-immersion`, { method: 'POST', headers, body: JSON.stringify(body) });
    const raw = await res.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch { /* non-JSON body */ }
    if (!res.ok) return { ok: false, status: res.status, error: (data && data.error) || 'request_failed' };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, status: 0, error: String((e && e.message) || e) };
  }
}

export default function ImmersionWrapper({ uid, scenario, scenarioKey, initialSceneKey, targetLanguage = 'es', phase = 1, scaffold = false }) {
  const { ls, lang, clusters, targetName } = useLangUiStr();
  const { user } = useAuth();
  const effUid = uid || user?.username || user?.id || '';
  const target = targetLanguage === 'pt' ? 'pt' : 'es';

  // Legacy fixed mode (scenario prop) vs. the campaign picker (the default).
  // initialSceneKey deep-links a picker scene (The Path's "step into the scene").
  const fixedMode = typeof scenario === 'string' && scenario.trim().length > 0;
  const [sceneKey, setSceneKey] = useState(initialSceneKey || DEFAULT_SCENARIO_KEY);
  const scene = fixedMode ? null : getScenario(sceneKey);
  const scen = fixedMode ? scenario.trim() : scene.scenario;
  const partner = fixedMode ? '' : personaName(scene, target);

  const [messages, setMessages] = useState([]);      // { role:'user'|'assistant', content }
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [correction, setCorrection] = useState(null); // { grammar, errors[], fluency, injected }
  const [notice, setNotice] = useState(null);         // transient engine-offline notice
  const [suggested, setSuggested] = useState([]);     // scaffold: engine A/B next-reply options
  const endRef = useRef(null);

  // A scene swap is a NEW conversation with a different person — reset the thread.
  const pickScene = (key) => {
    if (key === sceneKey || sending) return;
    setSceneKey(key);
    setMessages([]); setSessionId(null); setCorrection(null); setNotice(null); setSuggested([]);
  };

  // Auto-scroll the thread on new turns (DOM side-effect only — no setState).
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, correction]);

  const authed = hasAdminToken();

  async function send(textOverride) {
    const text = (typeof textOverride === 'string' ? textOverride : input).trim();
    if (!text || sending || !authed) return;
    const history = messages.slice(-24); // prior turns only (this message is sent separately)
    setMessages((m) => [...m, { role: 'user', content: text }]);
    setInput('');
    setSending(true);
    setNotice(null);
    setSuggested([]);

    const res = await callImmersion({
      uid: effUid, scenario: scen,
      scenario_key: fixedMode ? (scenarioKey || scen.slice(0, 60)) : scene.key,
      persona: fixedMode ? undefined : personaCard(scene, target),
      target_language: target, user_message: text,
      conversation_history: history, session_id: sessionId, phase,
      guided: scaffold === true,
    });
    setSending(false);

    if (!res.ok) { setNotice(res.status === 401 ? ls.locked : ls.engineOffline); return; }
    const d = res.data;
    // The engine's fail-open default returns ai_reply "..." — surface it as offline.
    if (!d || typeof d.ai_reply !== 'string' || d.ai_reply === '...') { setNotice(ls.engineOffline); return; }

    setMessages((m) => [...m, { role: 'assistant', content: d.ai_reply }]);
    if (d.session_id) setSessionId(d.session_id);
    if (scaffold && Array.isArray(d.suggested_replies)) {
      setSuggested(d.suggested_replies.filter((s) => typeof s === 'string' && s.trim()).slice(0, 2));
    }
    setCorrection({
      grammar: String(d.grammar_correction || ''),
      errors: Array.isArray(d.errors) ? d.errors : [],
      fluency: Number.isFinite(d.fluency_score) ? d.fluency_score : null,
      injected: Number(d.injected) || 0,
    });
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  const perfect = correction && correction.errors.length === 0 && /^perfect\.?$/i.test(correction.grammar.trim());

  return (
    <section className="im-wrap" data-testid="immersion-wrapper" aria-label={ls.immTitle}>
      <header className="im-head">
        <span className="im-kicker">{ls.immKicker}</span>
        <div className="im-headline">
          <h3 className="im-title">{ls.immTitle}</h3>
          <span className="im-target">{ls.targetLabel}: {targetName[target]}</span>
        </div>
        {fixedMode ? (
          <div className="im-scenario"><span className="im-scenario-lbl">{ls.scenarioLabel}</span> {scen}</div>
        ) : (
          <div className="im-scenario" data-testid="im-scene-line">
            <span className="im-scenario-lbl">{ls.scenarioLabel}</span> {scene.emoji} {scene.title[lang] || scene.title.en}
            {partner ? <span className="im-partner-tag"> · {ls.withPersona(partner)}</span> : null}
          </div>
        )}
      </header>

      {/* ── THE CAMPAIGN PICKER — persistent-persona scenes (Fables cast) ── */}
      {!fixedMode ? (
        <div className="im-picker" role="radiogroup" aria-label={ls.scenePicker}>
          {IMMERSION_SCENARIOS.map((s) => (
            <button
              key={s.key}
              type="button"
              role="radio"
              aria-checked={sceneKey === s.key}
              className={`im-picker-chip${sceneKey === s.key ? ' is-active' : ''}`}
              onClick={() => pickScene(s.key)}
              disabled={sending}
              data-testid={`im-scene-${s.key}`}
              title={personaName(s, target)}
            >
              <span className="im-picker-emoji" aria-hidden="true">{s.emoji}</span>
              {s.title[lang] || s.title.en}
            </button>
          ))}
        </div>
      ) : null}

      {!authed ? (
        <div className="im-locked" role="note">{ls.locked}</div>
      ) : (
        <>
          {/* ── CHAT THREAD — ai_reply bubbles ONLY (the conversational illusion) ── */}
          <div className="im-thread">
            {messages.length === 0 ? (
              <div className="im-start-hint">{ls.startHint}</div>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={`im-bubble is-${m.role}`}>
                  <span className="im-bubble-who">{m.role === 'user' ? ls.you : (partner || ls.partner)}</span>
                  <span className="im-bubble-text">{m.content}</span>
                </div>
              ))
            )}
            {sending ? <div className="im-bubble is-assistant is-typing"><span className="im-typing-dot" /><span className="im-typing-dot" /><span className="im-typing-dot" /></div> : null}
            <div ref={endRef} />
          </div>

          {notice ? <div className="im-notice" role="status">{notice}</div> : null}

          {/* ── GRAMMAR CORRECTION PANEL — isolated, brand purple/gold, NEVER a bubble ── */}
          {correction ? (
            <div className={`im-grammar${perfect ? ' is-perfect' : ''}`} role="note" aria-live="polite">
              <div className="im-grammar-head">
                <span className="im-grammar-title">{ls.grammarPanel}</span>
                {correction.fluency != null ? (
                  <span className="im-fluency">{ls.fluencyLabel} <strong>{correction.fluency}</strong>/100</span>
                ) : null}
              </div>

              {perfect ? (
                <div className="im-grammar-perfect">{ls.perfect}</div>
              ) : (
                <>
                  <p className="im-grammar-text">{correction.grammar}</p>
                  {correction.errors.length ? (
                    <div className="im-error-chips" aria-label={ls.errorsLabel}>
                      {correction.errors.map((e, i) => (
                        <span key={`${e.term}-${i}`} className={`im-error-chip is-${e.severity === 'major' ? 'major' : 'minor'}`}>
                          <span className="im-chip-term">{e.term}</span>
                          <span className="im-chip-cluster">{clusters[e.cluster] || clusters.vocab_gap}</span>
                          <span className="im-chip-sev">{e.severity === 'major' ? ls.severityMajor : ls.severityMinor}</span>
                        </span>
                      ))}
                    </div>
                  ) : null}
                </>
              )}

              {correction.injected > 0 ? <div className="im-injected">{ls.injectedNote(correction.injected)}</div> : null}
            </div>
          ) : null}

          {/* ── GUIDED DIALOGUE SCAFFOLD — A/B structural replies (early days).
                 Openers before the first turn; engine suggestions after each AI
                 turn. Tap to send; the free-form composer below stays live. ── */}
          {scaffold && !sending && (messages.length === 0 || suggested.length > 0) ? (
            <div className="im-scaffold" data-testid="im-scaffold" role="group" aria-label={ls.scaffoldTitle}>
              <span className="im-scaffold-title">{ls.scaffoldTitle}</span>
              <div className="im-scaffold-chips">
                {(messages.length === 0
                  ? ((!fixedMode && scene.openers[target]) || STARTER_OPENERS[target] || STARTER_OPENERS.es)
                  : suggested).map((opt, i) => (
                  <button
                    key={`${i}-${opt.slice(0, 24)}`}
                    type="button"
                    className="im-sc-chip"
                    onClick={() => send(opt)}
                    data-testid="im-scaffold-chip"
                  >
                    <span className="im-sc-tag">{i === 0 ? 'A' : 'B'}</span>
                    {opt}
                  </button>
                ))}
              </div>
              <span className="im-scaffold-hint">{ls.scaffoldHint}</span>
            </div>
          ) : null}

          {/* ── COMPOSER ── */}
          <div className="im-composer">
            <textarea
              className="im-input"
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={ls.placeholder}
              disabled={sending}
              aria-label={ls.placeholder}
            />
            <button type="button" className="im-send" onClick={send} disabled={sending || !input.trim()}>
              {sending ? ls.sending : ls.send}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
