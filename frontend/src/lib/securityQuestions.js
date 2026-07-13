// src/lib/securityQuestions.js
// ─────────────────────────────────────────────────────────────────────────────
// The trilingual security-question bank for knowledge-based PIN recovery. The
// backend (bbf_pin_recovery_answers) stores ONLY a stable question_key + a
// bcrypt hash of the answer — never the question text and never the plaintext
// answer. This module is the single source of truth mapping each key to its
// EN/ES/PT label, so the DB layer stays i18n-agnostic.
//
// KEYS MUST MATCH the SQL bank in
// supabase/migrations/20260713120000_bbf_pin_security_recovery.sql (the decoy
// generator draws from the same six keys). Do not rename a key without a
// matching migration, or an existing user's stored key would render blank.

export const SECURITY_QUESTIONS = [
  {
    key: 'mothers_maiden',
    en: "Mother's maiden name",
    es: 'Apellido de soltera de tu madre',
    pt: 'Sobrenome de solteira da sua mãe',
  },
  {
    key: 'first_pet',
    en: 'Name of your first pet',
    es: 'Nombre de tu primera mascota',
    pt: 'Nome do seu primeiro animal de estimação',
  },
  {
    key: 'birth_city',
    en: 'City where you were born',
    es: 'Ciudad donde naciste',
    pt: 'Cidade onde você nasceu',
  },
  {
    key: 'childhood_street',
    en: 'Street you grew up on',
    es: 'Calle donde creciste',
    pt: 'Rua onde você cresceu',
  },
  {
    key: 'elementary_school',
    en: 'Name of your elementary school',
    es: 'Nombre de tu escuela primaria',
    pt: 'Nome da sua escola primária',
  },
  {
    key: 'favorite_teacher',
    en: "Your favorite teacher's name",
    es: 'Nombre de tu profesor favorito',
    pt: 'Nome do seu professor favorito',
  },
];

// Resolve a question_key → its label in the active language (EN fallback).
export function questionLabel(key, lang = 'en') {
  const q = SECURITY_QUESTIONS.find((x) => x.key === key);
  if (!q) return key;
  const code = ['en', 'es', 'pt'].includes(lang) ? lang : 'en';
  return q[code] || q.en;
}
