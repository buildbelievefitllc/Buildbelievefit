// e2e/harness/harness.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Dev/test-only harness that mounts a single real component (chosen via ?c=) inside
// the real providers, so Playwright integration specs exercise the ACTUAL production
// code paths for the four go-live UI fixes — not reimplementations. This file lives
// outside the production index.html graph and is never shipped by `vite build`.

import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { LangProvider } from '../../src/context/LangContext.jsx';
import AuthContext from '../../src/context/AuthContext.jsx';
import { RosterProvider } from '../../src/components/command/RosterProvider.jsx';
import ClientHub from '../../src/components/command/ClientHub.jsx';
import NutritionLocker from '../../src/components/command/NutritionLocker.jsx';
import NutritionCard from '../../src/components/hub/NutritionCard.jsx';
import Nutrition from '../../src/components/vault/Nutrition.jsx';
import ProvisionGate from '../../src/components/vault/ProvisionGate.jsx';
import CardioCard from '../../src/components/hub/CardioCard.jsx';
import DashboardHub from '../../src/components/hub/DashboardHub.jsx';
import CoachAudioButton from '../../src/components/vault/CoachAudioButton.jsx';
import SovereignBriefingCard from '../../src/components/vault/SovereignBriefingCard.jsx';
import VocabFlashcard from '../../src/components/language/VocabFlashcard.jsx';
import LanguageMasteryPanel from '../../src/components/language/LanguageMasteryPanel.jsx';
import Prehab from '../../src/components/vault/Prehab.jsx';
import Recovery from '../../src/components/vault/Recovery.jsx';
import { lockScoreDigits } from '../../src/lib/scoreLock.js';
import StudioBatchPanel from '../../src/components/studio/StudioBatchPanel.jsx';
import SovereignStudioV4 from '../../src/components/SovereignStudioV4/index.jsx';
import Comlink from '../../src/components/command/Comlink.jsx';
import BroadcastHub from '../../src/components/command/BroadcastHub.jsx';
import BodyweightCard from '../../src/components/vault/BodyweightCard.jsx';
import TDEECalculator from '../../src/components/TDEECalculator.jsx';
import DailyBurnCalculator from '../../src/pages/DailyBurnCalculator.jsx';
import PremiumSessionPlayer from '../../src/components/vault/PremiumSessionPlayer.jsx';
import LiveCheckinCoach from '../../src/components/vault/LiveCheckinCoach.jsx';
import SovereignPrepPanels from '../../src/components/vault/SovereignPrepPanels.jsx';
import { GuideLauncher } from '../../src/components/BbfMediaPortal.jsx';

const props = (typeof window !== 'undefined' && window.__HARNESS_PROPS__) || {};
const which = new URLSearchParams(window.location.search).get('c') || '';

