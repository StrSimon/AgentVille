// Ambient village sounds, synthesized (no music, no assets): birds by day,
// crickets at night, the forge's hammer, rain and thunder. Off by default.
const KEY = 'agentville-ambience';

let ctx: AudioContext | null = null;
let rainGain: GainNode | null = null;
let enabled = localStorage.getItem(KEY) === 'on';
let nextBird = 0, nextCricket = 0, nextHammer = 0;

function audio(): AudioContext | null {
  if (!enabled) return null;
  try {
    ctx ||= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function noiseBuffer(a: AudioContext, seconds: number): AudioBuffer {
  const buf = a.createBuffer(1, a.sampleRate * seconds, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function ensureRain(a: AudioContext): GainNode {
  if (rainGain) return rainGain;
  const src = a.createBufferSource();
  src.buffer = noiseBuffer(a, 3);
  src.loop = true;
  const lp = a.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1400;
  rainGain = a.createGain();
  rainGain.gain.value = 0;
  src.connect(lp).connect(rainGain).connect(a.destination);
  src.start();
  return rainGain;
}

function blip(a: AudioContext, freq: number, at: number, len: number, gain: number, type: OscillatorType = 'sine', to?: number): void {
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  if (to) o.frequency.exponentialRampToValueAtTime(to, at + len);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, at + len);
  o.connect(g).connect(a.destination);
  o.start(at);
  o.stop(at + len + 0.02);
}

export const ambience = {
  get enabled(): boolean { return enabled; },
  set(on: boolean): void {
    enabled = on;
    localStorage.setItem(KEY, on ? 'on' : 'off');
    if (!on && rainGain) rainGain.gain.value = 0;
  },

  /** Call about once a second with the current scene. */
  update({ night, rain, forge }: { night: number; rain: number; forge: boolean }): void {
    const a = audio();
    if (!a) return;
    const now = a.currentTime;
    ensureRain(a).gain.setTargetAtTime(rain * 0.07, now, 1.5);
    const wall = performance.now() / 1000;
    if (night < 0.4 && rain < 0.2 && wall > nextBird) {
      nextBird = wall + 3 + Math.random() * 7;
      const base = 2600 + Math.random() * 1400;
      for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) blip(a, base * (1 + i * 0.06), now + i * 0.13, 0.09, 0.012, 'sine', base * 1.35);
    }
    if (night > 0.6 && rain < 0.4 && wall > nextCricket) {
      nextCricket = wall + 1.5 + Math.random() * 3;
      for (let i = 0; i < 3; i++) blip(a, 4600, now + i * 0.07, 0.04, 0.006, 'triangle');
    }
    if (forge && wall > nextHammer) {
      nextHammer = wall + 1.1 + Math.random() * 1.4;
      blip(a, 2200, now, 0.18, 0.01, 'triangle');
      blip(a, 3650, now, 0.12, 0.006, 'sine');
    }
  },

  thunder(strength: number): void {
    const a = audio();
    if (!a) return;
    const src = a.createBufferSource();
    src.buffer = noiseBuffer(a, 3);
    const lp = a.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 180;
    const g = a.createGain();
    const now = a.currentTime;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.35 * strength, now + 0.15);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 2.8);
    src.connect(lp).connect(g).connect(a.destination);
    src.start(now);
    src.stop(now + 3);
  },
};
