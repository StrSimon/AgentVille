import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "agentville-sound";

export function useSound(): {
  enabled: boolean;
  toggle: () => void;
  playSpawn: () => void;
  playDespawn: () => void;
  playMove: () => void;
} {
  const [enabled, setEnabled] = useState(
    () => localStorage.getItem(STORAGE_KEY) === "true",
  );
  const ctxRef = useRef<AudioContext | null>(null);

  const getCtx = useCallback((): AudioContext => {
    if (!ctxRef.current) ctxRef.current = new AudioContext();
    // Resume suspended context (browser autoplay policy)
    if (ctxRef.current.state === 'suspended') ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  useEffect(() => {
    return () => {
      ctxRef.current?.close();
      ctxRef.current = null;
    };
  }, []);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      if (next) getCtx(); // lazily create on first enable
      return next;
    });
  }, [getCtx]);

  const playSpawn = useCallback(() => {
    if (!enabled) return;
    const ctx = getCtx();
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    gain.connect(ctx.destination);

    const o1 = ctx.createOscillator();
    o1.type = "sine";
    o1.frequency.setValueAtTime(440, now);
    o1.frequency.linearRampToValueAtTime(660, now + 0.2);
    o1.connect(gain);
    o1.start(now);
    o1.stop(now + 0.25);

    const o2 = ctx.createOscillator();
    o2.type = "sine";
    o2.frequency.setValueAtTime(554, now);
    o2.frequency.linearRampToValueAtTime(830, now + 0.2);
    o2.connect(gain);
    o2.start(now);
    o2.stop(now + 0.25);
  }, [enabled, getCtx]);

  const playDespawn = useCallback(() => {
    if (!enabled) return;
    const ctx = getCtx();
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    gain.connect(ctx.destination);

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.linearRampToValueAtTime(220, now + 0.2);
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 0.25);
  }, [enabled, getCtx]);

  const playMove = useCallback(() => {
    if (!enabled) return;
    const ctx = getCtx();
    const now = ctx.currentTime;
    const dur = 0.08;

    const bufferSize = Math.ceil(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 2000;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.03, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start(now);
    source.stop(now + dur);
  }, [enabled, getCtx]);

  return { enabled, toggle, playSpawn, playDespawn, playMove };
}
