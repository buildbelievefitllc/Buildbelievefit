// src/components/command/CoachLab.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Coach Lab — the BBF Lab Continuous Knowledge Ecosystem (admin-only).
//
// "Sharpen your iron." A founder-only engine for staying current as the exercise
// science evolves, built as a §10 modular deck of four pillars:
//   01 Research Vault   — LIVE. Paste study text → Claude structures a coaching
//                         summary → saved as a flip Research Card. (ResearchVault)
//   02 Kinesiology Lab  — Phase 2. Gamified spaced-repetition science drills.
//   03 Coach's Arena    — Phase 2. Client case-study simulator + scored critique.
//   04 Broadcast Hub    — Phase 2. Vault entries → client-ready newsletters.
//
// The whole /command route is AdminGuard-gated, so the Lab is sealed to the head
// coach. Chrome localizes EN·ES·PT off the global LanguageContext (LAB_L10N).

import { useState } from 'react';
import { useLang } from '../../context/LangContext.jsx';
import { LockIcon } from '../vault/icons.jsx';
import ResearchVault from './ResearchVault.jsx';
import './coachLab.css';

const PILLARS = [
  { key: 'research', status: 'live' },
  { key: 'kinesiology', status: 'soon' },
  { key: 'arena', status: 'soon' },
  { key: 'broadcast', status: 'soon' },
];

