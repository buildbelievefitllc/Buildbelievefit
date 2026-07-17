// src/components/language/clinicDrills.js
// ─────────────────────────────────────────────────────────────────────────────
// THE GRAMMAR CLINIC drill bank — weak-cluster targeted micro-drills (ES + PT).
//
// THE CLOSED LOOP, FINALLY CLOSED: the Immersion engine classifies every live
// mistake into the fixed §4.4 error-cluster taxonomy and rolls the athlete's
// worst offenders into bbf_language_profiles.weak_clusters — but until now
// nothing READ that field. The Clinic does: it serves these drills weakest-
// cluster-first, so yesterday's conversation failure shapes today's medicine.
//
// Authoring rules:
//   • Clusters match _shared/language-core.ts ERROR_CLUSTERS exactly
//     (pronunciation is deliberately absent — that's the Echo Chamber's job).
//   • Content lives in the BBF Fables universe (La Forja / A Forja cast) so the
//     Clinic reinforces the same world the story and Immersion build.
//   • THE GRAM STANDARD: no kilo/pound lexeme, ever — mass is integer grams.
//   • `why` is an English gloss (content, like scene_gloss — chrome localizes,
//     explanations teach). Options are target-language data, never localized.

export const CLINIC_CLUSTERS = [
  'ser_estar', 'gender_agreement', 'verb_conjugation', 'preposition',
  'false_friend', 'word_order', 'register',
];

