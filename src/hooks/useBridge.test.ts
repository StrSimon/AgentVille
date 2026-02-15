import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBridge } from './useBridge';

// Mock EventSource
class MockEventSource {
  static instances: MockEventSource[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  url: string;
  closed = false;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  close() {
    this.closed = true;
  }
}

describe('useBridge', () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    vi.stubGlobal('EventSource', MockEventSource);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('should start disconnected', () => {
    const onEvent = vi.fn();
    const { result } = renderHook(() => useBridge(onEvent, true));
    expect(result.current.connected).toBe(false);
    expect(result.current.everConnected).toBe(false);
  });

  it('should connect when EventSource opens', () => {
    const onEvent = vi.fn();
    const { result } = renderHook(() => useBridge(onEvent, true));

    const es = MockEventSource.instances[0];
    act(() => { es.onopen!(); });

    expect(result.current.connected).toBe(true);
    expect(result.current.everConnected).toBe(true);
  });

  it('should forward parsed events to onEvent callback', () => {
    const onEvent = vi.fn();
    renderHook(() => useBridge(onEvent, true));

    const es = MockEventSource.instances[0];
    act(() => { es.onopen!(); });
    act(() => {
      es.onmessage!({ data: JSON.stringify({ type: 'agent:spawn', agentId: 'test' }) });
    });

    expect(onEvent).toHaveBeenCalledWith({ type: 'agent:spawn', agentId: 'test' });
  });

  it('should ignore malformed JSON in messages', () => {
    const onEvent = vi.fn();
    renderHook(() => useBridge(onEvent, true));

    const es = MockEventSource.instances[0];
    act(() => { es.onopen!(); });
    act(() => {
      es.onmessage!({ data: 'not json' });
    });

    expect(onEvent).not.toHaveBeenCalled();
  });

  it('should set connected=false on error and retry after 3s', () => {
    const onEvent = vi.fn();
    const { result } = renderHook(() => useBridge(onEvent, true));

    const es1 = MockEventSource.instances[0];
    act(() => { es1.onopen!(); });
    expect(result.current.connected).toBe(true);

    act(() => { es1.onerror!(); });
    expect(result.current.connected).toBe(false);
    expect(es1.closed).toBe(true);

    // Should retry after 3s
    act(() => { vi.advanceTimersByTime(3000); });
    expect(MockEventSource.instances.length).toBe(2);
  });

  it('should keep everConnected=true after disconnect', () => {
    const onEvent = vi.fn();
    const { result } = renderHook(() => useBridge(onEvent, true));

    const es = MockEventSource.instances[0];
    act(() => { es.onopen!(); });
    expect(result.current.everConnected).toBe(true);

    act(() => { es.onerror!(); });
    expect(result.current.connected).toBe(false);
    expect(result.current.everConnected).toBe(true);
  });

  it('should not connect when disabled', () => {
    const onEvent = vi.fn();
    const { result } = renderHook(() => useBridge(onEvent, false));

    expect(MockEventSource.instances.length).toBe(0);
    expect(result.current.connected).toBe(false);
    expect(result.current.everConnected).toBe(false);
  });

  it('should disconnect when disabled after being connected', () => {
    const onEvent = vi.fn();
    const { result, rerender } = renderHook(
      ({ enabled }) => useBridge(onEvent, enabled),
      { initialProps: { enabled: true } },
    );

    const es = MockEventSource.instances[0];
    act(() => { es.onopen!(); });
    expect(result.current.connected).toBe(true);

    rerender({ enabled: false });
    expect(result.current.connected).toBe(false);
    expect(es.closed).toBe(true);
  });

  it('should clean up on unmount', () => {
    const onEvent = vi.fn();
    const { unmount } = renderHook(() => useBridge(onEvent, true));

    const es = MockEventSource.instances[0];
    unmount();
    expect(es.closed).toBe(true);
  });
});
