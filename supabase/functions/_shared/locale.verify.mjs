// Verification harness for _shared/locale.ts — the trilingual cloud contract.
// Node 22 type-stripping lets us import the Deno-targeted .ts directly (locale.ts
// uses no Deno globals at module scope). Node loads a bare .ts as CommonJS unless a
// package.json marks the dir as ESM, so run with a throwaway module marker:
//
//   printf '{"type":"module"}\n' > supabase/functions/_shared/package.json && \
//   node --experimental-strip-types supabase/functions/_shared/locale.verify.mjs ; \
//   rm -f supabase/functions/_shared/package.json
//
// Exits non-zero on any failed check. (Deno needs no marker; this is Node-only.)

import * as L from './locale.ts';

const {
  normalizeLocale, localeCode, localeDirective,
  PROPRIETARY_TERMS, GLOSSARY, SUPPORTED_LOCALES, DEFAULT_LOCALE,
} = L;

let failures = 0;
function check(name, cond) {
  if (cond) { console.log(`  ✓ ${name}`); }
  else { console.error(`  ✗ ${name}`); failures++; }
}

console.log('normalizeLocale — accepts codes, region tags, endonyms, names:');
check("'es' → es", normalizeLocale('es').code === 'es');
check("'ES' → es", normalizeLocale('ES').code === 'es');
check("'es-MX' → es", normalizeLocale('es-MX').code === 'es');
check("'Spanish' → es", normalizeLocale('Spanish').code === 'es');
check("'español' → es", normalizeLocale('español').code === 'es');
check("'pt' → pt", normalizeLocale('pt').code === 'pt');
check("'pt-BR' → pt", normalizeLocale('pt-BR').code === 'pt');
check("'Portuguese' → pt", normalizeLocale('Portuguese').code === 'pt');
check("'português' → pt", normalizeLocale('português').code === 'pt');
check("'br' → pt", normalizeLocale('br').code === 'pt');
check("'en' → en", normalizeLocale('en').code === 'en');
check("'English' → en", normalizeLocale('English').code === 'en');
check('null → default(en)', normalizeLocale(null).code === DEFAULT_LOCALE);
check('undefined → default(en)', normalizeLocale(undefined).code === 'en');
check("'' → default(en)", normalizeLocale('').code === 'en');
check("garbage 'xx' → default(en)", normalizeLocale('xx').code === 'en');
check('localeCode sugar works', localeCode('pt-BR') === 'pt');
check('SUPPORTED_LOCALES is [en,es,pt]', SUPPORTED_LOCALES.join(',') === 'en,es,pt');

console.log('\nlocaleDirective(es) — native Spanish generation contract:');
const es = localeDirective('es', 'the cardio protocol');
check('mentions NATIVELY', /NATIVELY/.test(es));
check('names Español', /Español/.test(es));
check('forbids translate-from-English', /Do NOT draft in English/.test(es));
check('carries proprietary locklist header', /PROPRIETARY NAMES/.test(es));
check('locks "Sovereign Vault" verbatim', es.includes('"Sovereign Vault"'));
check('locks "Smart Cardio" verbatim', es.includes('"Smart Cardio"'));
check('carries approved terminology block', /APPROVED TERMINOLOGY/.test(es));
check('maps Fasting Window → Ventana de Ayuno', es.includes('"Fasting Window" → "Ventana de Ayuno"'));
check('uses the kind argument', es.includes('the cardio protocol'));

console.log('\nlocaleDirective(pt) — native Portuguese generation contract:');
const pt = localeDirective('pt-BR', 'the meal plan');
check('names Português', /Português/.test(pt));
check('forbids translate-from-English', /Do NOT draft in English/.test(pt));
check('maps Workout → Treino', pt.includes('"Workout" → "Treino"'));
check('locks "Pre-Hab" verbatim', pt.includes('"Pre-Hab"'));
check('does NOT leak Spanish glossary', !pt.includes('Ventana de Ayuno'));

console.log('\nlocaleDirective(en) — English native, locklist still present:');
const en = localeDirective('en');
check('writes native English', /native English/.test(en));
check('still carries proprietary locklist', /PROPRIETARY NAMES/.test(en));
check('locks "BBF" verbatim', en.includes('"BBF"'));
check('omits ES/PT glossary block for EN', !/APPROVED TERMINOLOGY/.test(en));

console.log('\nlocaleDirective(unknown) — safe English fallback:');
const fb = localeDirective('klingon');
check('falls back to English native', /native English/.test(fb));

console.log('\nIntegrity of shared tables:');
check('PROPRIETARY_TERMS non-empty', PROPRIETARY_TERMS.length > 0);
check('includes Build Believe Fit', PROPRIETARY_TERMS.includes('Build Believe Fit'));
check('includes Kinematic Form HUD', PROPRIETARY_TERMS.includes('Kinematic Form HUD'));
check('GLOSSARY entries all trilingual', GLOSSARY.every((g) => g.en && g.es && g.pt));

console.log('');
if (failures) { console.error(`FAILED — ${failures} check(s) failed.`); process.exit(1); }
console.log('ALL CHECKS PASSED — trilingual locale contract verified for EN / ES / PT.');
