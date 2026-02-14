import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSimulator } from './simulator';
import type { AgentEvent } from './types';

describe('createSimulator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return start and stop functions', () => {
    const sim = createSimulator(() => {});
    expect(typeof sim.start).toBe('function');
    expect(typeof sim.stop).toBe('function');
  });

  it('should emit spawn events after start', () => {
    const events: AgentEvent[] = [];
    const sim = createSimulator((e) => events.push(e));
    sim.start();

    // Advance past the first spawn (500ms + a bit)
    vi.advanceTimersByTime(600);

    const spawns = events.filter(e => e.type === 'agent:spawn');
    expect(spawns.length).toBeGreaterThanOrEqual(1);

    sim.stop();
  });

  it('should emit work events', () => {
    const events: AgentEvent[] = [];
    const sim = createSimulator((e) => events.push(e));
    sim.start();

    vi.advanceTimersByTime(2000);

    const workEvents = events.filter(e => e.type === 'agent:work');
    expect(workEvents.length).toBeGreaterThanOrEqual(1);

    sim.stop();
  });

  it('should emit despawn events', () => {
    const events: AgentEvent[] = [];
    const sim = createSimulator((e) => events.push(e));
    sim.start();

    // Hotfix despawns at ~4500+random, researcher at ~16000ms, tester at 18000ms
    vi.advanceTimersByTime(20000);

    const despawns = events.filter(e => e.type === 'agent:despawn');
    expect(despawns.length).toBeGreaterThanOrEqual(1);

    sim.stop();
  });

  it('should stop emitting events after stop()', () => {
    const events: AgentEvent[] = [];
    const sim = createSimulator((e) => events.push(e));
    sim.start();
    vi.advanceTimersByTime(1000);

    sim.stop();
    const countAfterStop = events.length;

    vi.advanceTimersByTime(30000);
    expect(events.length).toBe(countAfterStop);
  });

  it('spawn events should include agentId and agentName', () => {
    const events: AgentEvent[] = [];
    const sim = createSimulator((e) => events.push(e));
    sim.start();
    vi.advanceTimersByTime(600);

    const spawn = events.find(e => e.type === 'agent:spawn');
    expect(spawn).toBeDefined();
    expect(spawn!.agentId).toBeTruthy();
    expect(spawn!.agentName).toBeTruthy();
    expect(spawn!.level).toBeGreaterThanOrEqual(1);

    sim.stop();
  });

  it('work events should include activity and targetBuilding', () => {
    const events: AgentEvent[] = [];
    const sim = createSimulator((e) => events.push(e));
    sim.start();
    vi.advanceTimersByTime(2000);

    const work = events.find(e => e.type === 'agent:work');
    expect(work).toBeDefined();
    expect(work!.activity).toBeTruthy();
    expect(work!.targetBuilding).toBeTruthy();

    sim.stop();
  });

  it('should create sub-agents with parentId', () => {
    const events: AgentEvent[] = [];
    const sim = createSimulator((e) => events.push(e));
    sim.start();

    // Coders spawn at ~3500ms as sub-agents of orchestrator
    vi.advanceTimersByTime(5000);

    const subSpawns = events.filter(e => e.type === 'agent:spawn' && e.parentId);
    expect(subSpawns.length).toBeGreaterThanOrEqual(1);

    sim.stop();
  });

  it('should run multiple workflow cycles over time', () => {
    const events: AgentEvent[] = [];
    const sim = createSimulator((e) => events.push(e));
    sim.start();

    vi.advanceTimersByTime(30000);

    // Should have many events from multiple cycles
    expect(events.length).toBeGreaterThan(20);

    sim.stop();
  });
});