export const CLINIC_DRILLS = {
  es: [
    // ── ser vs estar ─────────────────────────────────────────────────────────
    { id: 'es-se-1', cluster: 'ser_estar', q: 'El entrenamiento ___ a las siete.', options: ['es', 'está'], correct: 0, why: 'Events and schedules take ser: "el entrenamiento es a las siete."' },
    { id: 'es-se-2', cluster: 'ser_estar', q: 'Teo ___ cansado después de la serie.', options: ['es', 'está'], correct: 1, why: 'Temporary states take estar — tiredness passes. "Es cansado" would mean he is a tiring person.' },
    { id: 'es-se-3', cluster: 'ser_estar', q: 'Marisol ___ de Guadalajara.', options: ['es', 'está'], correct: 0, why: 'Origin is permanent identity: ser. "Está de Guadalajara" is not Spanish.' },
    { id: 'es-se-4', cluster: 'ser_estar', q: 'La barra ___ fría esta mañana.', options: ['es', 'está'], correct: 1, why: 'A condition right now: estar. "La barra es fría" would describe its permanent character.' },
    { id: 'es-se-5', cluster: 'ser_estar', q: 'Doña Rosa ___ una gran cocinera.', options: ['es', 'está'], correct: 0, why: 'Identity and profession take ser — it is who she is, not a passing state.' },
    // ── gender agreement ─────────────────────────────────────────────────────
    { id: 'es-ga-1', cluster: 'gender_agreement', q: '___ mano izquierda', options: ['el', 'la'], correct: 1, why: 'Mano ends in -o but is feminine: la mano. One of the classic exceptions.' },
    { id: 'es-ga-2', cluster: 'gender_agreement', q: 'El agua ___', options: ['frío', 'fría'], correct: 1, why: 'Agua is feminine — the "el" is only for the stressed a- sound. Adjectives stay feminine: el agua fría.' },
    { id: 'es-ga-3', cluster: 'gender_agreement', q: 'Es un problema ___', options: ['serio', 'seria'], correct: 0, why: 'Problema ends in -a but is masculine (Greek origin): un problema serio.' },
    { id: 'es-ga-4', cluster: 'gender_agreement', q: 'La rodilla ___', options: ['hinchado', 'hinchada'], correct: 1, why: 'Rodilla is feminine, so the adjective agrees: la rodilla hinchada (the swollen knee).' },
    { id: 'es-ga-5', cluster: 'gender_agreement', q: 'Fue un día ___', options: ['largo', 'larga'], correct: 0, why: 'Día ends in -a but is masculine: un día largo.' },
    // ── verb conjugation ─────────────────────────────────────────────────────
    { id: 'es-vc-1', cluster: 'verb_conjugation', q: 'Ayer yo ___ cinco series.', options: ['hací', 'hice'], correct: 1, why: 'Hacer is irregular in the preterite: hice, hiciste, hizo.' },
    { id: 'es-vc-2', cluster: 'verb_conjugation', q: '¿Tú ___ entrenar mañana?', options: ['puedes', 'podes'], correct: 0, why: 'Poder stem-changes o→ue: puedes. ("Podés" exists only in voseo regions — BBF drills tú.)' },
    { id: 'es-vc-3', cluster: 'verb_conjugation', q: 'Nosotros ___ al gimnasio cada día.', options: ['vamos', 'imos'], correct: 0, why: 'Ir is irregular: voy, vas, va, vamos, van.' },
    { id: 'es-vc-4', cluster: 'verb_conjugation', q: 'Ella ___ la barra ahora.', options: ['carga', 'cargas'], correct: 0, why: 'Third person singular: ella carga. -as is the tú form.' },
    { id: 'es-vc-5', cluster: 'verb_conjugation', q: 'Ellos ___ ocho horas anoche.', options: ['dormieron', 'durmieron'], correct: 1, why: 'Dormir stem-changes o→u in the third-person preterite: durmió, durmieron.' },
    // ── prepositions (por / para) ────────────────────────────────────────────
    { id: 'es-pr-1', cluster: 'preposition', q: 'Entreno ___ ser más fuerte.', options: ['por', 'para'], correct: 1, why: 'Purpose/goal takes para: I train in order to be stronger.' },
    { id: 'es-pr-2', cluster: 'preposition', q: 'Caminamos ___ el parque.', options: ['por', 'para'], correct: 0, why: 'Movement through a space takes por: caminar por el parque.' },
    { id: 'es-pr-3', cluster: 'preposition', q: 'El batido es ___ ti.', options: ['por', 'para'], correct: 1, why: 'Recipient takes para: this smoothie is for you.' },
    { id: 'es-pr-4', cluster: 'preposition', q: 'Gracias ___ la ayuda.', options: ['por', 'para'], correct: 0, why: 'Cause/exchange takes por: gracias por, pagar por, por eso.' },
    { id: 'es-pr-5', cluster: 'preposition', q: 'Salimos a correr ___ la mañana.', options: ['por', 'para'], correct: 0, why: 'Approximate time of day takes por: por la mañana, por la noche.' },
    // ── false friends ────────────────────────────────────────────────────────
    { id: 'es-ff-1', cluster: 'false_friend', q: '"Embarazada" significa…', options: ['embarrassed', 'pregnant'], correct: 1, why: 'The classic trap: embarazada = pregnant. Embarrassed is "avergonzada."' },
    { id: 'es-ff-2', cluster: 'false_friend', q: '"Asistir" significa…', options: ['to attend', 'to assist'], correct: 0, why: 'Asistir a = to attend. To assist/help is "ayudar."' },
    { id: 'es-ff-3', cluster: 'false_friend', q: '"Realizar" significa…', options: ['to realize', 'to carry out'], correct: 1, why: 'Realizar = to carry out/accomplish. To realize (notice) is "darse cuenta."' },
    { id: 'es-ff-4', cluster: 'false_friend', q: '"El éxito" significa…', options: ['success', 'exit'], correct: 0, why: 'Éxito = success. The exit is "la salida" — look for that sign at the gym.' },
    { id: 'es-ff-5', cluster: 'false_friend', q: '"La ropa" significa…', options: ['rope', 'clothes'], correct: 1, why: 'Ropa = clothes. A rope is "la cuerda" — as in jump rope, "la cuerda de saltar."' },
    // ── word order ───────────────────────────────────────────────────────────
    { id: 'es-wo-1', cluster: 'word_order', q: '¿La barra? …', options: ['Marisol carga la.', 'Marisol la carga.'], correct: 1, why: 'Object pronouns go BEFORE the conjugated verb: la carga.' },
    { id: 'es-wo-2', cluster: 'word_order', q: 'Which is the natural order?', options: ['un atleta fuerte', 'un fuerte atleta'], correct: 0, why: 'Descriptive adjectives usually follow the noun in Spanish: atleta fuerte.' },
    { id: 'es-wo-3', cluster: 'word_order', q: 'Which question is correct?', options: ['¿Cuánto cuesta el batido?', '¿Cuánto el batido cuesta?'], correct: 0, why: 'In questions the verb comes right after the question word: cuánto cuesta.' },
    { id: 'es-wo-4', cluster: 'word_order', q: 'Which is correct?', options: ['No pasa nada.', 'Pasa no nada.'], correct: 0, why: 'No goes directly before the verb; double negation with nada is standard: no pasa nada.' },
    { id: 'es-wo-5', cluster: 'word_order', q: 'Asking for a spot:', options: ['¿Ayudas me?', '¿Me ayudas?'], correct: 1, why: 'The clitic pronoun precedes the conjugated verb: me ayudas.' },
    // ── register (tú / usted) ────────────────────────────────────────────────
    { id: 'es-rg-1', cluster: 'register', q: 'A Doña Rosa (mayor, respetada): «¿___ tiene avena?»', options: ['Tú', 'Usted'], correct: 1, why: 'Elders and respected figures get usted — Doña Rosa has earned it. (She will still call you mijo.)' },
    { id: 'es-rg-2', cluster: 'register', q: 'A tu compañero Teo: «¿___ mañana?»', options: ['Vienes', 'Viene'], correct: 0, why: 'A teammate your age gets tú: ¿vienes mañana? Usted would sound distant.' },
    { id: 'es-rg-3', cluster: 'register', q: 'Al vendedor del mercado (formal): «¿Me ___ dar dos mangos?»', options: ['puedes', 'podría'], correct: 1, why: 'With strangers, the formal conditional is polite: ¿me podría dar…?' },
    { id: 'es-rg-4', cluster: 'register', q: 'Marisol te tutea. «Marisol, ¿me pasas ___ libreta?»', options: ['tu', 'su'], correct: 0, why: 'If the relationship is tú, the possessive matches: tu libreta. Mixing su in sounds off.' },
    { id: 'es-rg-5', cluster: 'register', q: 'Saludando a un señor mayor: «¿Cómo ___?»', options: ['estás', 'está'], correct: 1, why: 'Usted conjugates like él/ella: ¿cómo está (usted)?' },
  ],
  pt: [
    // ── ser vs estar ─────────────────────────────────────────────────────────
    { id: 'pt-se-1', cluster: 'ser_estar', q: 'O treino ___ às sete.', options: ['é', 'está'], correct: 0, why: 'Events and schedules take ser: "o treino é às sete."' },
    { id: 'pt-se-2', cluster: 'ser_estar', q: 'Rafa ___ cansado depois da série.', options: ['é', 'está'], correct: 1, why: 'Temporary states take estar — tiredness passes. "É cansado" would make it his personality.' },
    { id: 'pt-se-3', cluster: 'ser_estar', q: 'Dona Marta ___ de Porto Alegre.', options: ['é', 'está'], correct: 0, why: 'Origin is permanent identity: ser. "Está de Porto Alegre" is not Portuguese.' },
    { id: 'pt-se-4', cluster: 'ser_estar', q: 'A barra ___ fria hoje de manhã.', options: ['é', 'está'], correct: 1, why: 'A condition right now: estar. "A barra é fria" would describe its permanent character.' },
    { id: 'pt-se-5', cluster: 'ser_estar', q: 'Seu Chico ___ um grande cozinheiro.', options: ['é', 'está'], correct: 0, why: 'Identity takes ser — it is who he is (ask him, he will tell you).' },
    // ── gender agreement ─────────────────────────────────────────────────────
    { id: 'pt-ga-1', cluster: 'gender_agreement', q: '___ joelho direito', options: ['o', 'a'], correct: 0, why: 'Joelho is masculine: o joelho. (Spanish speakers beware — la rodilla flips gender.)' },
    { id: 'pt-ga-2', cluster: 'gender_agreement', q: 'A água ___', options: ['gelado', 'gelada'], correct: 1, why: 'Água is feminine; the adjective agrees: a água gelada.' },
    { id: 'pt-ga-3', cluster: 'gender_agreement', q: 'É um problema ___', options: ['sério', 'séria'], correct: 0, why: 'Problema ends in -a but is masculine (Greek origin): um problema sério.' },
    { id: 'pt-ga-4', cluster: 'gender_agreement', q: 'A viagem foi ___', options: ['longo', 'longa'], correct: 1, why: 'Viagem is feminine in Portuguese: a viagem longa. (Spanish "el viaje" is masculine — cross-language trap.)' },
    { id: 'pt-ga-5', cluster: 'gender_agreement', q: 'O leite ___', options: ['gelado', 'gelada'], correct: 0, why: 'Leite is masculine in Portuguese: o leite gelado. (Spanish "la leche" is feminine — another flip.)' },
    // ── verb conjugation ─────────────────────────────────────────────────────
    { id: 'pt-vc-1', cluster: 'verb_conjugation', q: 'Ontem eu ___ cinco séries.', options: ['fazi', 'fiz'], correct: 1, why: 'Fazer is irregular in the perfect past: fiz, fez, fizemos, fizeram.' },
    { id: 'pt-vc-2', cluster: 'verb_conjugation', q: 'Você ___ treinar amanhã?', options: ['pode', 'podes'], correct: 0, why: 'Você conjugates like ele/ela: você pode. (Podes goes with tu, mostly outside Brazil.)' },
    { id: 'pt-vc-3', cluster: 'verb_conjugation', q: 'Nós ___ à academia todo dia.', options: ['vamos', 'imos'], correct: 0, why: 'Ir is irregular: vou, vai, vamos, vão.' },
    { id: 'pt-vc-4', cluster: 'verb_conjugation', q: 'Ela ___ a barra agora.', options: ['carrega', 'carregas'], correct: 0, why: 'Third person singular: ela carrega.' },
    { id: 'pt-vc-5', cluster: 'verb_conjugation', q: 'Eles ___ oito horas ontem à noite.', options: ['dormiram', 'dormiu'], correct: 0, why: 'Third person plural in the perfect past: eles dormiram. Dormiu is singular.' },
    // ── prepositions (por / para / em) ───────────────────────────────────────
    { id: 'pt-pr-1', cluster: 'preposition', q: 'Treino ___ ser mais forte.', options: ['por', 'para'], correct: 1, why: 'Purpose/goal takes para: treino para ser mais forte.' },
    { id: 'pt-pr-2', cluster: 'preposition', q: 'Caminhamos ___ parque.', options: ['pelo', 'para o'], correct: 0, why: 'Movement through a space takes por (+o = pelo): caminhar pelo parque.' },
    { id: 'pt-pr-3', cluster: 'preposition', q: 'A vitamina é ___ você.', options: ['por', 'para'], correct: 1, why: 'Recipient takes para: a vitamina é para você.' },
    { id: 'pt-pr-4', cluster: 'preposition', q: 'Obrigado ___ ajuda.', options: ['pela', 'para a'], correct: 0, why: 'Thanks/cause takes por (+a = pela): obrigado pela ajuda.' },
    { id: 'pt-pr-5', cluster: 'preposition', q: 'Moro ___ São Paulo.', options: ['em', 'no'], correct: 0, why: 'City names without articles take bare em: moro em São Paulo. (No = em + o, for masculine nouns with articles: no Rio.)' },
    // ── false friends ────────────────────────────────────────────────────────
    { id: 'pt-ff-1', cluster: 'false_friend', q: '"Puxar" significa…', options: ['to push', 'to pull'], correct: 1, why: 'The gym-door classic: PUXE means PULL, not push. Push is "empurrar" (EMPURRE).' },
    { id: 'pt-ff-2', cluster: 'false_friend', q: '"Pretender" significa…', options: ['to intend', 'to pretend'], correct: 0, why: 'Pretender = to intend/plan. To pretend is "fingir."' },
    { id: 'pt-ff-3', cluster: 'false_friend', q: '"A pasta" significa…', options: ['pasta (food)', 'folder / briefcase'], correct: 1, why: 'Pasta = folder or briefcase. The food is "massa" — as in muita massa on carb day.' },
    { id: 'pt-ff-4', cluster: 'false_friend', q: '"Atualmente" significa…', options: ['currently', 'actually'], correct: 0, why: 'Atualmente = currently/nowadays. Actually is "na verdade."' },
    { id: 'pt-ff-5', cluster: 'false_friend', q: '"O êxito" significa…', options: ['exit', 'success'], correct: 1, why: 'Êxito = success. The exit is "a saída" — look for that sign at the academia.' },
    // ── word order ───────────────────────────────────────────────────────────
    { id: 'pt-wo-1', cluster: 'word_order', q: 'Offering help:', options: ['Eu te ajudo.', 'Eu ajudo te.'], correct: 0, why: 'The clitic pronoun comes before the verb in Brazilian usage: eu te ajudo.' },
    { id: 'pt-wo-2', cluster: 'word_order', q: 'Which is the natural order?', options: ['um atleta forte', 'um forte atleta'], correct: 0, why: 'Descriptive adjectives usually follow the noun: atleta forte.' },
    { id: 'pt-wo-3', cluster: 'word_order', q: 'Which is correct?', options: ['Não custa nada.', 'Custa não nada.'], correct: 0, why: 'Não goes directly before the verb: não custa nada.' },
    { id: 'pt-wo-4', cluster: 'word_order', q: 'Which is correct?', options: ['A barra não sobe.', 'A barra sobe não.'], correct: 0, why: 'Standard negation places não before the verb. (Verb-final "sobe não" is regional/emphatic speech.)' },
    { id: 'pt-wo-5', cluster: 'word_order', q: 'At Seu Chico’s counter:', options: ['Quero uma vitamina de banana.', 'Quero de banana uma vitamina.'], correct: 0, why: 'The de-phrase follows the noun it describes: vitamina de banana.' },
    // ── register (você / o senhor) ───────────────────────────────────────────
    { id: 'pt-rg-1', cluster: 'register', q: 'Ao Seu Chico (mais velho, respeitado): «___ tem aveia?»', options: ['Você', 'O senhor'], correct: 1, why: 'Elders get o senhor / a senhora — Seu Chico has earned it. (He will still call you meu filho.)' },
    { id: 'pt-rg-2', cluster: 'register', q: 'Ao seu parceiro Rafa: «___ vem amanhã?»', options: ['Você', 'O senhor'], correct: 0, why: 'A teammate your age gets você. O senhor would sound like you are teasing him.' },
    { id: 'pt-rg-3', cluster: 'register', q: 'Pedido educado na feira: «O senhor ___ me dar duas mangas?»', options: ['pode', 'poderia'], correct: 1, why: 'The conditional softens a request: poderia me dar…? Extra polite with strangers.' },
    { id: 'pt-rg-4', cluster: 'register', q: '«Dona Marta, posso pegar ___ caderno?»', options: ['seu', 'teu'], correct: 0, why: 'With você/o senhor treatment, the possessive is seu. Teu pairs with tu.' },
    { id: 'pt-rg-5', cluster: 'register', q: 'Cumprimentando um senhor de idade: «Como vai ___?»', options: ['você', 'o senhor'], correct: 1, why: 'Keep the respectful form through the whole sentence: como vai o senhor?' },
  ],
};

// Order the bank for an athlete: drills from their weak clusters first (in the
// profile's own worst-first order), then the remaining clusters in taxonomy
// order. Within a cluster the authored order holds. Pure + deterministic.
export function orderDrillsForAthlete(language, weakClusters = []) {
  const bank = CLINIC_DRILLS[language === 'pt' ? 'pt' : 'es'] || [];
  const weak = (Array.isArray(weakClusters) ? weakClusters : []).filter((c) => CLINIC_CLUSTERS.includes(c));
  const rank = new Map(weak.map((c, i) => [c, i]));
  const base = new Map(CLINIC_CLUSTERS.map((c, i) => [c, weak.length + i]));
  return [...bank].sort((a, b) => {
    const ra = rank.has(a.cluster) ? rank.get(a.cluster) : base.get(a.cluster);
    const rb = rank.has(b.cluster) ? rank.get(b.cluster) : base.get(b.cluster);
    return ra - rb;
  });
}
