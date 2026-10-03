// Tiny Web Audio synth — no assets, works offline.
let ctx: AudioContext | null = null;
let enabled = localStorage.getItem('agentville-sound') !== 'off';

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

function tone(freqs: number[], { type = 'sine' as OscillatorType, step = 0.1, len = 0.3, gain = 0.06 } = {}): void {
  const a = audio();
  if (!a) return;
  freqs.forEach((f, i) => {
    const t = a.currentTime + i * step;
    const g = a.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    g.connect(a.destination);
    const o = a.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    o.connect(g);
    o.start(t);
    o.stop(t + len);
  });
}

export const sound = {
  get enabled(): boolean { return enabled; },
  set(on: boolean): void {
    enabled = on;
    localStorage.setItem('agentville-sound', on ? 'on' : 'off');
  },
  /** A dwarf needs you — a bright two-note bell. */
  attention: (): void => tone([880, 1175], { type: 'triangle', step: 0.14, len: 0.5, gain: 0.07 }),
  /** A dwarf finished and waits — soft single chime. */
  done: (): void => tone([659, 523], { step: 0.16, len: 0.45, gain: 0.04 }),
  spawn: (): void => tone([440, 660], { step: 0.06, len: 0.22, gain: 0.04 }),
  achievement: (): void => tone([392, 494, 587, 659, 784], { type: 'triangle', step: 0.11, len: 0.35, gain: 0.05 }),
  approve: (): void => tone([523, 784], { step: 0.07, len: 0.2, gain: 0.05 }),
};
