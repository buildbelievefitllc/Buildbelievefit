// src/components/command/CoachArena.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Coach Lab · Pillar 3 — The Coach's Arena (client case-study simulator).
//
// Default path: draw a case from the hardwired ARENA_CASES deck (zero API
// calls). "Generate via AI" is an explicit fallback that calls Claude
// (bbf-coach-arena) for a fresh one once the ten-case deck runs thin. Either
// way, you write the protocol and get a scored critique (vs NASM / NSCA) from
// Claude — that part always stays live. A sparring drill; nothing persisted.
// Founder-only (the /command route gates it).

import { useRef, useState } from 'react';
import { useLang } from '../../context/LangContext.jsx';
import { generateCase, critiqueProtocol } from '../../lib/coachLabApi.js';
import { ARENA_CASES } from './coachArenaCases.js';

function shuffled(n) {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const ARENA_L10N = {
  en: {
    intro: 'Pressure-test your decision-making. Draw a case from the deck; you write the protocol; Claude scores you against the guidelines.',
    generate: 'Generate a case', generating: 'Building case…',
    generateAI: 'Generate via AI', generatingAI: 'Asking Claude…',
    newCase: 'New case', caseKicker: 'Client Case',
    sourceLocal: 'Deck', sourceAI: 'AI-Generated',
    age: 'Age', trainingAge: 'Experience', goal: 'Primary goal', constraints: 'Constraints', limitations: 'Biomechanical limitations', theAsk: 'The ask',
    protocolLabel: 'Your protocol', protocolPlaceholder: 'Write your training / nutrition protocol — exercise selection, loading, progression, regressions, and your reasoning… (30+ characters)',
    submit: 'Submit for critique', critiquing: 'Scoring your protocol…',
    scoreLabel: 'Protocol Score', verdictLabel: 'Verdict', strengths: 'Strengths', gaps: 'Gaps & Risks', refs: 'Science References', next: 'Sharpen Next',
    errorPrefix: 'Error',
  },
  es: {
    intro: 'Pon a prueba tu toma de decisiones. Saca un caso del mazo; tú escribes el protocolo; Claude te puntúa según las guías.',
    generate: 'Generar un caso', generating: 'Creando caso…',
    generateAI: 'Generar con IA', generatingAI: 'Preguntando a Claude…',
    newCase: 'Nuevo caso', caseKicker: 'Caso de Cliente',
    sourceLocal: 'Mazo', sourceAI: 'Generado por IA',
    age: 'Edad', trainingAge: 'Experiencia', goal: 'Objetivo principal', constraints: 'Restricciones', limitations: 'Limitaciones biomecánicas', theAsk: 'El reto',
    protocolLabel: 'Tu protocolo', protocolPlaceholder: 'Escribe tu protocolo de entrenamiento / nutrición — selección de ejercicios, carga, progresión, regresiones y tu razonamiento… (30+ caracteres)',
    submit: 'Enviar a crítica', critiquing: 'Puntuando tu protocolo…',
    scoreLabel: 'Puntuación', verdictLabel: 'Veredicto', strengths: 'Fortalezas', gaps: 'Vacíos y Riesgos', refs: 'Referencias Científicas', next: 'Afina lo Siguiente',
    errorPrefix: 'Error',
  },
  pt: {
    intro: 'Teste sua tomada de decisão. Tire um caso do baralho; você escreve o protocolo; Claude te pontua segundo as diretrizes.',
    generate: 'Gerar um caso', generating: 'Criando caso…',
    generateAI: 'Gerar com IA', generatingAI: 'Perguntando ao Claude…',
    newCase: 'Novo caso', caseKicker: 'Caso de Cliente',
    sourceLocal: 'Baralho', sourceAI: 'Gerado por IA',
    age: 'Idade', trainingAge: 'Experiência', goal: 'Objetivo principal', constraints: 'Restrições', limitations: 'Limitações biomecânicas', theAsk: 'O desafio',
    protocolLabel: 'Seu protocolo', protocolPlaceholder: 'Escreva seu protocolo de treino / nutrição — seleção de exercícios, carga, progressão, regressões e seu raciocínio… (30+ caracteres)',
    submit: 'Enviar para crítica', critiquing: 'Pontuando seu protocolo…',
    scoreLabel: 'Pontuação', verdictLabel: 'Veredito', strengths: 'Pontos Fortes', gaps: 'Lacunas e Riscos', refs: 'Referências Científicas', next: 'Afie o Próximo',
    errorPrefix: 'Erro',
  },
};

export default function CoachArena() {
  const { lang } = useLang();
  const L = ARENA_L10N[lang] || ARENA_L10N.en;

  const [theCase, setTheCase] = useState(null);
  const [protocol, setProtocol] = useState('');
  const [critique, setCritique] = useState(null);
  const [genBusy, setGenBusy] = useState(false);
  const [critBusy, setCritBusy] = useState(false);
  const [error, setError] = useState(null);

  // No-repeat draw queue over the hardwired deck — reshuffles once exhausted.
  const deckRef = useRef([]);
  const drawFromDeck = () => {
    if (deckRef.current.length === 0) deckRef.current = shuffled(ARENA_CASES.length);
    const idx = deckRef.current.pop();
    return { ...ARENA_CASES[idx], _source: 'local' };
  };

  const newCase = () => {
    setError(null); setCritique(null); setProtocol('');
    setTheCase(drawFromDeck());
  };

  const newCaseAI = async () => {
    setGenBusy(true); setError(null); setCritique(null); setProtocol('');
    try { setTheCase({ ...(await generateCase()), _source: 'ai' }); }
    catch (e) { setError(e.message); }
    finally { setGenBusy(false); }
  };

  const submit = async () => {
    if (protocol.trim().length < 30 || critBusy) return;
    setCritBusy(true); setError(null);
    try { setCritique(await critiqueProtocol(theCase, protocol.trim())); }
    catch (e) { setError(e.message); }
    finally { setCritBusy(false); }
  };

  if (!theCase) {
    return (
      <div className="ar" data-testid="coach-arena">
        <p className="ar-intro">{L.intro}</p>
        <div className="ar-launch-row">
          <button type="button" className="ar-generate" onClick={newCase} disabled={genBusy} data-testid="ar-generate">
            ⚔ {L.generate}
          </button>
          <button type="button" className="ar-ai-link" onClick={newCaseAI} disabled={genBusy} data-testid="ar-generate-ai">
            {genBusy ? L.generatingAI : `✨ ${L.generateAI}`}
          </button>
        </div>
        {error ? <p className="cl-err" role="alert">{L.errorPrefix}: {error}</p> : null}
      </div>
    );
  }

  const cp = theCase.client_profile || {};
  const score = critique ? Math.max(0, Math.min(100, Number(critique.accuracy_score) || 0)) : 0;

  return (
    <div className="ar" data-testid="coach-arena">
      <div className="ar-case" data-testid="ar-case">
        <div className="ar-case-head">
          <span className="ar-kicker">
            ⚔ {L.caseKicker}
            <span className={`ar-source ar-source--${theCase._source === 'ai' ? 'ai' : 'local'}`} data-testid="ar-source">
              {theCase._source === 'ai' ? L.sourceAI : L.sourceLocal}
            </span>
          </span>
          <div className="ar-case-actions">
            <button type="button" className="kl-btn" onClick={newCase} disabled={genBusy} data-testid="ar-newcase">
              {L.newCase}
            </button>
            <button type="button" className="ar-ai-link" onClick={newCaseAI} disabled={genBusy} data-testid="ar-newcase-ai">
              {genBusy ? L.generatingAI : `✨ ${L.generateAI}`}
            </button>
          </div>
        </div>
        <h3 className="ar-case-title">{theCase.scenario_title}</h3>
        <div className="ar-profile">
          <div className="ar-pf"><span className="ar-pf-lbl">{L.age}</span><span className="ar-pf-val">{cp.age}</span></div>
          <div className="ar-pf"><span className="ar-pf-lbl">{L.trainingAge}</span><span className="ar-pf-val">{cp.training_age}</span></div>
          <div className="ar-pf ar-pf--wide"><span className="ar-pf-lbl">{L.goal}</span><span className="ar-pf-val">{cp.primary_goal}</span></div>
        </div>
        <p className="ar-background">{cp.background}</p>
        <div className="ar-chips">
          {(cp.constraints || []).map((c, i) => <span key={`c${i}`} className="ar-chip ar-chip--con">{c}</span>)}
          {(cp.biomechanical_limitations || []).map((c, i) => <span key={`l${i}`} className="ar-chip ar-chip--lim">{c}</span>)}
        </div>
        <div className="ar-ask"><span className="ar-ask-lbl">{L.theAsk}</span><p>{theCase.the_ask}</p></div>
      </div>

      <div className="ar-composer">
        <label className="cl-composer-lbl" htmlFor="ar-protocol">{L.protocolLabel}</label>
        <textarea
          id="ar-protocol"
          className="cl-composer-input"
          rows={6}
          value={protocol}
          onChange={(e) => setProtocol(e.target.value)}
          placeholder={L.protocolPlaceholder}
          data-testid="ar-protocol"
        />
        <button
          type="button"
          className="cl-summarize"
          onClick={submit}
          disabled={protocol.trim().length < 30 || critBusy}
          data-testid="ar-submit"
          style={{ marginTop: '0.7rem' }}
        >
          {critBusy ? L.critiquing : L.submit}
        </button>
        {error ? <p className="cl-err" role="alert">{L.errorPrefix}: {error}</p> : null}
      </div>

      {critique ? (
        <div className="ar-score" data-testid="ar-critique">
          <div className="ar-score-head">
            <div className="kl-results-ring" style={{ '--pct': score, width: 108, height: 108 }}>
              <span className="kl-results-pct" style={{ fontSize: '1.5rem' }}>{score}</span>
            </div>
            <div>
              <div className="ar-score-lbl">{L.scoreLabel}</div>
              <div className="ar-verdict"><span className="ar-verdict-lbl">{L.verdictLabel}</span> {critique.verdict}</div>
            </div>
          </div>
          <div className="ar-cols">
            <ArList title={L.strengths} items={critique.strengths} tone="good" />
            <ArList title={L.gaps} items={critique.gaps} tone="warn" />
          </div>
          <ArList title={L.refs} items={critique.science_references} tone="ref" />
          <div className="ar-next"><span className="ar-next-lbl">{L.next}</span> {critique.next_focus}</div>
        </div>
      ) : null}
    </div>
  );
}

function ArList({ title, items, tone }) {
  return (
    <div className={`ar-list ar-list--${tone}`}>
      <div className="ar-list-lbl">{title}</div>
      <ul>
        {(items || []).map((it, i) => (
          <li key={i}><span className="ar-list-mark" aria-hidden="true">{tone === 'good' ? '✓' : tone === 'warn' ? '!' : '§'}</span>{it}</li>
        ))}
      </ul>
    </div>
  );
}
