import { test, expect, type Page, type Route } from '@playwright/test';
import {
  CLIENT_SESSION,
  installSupabaseBaseline,
  isPreflight,
  json,
  seedClientSession,
  type SessionEnvelope,
} from './support/vault.js';

/**
 * BBF Vault — Trilingual voice + copy recalibration (Terminal 4)
 * ============================================================================
 * Browser-drone proof that the two coach-voice surfaces on the Hub now follow
 * the CHOSEN language end-to-end — both the on-screen copy AND the spoken-audio
 * request:
 *
 *   1. "Breaking the Loop" (SovereignSequence anchor) renders its kicker, head,
 *      4-step homework shield and Step-1 CTA in the active language, and its
 *      "Listen" request carries the chosen locale + that locale's anthem script
 *      (so Coach Akeem speaks the matching language — no more hardcoded English).
 *   2. The Weekly Brief card fetches with the active locale and renders the
 *      in-locale transcript; switching language re-fetches in the new locale.
 *   3. A live EN ⇄ PT toggle flips every string — proving it's wired to LangContext,
 *      not baked at build.
 *
 * Hermetic: REST/auth/edge-function calls are intercepted; the real-project-host
 * tripwire guarantees the run never touches prod.
 */

const SESSION: SessionEnvelope = { ...CLIENT_SESSION, vaultToken: 'e2e-vault-token' };

// PT-distinct fragments that cannot be confused with EN/ES — used to prove the
// SPOKEN script handed to ElevenLabs actually switches language.
const SEQ_PT_FRAGMENT = 'Transformação não é acidente';
const SEQ_EN_FRAGMENT = "Transformation isn't an accident";

interface Captures {
  briefLocales: string[];          // ?locale= on each weekly-brief fetch
  audioBodies: Array<Record<string, unknown>>; // each biokinetic-briefing POST body
}

/** Seed the persisted language choice BEFORE any app script runs. */
async function seedLang(page: Page, lang: 'en' | 'es' | 'pt'): Promise<void> {
  await page.addInitScript((l) => localStorage.setItem('bbf_lang', l), lang);
}

/** Stub the two coach-voice edge functions and capture what locale each receives. */
async function stubVoiceSurfaces(page: Page): Promise<Captures> {
  const caps: Captures = { briefLocales: [], audioBodies: [] };

  // Weekly Brief scenario engine → return a brief whose transcript matches the
  // requested locale, so the card's rendered_script proves the language switch.
  await page.route('**/functions/v1/bbf-weekly-brief-scenario-engine**', (route: Route) => {
    if (isPreflight(route)) return;
    const url = new URL(route.request().url());
    const locale = url.searchParams.get('locale') || 'en';
    caps.briefLocales.push(locale);
    const transcript = {
      en: 'You logged solid this week. Stay consistent. Keep showing up.',
      es: 'Registraste bien esta semana. Mantén la constancia. Sigue presentándote.',
      pt: 'Você registrou direitinho essa semana. Mantém a constância. Continua aparecendo.',
    }[locale] || '';
    return json(route, 200, {
      user_id: 'jacque_bbf', scenario: 'NEUTRAL', substatus: 'NEUTRAL',
      audio_url: `https://example.test/brief-${locale}.mp3`, // inert; playback not asserted
      rendered_script: transcript, locked_in: true, timestamp: new Date().toISOString(),
    });
  });

  // Universal Voice Coach (sequence context) → capture the POST body (locale +
  // cue_text) and answer with a tiny audio/mpeg blob so postForBlob resolves.
  await page.route('**/functions/v1/bbf-biokinetic-briefing**', (route: Route) => {
    if (isPreflight(route)) return;
    try { caps.audioBodies.push(route.request().postDataJSON() as Record<string, unknown>); } catch { /* ignore */ }
    return route.fulfill({
      status: 200,
      headers: { 'content-type': 'audio/mpeg', 'access-control-allow-origin': '*' },
      body: Buffer.from([0xff, 0xfb, 0x90, 0x00]), // minimal MP3 frame header
    });
  });

  return caps;
}

test.describe('BBF Vault — trilingual coach voice + copy', () => {
  test('Breaking the Loop + Weekly Brief follow the chosen language (PT) and toggle to EN', async ({ page }) => {
    await seedClientSession(page, SESSION);
    await seedLang(page, 'pt');
    const { realDbHits } = await installSupabaseBaseline(page);
    const caps = await stubVoiceSurfaces(page);

    await page.goto('/vault');
    await expect(page.locator('.cv-greet')).toContainText('@jacque_bbf');

    // ── 1 · "Breaking the Loop" anchor renders fully in Portuguese ──────────────
    const seq = page.getByTestId('sovereign-sequence');
    await expect(seq).toBeVisible();
    await expect(seq.locator('.svs-head')).toHaveText('Quebrando o Ciclo');
    await expect(seq.getByTestId('sovereign-sequence-shield')).toContainText('SUA TAREFA DIÁRIA');
    await expect(seq.getByTestId('sovereign-sequence-shield')).toContainText('Captura de Dados');
    await expect(seq.getByTestId('sovereign-step-1')).toContainText('Passo 1: Execute o Check-In');

    // ── 2 · Weekly Brief fetched + rendered in Portuguese ──────────────────────
    const wb = page.getByTestId('weekly-brief-card');
    await expect(wb.locator('.wb-title')).toHaveText('Seu Resumo Semanal');
    await wb.getByTestId('wb-transcript-toggle').click();
    await expect(wb.getByTestId('wb-transcript')).toContainText('Mantém a constância');
    expect(caps.briefLocales).toContain('pt');
    expect(caps.briefLocales).not.toContain('en');

    // ── 3 · "Listen" sends the PT locale + PT anthem to the voice engine ───────
    await seq.getByTestId('program-coach-audio').click();
    await expect.poll(() => caps.audioBodies.length).toBeGreaterThan(0);
    const audioReq = caps.audioBodies[caps.audioBodies.length - 1];
    expect(audioReq.context).toBe('sequence');
    expect(audioReq.locale).toBe('pt');
    expect(String(audioReq.cue_text)).toContain(SEQ_PT_FRAGMENT);

    // ── 4 · Live toggle to EN flips copy AND re-fetches the brief in EN ─────────
    await page.locator('[data-lang="en"]').first().click();
    await expect(seq.locator('.svs-head')).toHaveText('Breaking the Loop');
    await expect(seq.getByTestId('sovereign-step-1')).toContainText('Step 1: Execute Check-In');
    await expect(wb.locator('.wb-title')).toHaveText('Your Weekly Brief');
    await expect.poll(() => caps.briefLocales.includes('en')).toBeTruthy();

    // The EN "Listen" request now carries the EN anthem.
    await seq.getByTestId('program-coach-audio').click();
    await expect.poll(() => caps.audioBodies.some((b) => b.locale === 'en')).toBeTruthy();
    const enAudio = caps.audioBodies.filter((b) => b.locale === 'en').pop();
    expect(String(enAudio?.cue_text)).toContain(SEQ_EN_FRAGMENT);

    // Nothing ever touched production.
    expect(realDbHits).toHaveLength(0);
  });
});
