// Generates royalty-free (self-synthesized) SFX for the CTA card as 16-bit PCM
// WAVs in public/sfx/. No network, no deps, deterministic PRNG -> reproducible.
//   sub-bass-hit.wav — deep pitch-glide impact for the "BORROWED" landing
//   whoosh.wav        — soft airy noise swoosh for the headline entrance
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SR = 44100;
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'sfx');
mkdirSync(OUT, { recursive: true });

function writeWav(name, samples) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32); // block align
  buf.writeUInt16LE(16, 34); // bits/sample
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  writeFileSync(join(OUT, name), buf);
  return n / SR;
}

// deterministic LCG so the committed WAVs never drift between machines
let seed = 1337;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return (seed / 0xffffffff) * 2 - 1;
};

// ── sub-bass hit: pitch glide 95 -> 42 Hz, fast attack, exp decay, soft sat ──
function subBass() {
  const n = Math.floor(SR * 1.4);
  const out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = 42 + (95 - 42) * Math.exp(-t / 0.05);
    phase += (TwoPi * f) / SR;
    const env = (1 - Math.exp(-t / 0.004)) * Math.exp(-t / 0.42);
    const click = t < 0.006 ? rand() * 0.5 * (1 - t / 0.006) : 0; // attack transient
    let s = (Math.sin(phase) + 0.18 * Math.sin(2 * phase)) * env + click;
    s = Math.tanh(s * 1.7) * 0.92; // soft saturation + headroom
    out[i] = s;
  }
  return out;
}

// ── whoosh: noise -> one-pole LP with sweeping cutoff, raised-cosine swell ───
function whoosh() {
  const n = Math.floor(SR * 0.62);
  const out = new Float32Array(n);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const x = i / n; // 0..1
    const cut = 0.02 + 0.5 * Math.sin(Math.PI * x); // cutoff rises then falls
    lp += cut * (rand() - lp);
    const env = Math.pow(Math.sin(Math.PI * x), 1.5); // soft swell in/out
    out[i] = lp * env * 0.7;
  }
  return out;
}

const TwoPi = Math.PI * 2;
const d1 = writeWav('sub-bass-hit.wav', subBass());
const d2 = writeWav('whoosh.wav', whoosh());
console.log(
  `SFX -> public/sfx/  (sub-bass-hit.wav ${d1.toFixed(2)}s, whoosh.wav ${d2.toFixed(2)}s)`,
);
