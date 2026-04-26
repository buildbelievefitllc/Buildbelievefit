// ═══════════════════════════════════════════════════════════════
// BBF-TRANSLATOR.JS — Sovereign Science Translator
// Clinical Trilingual Engine for Advanced System Terminology
// ═══════════════════════════════════════════════════════════════

var BBF_TRANSLATOR = (function() {
  'use strict';

  var SOVEREIGN_DICTIONARY = {

    // ─── SYSTEM STATUS ─────────────────────────────────────
    'cns-titan':              { en: 'CNS Status: TITAN',                    es: 'Estado del SNC: TIT\u00c1N',                pt: 'Estado do SNC: TIT\u00c3' },
    'cns-friction':           { en: 'CNS Status: FRICTION',                 es: 'Estado del SNC: FRICCI\u00d3N',             pt: 'Estado do SNC: FRI\u00c7\u00c3O' },
    'cns-depleted':           { en: 'CNS Status: DEPLETED',                 es: 'Estado del SNC: AGOTADO',                   pt: 'Estado do SNC: ESGOTADO' },
    'central-nervous-system': { en: 'Central Nervous System',               es: 'Sistema Nervioso Central',                  pt: 'Sistema Nervoso Central' },

    // ─── SOVEREIGN PROTOCOLS ───────────────────────────────
    'adaptive-rpe':           { en: 'Adaptive RPE Commander',               es: 'Comandante RPE Adaptativo',                 pt: 'Comandante RPE Adaptativo' },
    'sovereign-shift':        { en: 'Sovereign Shift Engaged',              es: 'Cambio Soberano Activado',                  pt: 'Mudan\u00e7a Soberana Ativada' },
    'sovereign-target':       { en: 'Sovereign Target',                     es: 'Objetivo Soberano',                         pt: 'Meta Soberana' },
    'mastermind-override':    { en: 'Mastermind Override',                   es: 'Anulaci\u00f3n del Cerebro Maestro',        pt: 'Anula\u00e7\u00e3o do C\u00e9rebro Mestre' },
    'sovereign-gold':         { en: 'Sovereign Gold Standard',              es: 'Est\u00e1ndar Soberano de Oro',             pt: 'Padr\u00e3o Soberano de Ouro' },

    // ─── CLINICAL TERMINOLOGY ──────────────────────────────
    'progressive-overload':   { en: 'Progressive Overload',                 es: 'Sobrecarga Progresiva',                     pt: 'Sobrecarga Progressiva' },
    'time-under-tension':     { en: 'Time Under Tension',                   es: 'Tiempo Bajo Tensi\u00f3n',                  pt: 'Tempo Sob Tens\u00e3o' },
    'hypertrophic-range':     { en: 'Hypertrophic Efficiency Zone',         es: 'Zona de Eficiencia Hipertr\u00f3fica',      pt: 'Zona de Efici\u00eancia Hipertr\u00f3fica' },
    'axial-loading':          { en: 'Axial Loading',                        es: 'Carga Axial',                               pt: 'Carga Axial' },
    'scapular-retraction':    { en: 'Scapular Retraction',                  es: 'Retracci\u00f3n Escapular',                 pt: 'Retra\u00e7\u00e3o Escapular' },
    'kinetic-chain':          { en: 'Kinetic Chain Integrity',              es: 'Integridad de la Cadena Cin\u00e9tica',     pt: 'Integridade da Cadeia Cin\u00e9tica' },
    'lumbar-protection':      { en: 'Lumbar Spine Protection',              es: 'Protecci\u00f3n de la Columna Lumbar',       pt: 'Prote\u00e7\u00e3o da Coluna Lombar' },
    'metabolic-flexibility':  { en: 'Metabolic Flexibility',                es: 'Flexibilidad Metab\u00f3lica',              pt: 'Flexibilidade Metab\u00f3lica' },
    'biomechanical-audit':    { en: 'Biomechanical Audit',                  es: 'Auditor\u00eda Biomec\u00e1nica',           pt: 'Auditoria Biomec\u00e2nica' },
    'movement-quality':       { en: 'Movement Quality Index',               es: '\u00cdndice de Calidad de Movimiento',      pt: '\u00cdndice de Qualidade de Movimento' },

    // ─── HOUSEHOLD & LEGACY ────────────────────────────────
    'legacy-streak':          { en: 'Legacy Streak',                        es: 'Racha Legado',                              pt: 'Sequ\u00eancia Legado' },
    'household-sync':         { en: 'Household Sync Active',                es: 'Sincronizaci\u00f3n del Hogar Activa',      pt: 'Sincroniza\u00e7\u00e3o do Lar Ativa' },
    'sweat-equity':           { en: 'Sweat Equity Contract',                es: 'Contrato de Capital Sudor',                 pt: 'Contrato de Capital Suor' },
    'role-model-feed':        { en: 'Role Model Feed',                      es: 'Feed del Modelo a Seguir',                  pt: 'Feed do Modelo a Seguir' },
    'athlete-evolution':      { en: 'Athlete Evolution',                    es: 'Evoluci\u00f3n del Atleta',                 pt: 'Evolu\u00e7\u00e3o do Atleta' },
    'player-card':            { en: 'Sovereign Player Card',                es: 'Tarjeta de Jugador Soberana',               pt: 'Cartão de Jogador Soberano' },

    // ─── READINESS & RECOVERY ──────────────────────────────
    'morning-audit':          { en: 'Morning Lab Audit',                    es: 'Auditor\u00eda Matutina del Laboratorio',   pt: 'Auditoria Matinal do Laborat\u00f3rio' },
    'readiness-coefficient':  { en: 'Readiness Coefficient',                es: 'Coeficiente de Preparaci\u00f3n',           pt: 'Coeficiente de Prontid\u00e3o' },
    'recovery-protocol':      { en: 'Recovery Protocol Active',             es: 'Protocolo de Recuperaci\u00f3n Activo',     pt: 'Protocolo de Recupera\u00e7\u00e3o Ativo' },
    'prehab-audit':           { en: 'Pre-Hab Stiffness Assessment',         es: 'Evaluaci\u00f3n de Rigidez Pre-Hab',        pt: 'Avalia\u00e7\u00e3o de Rigidez Pre-Hab' },
    'corrective-protocol':    { en: '3-Minute Corrective Protocol',         es: 'Protocolo Correctivo de 3 Minutos',         pt: 'Protocolo Corretivo de 3 Minutos' },

    // ─── NUTRITION & FASTING ───────────────────────────────
    'adaptive-fasting':       { en: 'Adaptive Metabolic Tiers',             es: 'Niveles Metab\u00f3licos Adaptativos',      pt: 'N\u00edveis Metab\u00f3licos Adaptativos' },
    'tournament-mode':        { en: 'Tournament Mode: Road-Ready',          es: 'Modo Torneo: Listo para Viaje',             pt: 'Modo Torneio: Pronto para Viagem' },
    'glycogen-loading':       { en: 'Glycogen Loading Protocol',            es: 'Protocolo de Carga de Gluc\u00f3geno',      pt: 'Protocolo de Carga de Glicog\u00eanio' },
    'protein-density':        { en: 'Protein Density Optimization',         es: 'Optimizaci\u00f3n de Densidad Proteica',    pt: 'Otimiza\u00e7\u00e3o de Densidade Proteica' },

    // ─── SCOUTING & SPORTS ─────────────────────────────────
    'combine-analysis':       { en: 'Combine Performance Analysis',         es: 'An\u00e1lisis de Rendimiento Combine',      pt: 'An\u00e1lise de Performance Combine' },
    'position-kpi':           { en: 'Position-Specific KPIs',               es: 'KPIs Espec\u00edficos por Posici\u00f3n',   pt: 'KPIs Espec\u00edficos por Posi\u00e7\u00e3o' },
    'biomechanical-potential':{ en: 'Biomechanical Potential Analysis',      es: 'An\u00e1lisis de Potencial Biomec\u00e1nico', pt: 'An\u00e1lise de Potencial Biomec\u00e2nico' },
    'kinetic-hologram':       { en: 'Kinetic Vector Hologram',              es: 'Holograma de Vectores Cin\u00e9ticos',      pt: 'Holograma de Vetores Cin\u00e9ticos' },

    // ─── UI ACTIONS ────────────────────────────────────────
    'begin-training':         { en: 'BEGIN TRAINING',                       es: 'INICIAR ENTRENAMIENTO',                     pt: 'INICIAR TREINO' },
    'acknowledge':            { en: 'ACKNOWLEDGED \u2014 BACK TO SET',      es: 'RECONOCIDO \u2014 VOLVER A LA SERIE',       pt: 'RECONHECIDO \u2014 VOLTAR \u00c0 S\u00c9RIE' },
    'upgrade-unlock':         { en: 'UPGRADE TO UNLOCK INTELLIGENCE',       es: 'ACTUALIZA PARA DESBLOQUEAR INTELIGENCIA',   pt: 'ATUALIZE PARA DESBLOQUEAR INTELIG\u00caNCIA' },
    'mark-resolved':          { en: 'MARK RESOLVED',                        es: 'MARCAR RESUELTO',                           pt: 'MARCAR RESOLVIDO' },
    'review-profile':         { en: 'REVIEW PROFILE',                       es: 'REVISAR PERFIL',                            pt: 'REVISAR PERFIL' },
    'data-secured':           { en: 'Data Secured in the Lab',              es: 'Datos Asegurados en el Laboratorio',        pt: 'Dados Seguros no Laborat\u00f3rio' }
  };

  function translateSovereign(key, targetLanguage) {
    var L = targetLanguage || 'en';
    if (SOVEREIGN_DICTIONARY[key]) {
      return SOVEREIGN_DICTIONARY[key][L] || SOVEREIGN_DICTIONARY[key].en || key;
    }
    return key;
  }

  function getAllKeys() {
    return Object.keys(SOVEREIGN_DICTIONARY);
  }

  return {
    translate: translateSovereign,
    t: translateSovereign,
    keys: getAllKeys,
    DICTIONARY: SOVEREIGN_DICTIONARY
  };

})();
