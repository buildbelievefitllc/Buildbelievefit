// Trilingual meditation video library (30 videos)
// Confidence, Self-Esteem, Motivation, Grounding
// EN (10) + ES (10) + PT (10)

export interface Video {
  id: number;
  language: 'en' | 'es' | 'pt';
  title: string;
  url: string;
  duration_minutes: number;
}

export const videoLibrary: Video[] = [
  // ─── ENGLISH (10) ─────────────────────────────────────────────────────
  {
    id: 1,
    language: 'en',
    title: '10 Minute Meditation for Self Love, Self Confidence and Self Esteem',
    url: 'https://www.youtube.com/embed/LL5j1cL6FmE',
    duration_minutes: 10,
  },
  {
    id: 2,
    language: 'en',
    title: 'Guided Meditation for Success, Confidence and Self-Esteem | Marisa Peer',
    url: 'https://www.youtube.com/embed/ibSR3oeJ7Kg',
    duration_minutes: 12,
  },
  {
    id: 3,
    language: 'en',
    title: '15 Minute Meditation for Building True Confidence to Start Your Day | Mindful Movement',
    url: 'https://www.youtube.com/embed/Dg5CbFDV9eY',
    duration_minutes: 15,
  },
  {
    id: 4,
    language: 'en',
    title: 'Guided Meditation for Confidence, Self Love and Better Self-Esteem',
    url: 'https://www.youtube.com/embed/IIyxwlWlQDU',
    duration_minutes: 10,
  },
  {
    id: 5,
    language: 'en',
    title: 'Unshakable Confidence - A Guided Meditation to Boost Your Self-Esteem',
    url: 'https://www.youtube.com/embed/2ZRYtat1-_Q',
    duration_minutes: 12,
  },
  {
    id: 6,
    language: 'en',
    title: 'Guided Meditation - Increase Motivation and Confidence',
    url: 'https://www.youtube.com/embed/1NQ_VtxxuYI',
    duration_minutes: 8,
  },
  {
    id: 7,
    language: 'en',
    title: 'Hypnosis to Build Confidence and Self-Worth | 20 Minute Meditation | Mindful Movement',
    url: 'https://www.youtube.com/embed/VQwh692Z3OQ',
    duration_minutes: 20,
  },
  {
    id: 8,
    language: 'en',
    title: 'Guided Meditation for Self-Confidence - You Are Strong and Powerful!',
    url: 'https://www.youtube.com/embed/1lD0HdR9zA8',
    duration_minutes: 10,
  },
  {
    id: 9,
    language: 'en',
    title: 'GUIDED MEDITATION - Self Confidence Improvement and Relaxation',
    url: 'https://www.youtube.com/embed/o6pDSsgxAow',
    duration_minutes: 11,
  },
  {
    id: 10,
    language: 'en',
    title: 'Motivational Morning Meditation | Powerful Positive Affirmations | Confidence, Self Esteem, Strength',
    url: 'https://www.youtube.com/embed/n2Cuz2BTEgA',
    duration_minutes: 13,
  },

  // ─── SPANISH (10) ─────────────────────────────────────────────────────
  {
    id: 11,
    language: 'es',
    title: 'CONFIANZA para avanzar hacia lo nuevo | Mindfulness en español - Meditación Guiada',
    url: 'https://www.youtube.com/embed/l2vzz_INOYc',
    duration_minutes: 10,
  },
  {
    id: 12,
    language: 'es',
    title: 'CONFIANZA y FORTALEZA INTERIOR - Mindfulness en español - Meditación Guiada',
    url: 'https://www.youtube.com/embed/qSr6hXDenLQ',
    duration_minutes: 12,
  },
  {
    id: 13,
    language: 'es',
    title: 'MEDITACIÓN GUIADA MINDFULNESS: CREA CONFIANZA Y SEGURIDAD | Mindful Science',
    url: 'https://www.youtube.com/embed/ZSrpAq8x9tA',
    duration_minutes: 11,
  },
  {
    id: 14,
    language: 'es',
    title: 'Meditación para aumentar tu CONFIANZA y AUTOESTIMA | 15 minutos | Gabriela Litschi',
    url: 'https://www.youtube.com/embed/3LHwE3Ssxmo',
    duration_minutes: 15,
  },
  {
    id: 15,
    language: 'es',
    title: 'Meditación Guiada - Aumentar la Confianza en uno mismo | Gabriela Litschi',
    url: 'https://www.youtube.com/embed/1ln-gryq7lM',
    duration_minutes: 10,
  },
  {
    id: 16,
    language: 'es',
    title: 'Meditación GUIADA para GANAR AUTOESTIMA y AUMENTAR CONFIANZA | AMOR PROPIO | Mindfulness Amitaba',
    url: 'https://www.youtube.com/embed/ilOVZTe1_Zs',
    duration_minutes: 13,
  },
  {
    id: 17,
    language: 'es',
    title: 'MEDITACIÓN GUIADA PARA TU CONFIANZA Y SEGURIDAD - CONEXIÓN CON LA TIERRA | Elena Malova',
    url: 'https://www.youtube.com/embed/X8GxXTg6f5g',
    duration_minutes: 14,
  },
  {
    id: 18,
    language: 'es',
    title: 'Meditación Guiada Para Autoestima, Confianza y Autoaceptación',
    url: 'https://www.youtube.com/embed/_R38ejsHL4A',
    duration_minutes: 12,
  },
  {
    id: 19,
    language: 'es',
    title: 'Meditación Guiada - Confianza en la Vida',
    url: 'https://www.youtube.com/embed/B9XwXy77IgE',
    duration_minutes: 10,
  },
  {
    id: 20,
    language: 'es',
    title: 'MEDITACIÓN GUIADA PARA POTENCIAR TU AUTOCONFIANZA Y TU SENTIDO DE SEGURIDAD EN LA VIDA',
    url: 'https://www.youtube.com/embed/qJvgWUH4dvU',
    duration_minutes: 15,
  },

  // ─── PORTUGUESE (10) ──────────────────────────────────────────────────
  {
    id: 21,
    language: 'pt',
    title: 'Meditação Guiada em Português - Aumente a Auto Estima e Ganhe Confiança',
    url: 'https://www.youtube.com/embed/vgTlOn0B378',
    duration_minutes: 12,
  },
  {
    id: 22,
    language: 'pt',
    title: 'Meditação Guiada | Entrega e Confiança',
    url: 'https://www.youtube.com/embed/F-82J7DNOCQ',
    duration_minutes: 10,
  },
  {
    id: 23,
    language: 'pt',
    title: 'Meditação Guiada CONFIANÇA • Afirmações Positivas para Autoestima, Potência Interior e Autoconfiança',
    url: 'https://www.youtube.com/embed/ZdNVb9mnlJE',
    duration_minutes: 13,
  },
  {
    id: 24,
    language: 'pt',
    title: 'Confiança - Meditação Guiada',
    url: 'https://www.youtube.com/embed/cZ_svHojWD4',
    duration_minutes: 9,
  },
  {
    id: 25,
    language: 'pt',
    title: 'Meditação Guiada para Clareza, Confiança e Decisão | Pri Leite',
    url: 'https://www.youtube.com/embed/qET1csiVNjQ',
    duration_minutes: 11,
  },
  {
    id: 26,
    language: 'pt',
    title: 'Meditação para AUTOCONFIANÇA e AUTOESTIMA | Meditação Guiada - Fernanda Yoga',
    url: 'https://www.youtube.com/embed/ZX2H-gS2g08',
    duration_minutes: 14,
  },
  {
    id: 27,
    language: 'pt',
    title: 'Meditação Guiada para Renovar seu OTIMISMO e FORÇA INTERIOR',
    url: 'https://www.youtube.com/embed/Tcn60x-2fgk',
    duration_minutes: 12,
  },
  {
    id: 28,
    language: 'pt',
    title: 'Aumente sua Autoconfiança com essa Meditação',
    url: 'https://www.youtube.com/embed/utn7CyrV8_M',
    duration_minutes: 10,
  },
  {
    id: 29,
    language: 'pt',
    title: 'ATIVAÇÃO DO PODER E FORÇA INTERIOR | Meditação Guiada e Auto-hipnose | Relaxamento Imediato',
    url: 'https://www.youtube.com/embed/SJeDzTSK1sg',
    duration_minutes: 15,
  },
  {
    id: 30,
    language: 'pt',
    title: 'Meditação Guiada para AUTOCONFIANÇA - Desperte seu Poder Interior',
    url: 'https://www.youtube.com/embed/XmAdFP7C1_8',
    duration_minutes: 11,
  },
];