// Trilingual chrome. EN is the ground truth; ES/PT are faithful translations.
const LAB_L10N = {
  en: {
    kicker: 'Continuous Knowledge Ecosystem',
    title: 'Coach Lab',
    sub: 'Sharpen your iron. A private engine to keep your coaching current as the exercise science evolves — ingest the research, drill the science, pressure-test your protocols.',
    lockChip: 'Gated to Admin',
    statusLine: '1 of 4 pillars live · 3 coming online',
    decksKicker: 'The Four Pillars',
    soonBadge: 'Phase 2',
    soonNote: 'This pillar is on the build path. Here is what it will do:',
    pillars: {
      research: { label: 'Research Vault', tagline: 'Ingest & summarize the science.',
        body: 'Paste a PubMed abstract, lecture slide, or textbook passage. Claude returns a clean, coaching-oriented summary — physiology takeaways, gym application, and the study’s pitfalls — saved as a flip card.' },
      kinesiology: { label: 'Kinesiology Lab', tagline: 'Gamified spaced-repetition drills.',
        body: 'Match-madness muscle↔action drills and rapid bioenergetic true/false, scored into a 1–5 mastery box with spaced repetition — collegiate exercise science, gamified.' },
      arena: { label: 'Coach’s Arena', tagline: 'Client case-study simulator.',
        body: 'Claude generates a randomized client case (youth point guard post-ankle-sprain, desk-bound exec with shoulder impingement). You submit a protocol; it returns a scored critique against NASM / NSCA guidelines.' },
      broadcast: { label: 'Broadcast Hub', tagline: 'Knowledge → client value.',
        body: 'Select 2–3 Research Vault entries and Claude synthesizes them into a client-ready newsletter or brief — copy-paste Markdown or HTML, zero overhead.' },
    },
    vault: {
      composerLabel: 'Paste study text to summarize',
      placeholder: 'Paste a PubMed abstract, lecture slide, or textbook passage here… (40+ characters)',
      categoryLabel: 'Category',
      categoryAuto: 'Auto-detect category',
      categoryLabels: { biomechanics: 'Biomechanics', bioenergetics: 'Bioenergetics', nutrition: 'Nutrition', 'pediatric-athletics': 'Pediatric Athletics' },
      summarizeBtn: 'Summarize & Save',
      summarizing: 'Summarizing…',
      composerNote: 'Claude structures it into a coaching card — takeaways, gym application, and the study’s limitations.',
      errorPrefix: 'Error',
      loading: 'Loading your research vault…',
      emptyTitle: 'Your vault is empty',
      emptySub: 'Paste your first study above. It becomes a flip card you can study at a glance.',
      applicationLabel: 'Coaching Application',
      takeawaysLabel: 'Physiology Takeaways',
      pitfallsLabel: 'Scientific Pitfalls',
      flipHint: 'Tap to flip',
      flipBack: 'Back to application',
      deleteLabel: 'Delete card',
    },
  },
  es: {
    kicker: 'Ecosistema de Conocimiento Continuo',
    title: 'Coach Lab',
    sub: 'Afila tu hierro. Un motor privado para mantener tu coaching al día mientras evoluciona la ciencia del ejercicio — ingiere la investigación, entrena la ciencia, pon a prueba tus protocolos.',
    lockChip: 'Solo Administrador',
    statusLine: '1 de 4 pilares activos · 3 en camino',
    decksKicker: 'Los Cuatro Pilares',
    soonBadge: 'Fase 2',
    soonNote: 'Este pilar está en la ruta de construcción. Esto es lo que hará:',
    pillars: {
      research: { label: 'Bóveda de Investigación', tagline: 'Ingiere y resume la ciencia.',
        body: 'Pega un resumen de PubMed, una diapositiva o un pasaje de libro. Claude devuelve un resumen claro y orientado al coaching — claves fisiológicas, aplicación en el gimnasio y las limitaciones del estudio — guardado como tarjeta.' },
      kinesiology: { label: 'Laboratorio de Kinesiología', tagline: 'Repetición espaciada gamificada.',
        body: 'Juegos de emparejar músculo↔acción y verdadero/falso bioenergético rápido, puntuados en una caja de maestría 1–5 con repetición espaciada — ciencia del ejercicio, gamificada.' },
      arena: { label: 'Arena del Coach', tagline: 'Simulador de casos de clientes.',
        body: 'Claude genera un caso aleatorio (base juvenil tras esguince de tobillo, ejecutivo con pinzamiento de hombro). Envías tu protocolo; devuelve una crítica puntuada según NASM / NSCA.' },
      broadcast: { label: 'Centro de Difusión', tagline: 'Conocimiento → valor para el cliente.',
        body: 'Selecciona 2–3 entradas de la bóveda y Claude las sintetiza en un boletín listo para el cliente — Markdown o HTML para copiar y pegar, sin esfuerzo.' },
    },
    vault: {
      composerLabel: 'Pega el texto del estudio para resumir',
      placeholder: 'Pega aquí un resumen de PubMed, una diapositiva o un pasaje de libro… (40+ caracteres)',
      categoryLabel: 'Categoría',
      categoryAuto: 'Detectar categoría automáticamente',
      categoryLabels: { biomechanics: 'Biomecánica', bioenergetics: 'Bioenergética', nutrition: 'Nutrición', 'pediatric-athletics': 'Atletismo Pediátrico' },
      summarizeBtn: 'Resumir y Guardar',
      summarizing: 'Resumiendo…',
      composerNote: 'Claude lo estructura en una tarjeta de coaching — claves, aplicación en el gimnasio y las limitaciones del estudio.',
      errorPrefix: 'Error',
      loading: 'Cargando tu bóveda de investigación…',
      emptyTitle: 'Tu bóveda está vacía',
      emptySub: 'Pega tu primer estudio arriba. Se convierte en una tarjeta que estudias de un vistazo.',
      applicationLabel: 'Aplicación de Coaching',
      takeawaysLabel: 'Claves Fisiológicas',
      pitfallsLabel: 'Limitaciones Científicas',
      flipHint: 'Toca para girar',
      flipBack: 'Volver a la aplicación',
      deleteLabel: 'Eliminar tarjeta',
    },
  },
  pt: {
    kicker: 'Ecossistema de Conhecimento Contínuo',
    title: 'Coach Lab',
    sub: 'Afie seu ferro. Um motor privado para manter seu coaching atualizado enquanto a ciência do exercício evolui — ingira a pesquisa, treine a ciência, teste seus protocolos.',
    lockChip: 'Apenas Administrador',
    statusLine: '1 de 4 pilares ativos · 3 chegando',
    decksKicker: 'Os Quatro Pilares',
    soonBadge: 'Fase 2',
    soonNote: 'Este pilar está no caminho de construção. Eis o que ele fará:',
    pillars: {
      research: { label: 'Cofre de Pesquisa', tagline: 'Ingira e resuma a ciência.',
        body: 'Cole um resumo do PubMed, um slide de aula ou um trecho de livro. Claude devolve um resumo claro e voltado ao coaching — pontos fisiológicos, aplicação na academia e as limitações do estudo — salvo como cartão.' },
      kinesiology: { label: 'Laboratório de Cinesiologia', tagline: 'Repetição espaçada gamificada.',
        body: 'Jogos de combinar músculo↔ação e verdadeiro/falso bioenergético rápido, pontuados numa caixa de maestria 1–5 com repetição espaçada — ciência do exercício, gamificada.' },
      arena: { label: 'Arena do Coach', tagline: 'Simulador de casos de clientes.',
        body: 'Claude gera um caso aleatório (armador juvenil pós-entorse de tornozelo, executivo com impacto no ombro). Você envia seu protocolo; ele devolve uma crítica pontuada segundo NASM / NSCA.' },
      broadcast: { label: 'Central de Transmissão', tagline: 'Conhecimento → valor para o cliente.',
        body: 'Selecione 2–3 entradas do cofre e Claude as sintetiza num boletim pronto para o cliente — Markdown ou HTML para copiar e colar, sem esforço.' },
    },
    vault: {
      composerLabel: 'Cole o texto do estudo para resumir',
      placeholder: 'Cole aqui um resumo do PubMed, um slide de aula ou um trecho de livro… (40+ caracteres)',
      categoryLabel: 'Categoria',
      categoryAuto: 'Detectar categoria automaticamente',
      categoryLabels: { biomechanics: 'Biomecânica', bioenergetics: 'Bioenergética', nutrition: 'Nutrição', 'pediatric-athletics': 'Atletismo Pediátrico' },
      summarizeBtn: 'Resumir e Salvar',
      summarizing: 'Resumindo…',
      composerNote: 'Claude o estrutura num cartão de coaching — pontos, aplicação na academia e as limitações do estudo.',
      errorPrefix: 'Erro',
      loading: 'Carregando seu cofre de pesquisa…',
      emptyTitle: 'Seu cofre está vazio',
      emptySub: 'Cole seu primeiro estudo acima. Ele vira um cartão que você estuda num relance.',
      applicationLabel: 'Aplicação no Coaching',
      takeawaysLabel: 'Pontos Fisiológicos',
      pitfallsLabel: 'Limitações Científicas',
      flipHint: 'Toque para virar',
      flipBack: 'Voltar à aplicação',
      deleteLabel: 'Excluir cartão',
    },
  },
};