// Controlled auth context — lets a spec assert that the FOUNDER/ADMIN role (isAdmin)
// unlocks the Studio Batch compile utilities (defect 3), independent of any token.
function AuthMock({ value, children }) {
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// A tiny real, decodable silent WAV object-URL — stands in for the resolved bucket /
// ElevenLabs clip so the audio element genuinely reaches `canplay` (defect 2).
function silentWavUrl(ms = 150) {
  const rate = 8000;
  const n = Math.floor((rate * ms) / 1000);
  const buf = new ArrayBuffer(44 + n * 2);
  const dv = new DataView(buf);
  const wr = (o, s) => { for (let i = 0; i < s.length; i += 1) dv.setUint8(o + i, s.charCodeAt(i)); };
  wr(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); wr(8, 'WAVE'); wr(12, 'fmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, rate, true); dv.setUint32(28, rate * 2, true);
  dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); wr(36, 'data'); dv.setUint32(40, n * 2, true);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

// Simulate the async source/auth handshake: resolve the clip URL only AFTER a delay,
// so a naive player that binds+plays synchronously would race and fail on first tap.
const delayedAudioRequest = () => new Promise((resolve) => {
  // 3s clip → the "is-playing" state stays observable long enough for the assertion.
  setTimeout(() => resolve(silentWavUrl(3000)), Number(props.delayMs) || 300);
});

// R1 proof rig — Founder Five (ClientHub) and Nutrition Locker mounted under ONE
// shared RosterProvider, with a tab toggle that unmounts/remounts the active sibling
// via `key` (exactly mirroring CommandCenter's `key={activeTab}` remount boundary).
// The provider lives OUTSIDE that boundary, so the base roster is fetched a single
// time no matter how many times the spec swaps between the two panels — the network
// count is the proof that the duplicate pull is gone.
function RosterShareProbe() {
  const [tab, setTab] = useState('founder');
  return (
    <RosterProvider>
      <div>
        <div role="tablist">
          <button type="button" data-testid="probe-tab-founder" aria-selected={tab === 'founder'} onClick={() => setTab('founder')}>Founder Five</button>
          <button type="button" data-testid="probe-tab-locker" aria-selected={tab === 'locker'} onClick={() => setTab('locker')}>Nutrition Locker</button>
        </div>
        <div data-testid="probe-panel" key={tab}>
          {tab === 'founder' ? <ClientHub /> : <NutritionLocker />}
        </div>
      </div>
    </RosterProvider>
  );
}

function pick() {
  switch (which) {
    case 'comlink':
      return (
        <MemoryRouter>
          <AuthMock value={{ isAdmin: true, user: { username: 'akeem', role: 'admin' }, session: { vaultToken: 'test-vault-token' } }}>
            <Comlink />
          </AuthMock>
        </MemoryRouter>
      );
    case 'tdee-calculator':
      return <TDEECalculator onUseResults={() => {}} />;
    case 'daily-burn':
      return (
        <MemoryRouter>
          <DailyBurnCalculator />
        </MemoryRouter>
      );
    case 'roster-share':
      // Admin session so the roster/telemetry calls fire the way they do in prod.
      return (
        <MemoryRouter>
          <AuthMock value={{ isAdmin: true, user: { username: 'akeem', role: 'admin' }, session: { vaultToken: 'test-vault-token' } }}>
            <RosterShareProbe />
          </AuthMock>
        </MemoryRouter>
      );
    case 'nutrition':
      return <NutritionCard data={props.data ?? null} defaults={props.defaults ?? null} />;
    case 'provision-gate':
      // The vault-landing provisioning guard around a Hub sentinel — the Hub is not
      // granted until useEnsureProvisioned (bbf_ensure_provisioned) confirms readiness.
      return (
        <AuthMock value={{ isAdmin: false, user: props.user ?? { username: 'fueluser' }, session: { vaultToken: 'test-vault-token' } }}>
          <ProvisionGate>
            <div data-testid="hub-sentinel">HUB READY</div>
          </ProvisionGate>
        </AuthMock>
      );
    case 'nutrition-tab':
      // The FULL Nutrition tab — the adherence loop (server-synced meal log, wheel vs
      // canonical targets, tiered surfaces). Wrapped in a Router (the tab reads
      // useLocation) + a controllable AuthMock (user/isAdmin/session drive entitlement).
      return (
        <MemoryRouter>
          <AuthMock value={{
            isAdmin: !!props.isAdmin,
            user: props.user ?? { username: 'akeem' },
            session: { vaultToken: 'test-vault-token' },
          }}>
            <Nutrition plans={props.plans ?? null} profile={props.profile ?? null} />
          </AuthMock>
        </MemoryRouter>
      );
    case 'cardio':
      return <CardioCard data={props.data ?? null} defaults={props.defaults ?? null} />;
    case 'sovereign-briefing': {
      // Unified check-in briefing player, driven through the REAL intercept path:
      // manifestUrlById passes a full http(s) URL through verbatim, so the spec can
      // point the working source at a route-intercepted fixture clip.
      const refUrl = props.overrideRefPath
        ? new URL(props.overrideRefPath, window.location.origin).href
        : props.overrideRef || null;
      return (
        <AuthMock value={{ isAdmin: false, user: props.user ?? { username: 'akeem' } }}>
          <SovereignBriefingCard overrideActive={!!refUrl} overrideRef={refUrl} />
        </AuthMock>
      );
    }
    case 'vocab-gym':
      return <VocabFlashcard language={props.language || 'es'} />;
    case 'prehab':
      return (
        <AuthMock value={{ isAdmin: false, user: props.user ?? { username: 'akeem' } }}>
          <Prehab />
        </AuthMock>
      );
    case 'recovery':
      return (
        <AuthMock value={{ isAdmin: false, user: props.user ?? { username: 'akeem' } }}>
          <Recovery plans={null} />
        </AuthMock>
      );
    case 'language-lab':
      return (
        <AuthMock value={{ isAdmin: true, user: { username: 'akeem', role: 'admin' } }}>
          <LanguageMasteryPanel />
        </AuthMock>
      );
    case 'score-lock':
      // Runs the REAL client mirror of the briefing engine's score lock and renders
      // the result, so the spec can assert a single non-contradictory number.
      return (
        <pre data-testid="score-lock-output">
          {lockScoreDigits(String(props.script || ''), Number(props.score))}
        </pre>
      );
    case 'dashboard-hub':
      return (
        <AuthMock value={{ isAdmin: false, user: props.user ?? { username: 'akeem' } }}>
          <DashboardHub />
        </AuthMock>
      );
    case 'coach-audio':
      return (
        <CoachAudioButton
          audioRequest={delayedAudioRequest}
          fallbackText="brace and drive"
          idleLabel="Play Coach Audio"
        />
      );
    case 'studio-batch':
      return (
        <AuthMock value={{ isAdmin: !!props.isAdmin, user: props.user ?? null }}>
          <StudioBatchPanel />
        </AuthMock>
      );
    case 'studio-v4':
      return (
        <AuthMock value={{ isAdmin: true, user: { username: 'akeem', role: 'admin' } }}>
          <SovereignStudioV4 />
        </AuthMock>
      );
    case 'sovereign-prep-panels':
      // Direct-prop mount of the shared Sovereign Prep renderer (bypasses
      // Recovery.jsx's live bbf-agentic-recovery fetch) — exercises the REAL
      // collapsed video row + mini-player pop-up on a static prep envelope.
      // 'stat_calf_001' is a real key in data/recoveryVideos.js (a demo IS
      // available); 'no_demo_item' matches nothing (a card with no video row).
      return (
        <SovereignPrepPanels
          data={{
            prep_drills: [{
              id: 'stat_calf_001', name: 'Wall Calf Stretch', muscle_group: 'calf',
              prescription: { reps: '10', tempo: 'controlled' },
              cues: { form: 'Keep the back heel grounded.' },
            }],
            recovery_stretches: [],
            foam_rolling: [{
              id: 'no_demo_item', name: 'Undemoed Movement', muscle_group: 'back',
              prescription: { passes: '3' }, cues: {},
            }],
          }}
        />
      );
    case 'client-hub':
      // Coaching Velocity rig — the REAL ClientHub + RosterProvider under an
      // admin session; the spec intercepts the roster edge fn + telemetry RPCs.
      return (
        <MemoryRouter>
          <AuthMock value={{ isAdmin: true, user: { username: 'akeem', role: 'admin' }, session: { vaultToken: 'test-vault-token' } }}>
            <RosterProvider><ClientHub /></RosterProvider>
          </AuthMock>
        </MemoryRouter>
      );
    case 'premium-session': {
      // Product 1 rig — the REAL player + engine + inflection governor, driven by
      // a synthetic play contract of decodable silent-WAV clips (no network) and a
      // spec-controlled HR feed (window.__pushHr). Governor timing comes from the
      // manifest policy, so the spec compresses hysteresis/cooldown to test scale.
      const clip = () => silentWavUrl(500);
      const manifest = {
        day: '2026-01-01', locale: 'en', category: 'strength', zone: 'green',
        total_duration_ms: 30_000,
        music: null, // voice-only — the bed is an enhancement layer (blueprint §2.6)
        timeline: [
          { slot: 'W0_INTRO', path: 'seg/a.mp3', url: clip(), start_ms: 0, duration_ms: 500, gap_after_ms: 200 },
          { slot: 'B1_S1_CALL', path: 'seg/b.mp3', url: clip(), start_ms: 1500, duration_ms: 500, gap_after_ms: 200 },
        ],
        degraded_slots: [],
        blocks: [{
          id: 'B1', exercise: 'Lateral Pull-Down', sets: 3, reps: '8-10', rest_target_s: 90,
          hr_band: { floor: 110, ceiling: 150 }, work_window_ms: [0, 30_000],
        }],
        inflections: {
          variants: {
            INF_HR_LOW: { path: 'inf/low.mp3', url: clip(), duration_ms: 500 },
            INF_HR_HIGH: { path: 'inf/high.mp3', url: clip(), duration_ms: 500 },
            INF_ON_TARGET: { path: 'inf/on.mp3', url: clip(), duration_ms: 500 },
          },
          policy: { hysteresis_s: 0.2, cooldown_s: 0.5, inject_at: 'seam_only' },
        },
      };
      const hrSource = (cb) => {
        window.__pushHr = (bpm) => cb(bpm);
        return () => { delete window.__pushHr; };
      };
      return (
        <PremiumSessionPlayer
          plan={null}
          fetchManifest={async () => manifest}
          hrSource={hrSource}
        />
      );
    }
    case 'live-checkin':
      // Product 2 rig — the REAL component state machine over a scripted fake
      // session (no ElevenLabs/network): connect → agent turn → commitment →
      // client-driven end. Mirrors the hooks contract of lib/convaiSession.js.
      return (
        <LiveCheckinCoach
          mode={props.mode || 'mindset'}
          sessionFactory={async ({ hooks }) => {
            setTimeout(() => hooks.onStatus?.('connected'), 30);
            setTimeout(() => hooks.onModeChange?.('speaking'), 60);
            setTimeout(() => hooks.onAgentResponse?.("There he is. Talk to me — where's your head at today?"), 90);
            setTimeout(() => hooks.onTranscript?.('Locked in. Three fasted walks this week.'), 140);
            setTimeout(() => hooks.onCommitment?.({ text: 'Three fasted walks', due: 'this week' }), 180);
            return { end: async () => hooks.onDisconnect?.(), sessionId: 'harness-session', capMin: 8 };
          }}
        />
      );
    case 'guide-launcher':
      // The BBF Media Portal dual-media launcher, wrapped in a real AuthMock so the
      // TierGate around it fail-opens (soft/resolving) and the triggers render — the
      // exact production path the four module hosts embed.
      return (
        <AuthMock value={{ isAdmin: false, user: props.user ?? { username: 'akeem' } }}>
          <GuideLauncher module={props.module || 'program_execution'} testId="guide" />
        </AuthMock>
      );
    case 'broadcast-hub':
      // Coach Lab Broadcast Hub — newsletter + the new video-reel mode. Admin
      // session so the studio-voiceover / vault calls fire as they do in prod.
      return (
        <MemoryRouter>
          <AuthMock value={{ isAdmin: true, user: { username: 'akeem', role: 'admin' }, session: { vaultToken: 'test-vault-token' } }}>
            <BroadcastHub />
          </AuthMock>
        </MemoryRouter>
      );
    case 'bodyweight-card':
      // Sovereign Vault weigh-in tracker — adult self-write via vault-token RPCs.
      return (
        <MemoryRouter>
          <AuthMock value={{ isAdmin: false, user: { username: 'akeem', role: 'client' }, session: { vaultToken: 'test-vault-token' } }}>
            <BodyweightCard />
          </AuthMock>
        </MemoryRouter>
      );
    default:
      return <div data-testid="harness-unknown">unknown component: {which}</div>;
  }
}

createRoot(document.getElementById('root')).render(
  <LangProvider>
    <div data-testid="harness-root" style={{ padding: 24 }}>{pick()}</div>
  </LangProvider>,
);