export default function CoachLab() {
  const { lang } = useLang();
  const L = LAB_L10N[lang] || LAB_L10N.en;
  const [activeKey, setActiveKey] = useState('research');
  const active = PILLARS.find((p) => p.key === activeKey) || PILLARS[0];

  return (
    <div className="cl" data-testid="coach-lab-module">
      <section className="cl-hero">
        <div className="cl-hero-glow" aria-hidden="true" />
        <span className="cl-lockchip"><LockIcon size={11} /> {L.lockChip}</span>
        <div className="cl-kicker">{L.kicker}</div>
        <h2 className="cl-title">{L.title}</h2>
        <p className="cl-sub">{L.sub}</p>
        <div className="cl-status"><span className="cl-status-dot" aria-hidden="true" /> {L.statusLine}</div>
      </section>

      <section className="cl-decks">
        <div className="cl-decks-kicker">{L.decksKicker}</div>
        <div className="cl-tabbar" role="tablist" aria-label={L.decksKicker}>
          {PILLARS.map((p, i) => {
            const isActive = p.key === active.key;
            const P = L.pillars[p.key];
            return (
              <button
                key={p.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`cl-tab${isActive ? ' is-active' : ''}`}
                onClick={() => setActiveKey(p.key)}
                data-testid={`cl-pillar-${p.key}`}
              >
                <span className="cl-tab-idx">0{i + 1}</span>
                <span className="cl-tab-text">
                  <span className="cl-tab-label">{P.label}</span>
                  <span className="cl-tab-tagline">{P.tagline}</span>
                </span>
                {p.status === 'soon' ? <span className="cl-tab-soon">{L.soonBadge}</span> : <span className="cl-tab-live" aria-hidden="true" />}
              </button>
            );
          })}
        </div>

        <div className="cl-panel" role="tabpanel" key={active.key}>
          {active.status === 'live'
            ? <ResearchVault L={L} />
            : <PillarSoon L={L} pillarKey={active.key} />}
        </div>
      </section>
    </div>
  );
}

function PillarSoon({ L, pillarKey }) {
  const P = L.pillars[pillarKey];
  return (
    <div className="cl-soon" data-testid={`cl-soon-${pillarKey}`}>
      <div className="cl-soon-badge">{L.soonBadge}</div>
      <h3 className="cl-soon-title">{P.label}</h3>
      <p className="cl-soon-tagline">{P.tagline}</p>
      <p className="cl-soon-note">{L.soonNote}</p>
      <p className="cl-soon-body">{P.body}</p>
    </div>
  );
}
