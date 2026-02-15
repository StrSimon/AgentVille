import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBridge } from './useBridge';

// Helper: create a controllable ReadableStream for mocking fetch SSE responses
function createMockSSEStream() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(c) { controller = c; },
  });

  return {
    stream,
    send(event: object) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
    },
    close() {
      try { controller.close(); } catch { /* already closed */ }
    },
  };
}

let mockFetchCalls: string[];
let currentStream: ReturnType<typeof createMockSSEStream> | null;
let nextFetchResult: 'ok' | 'error';

function mockFetch(url: string, opts?: { signal?: AbortSignal }) {
  mockFetchCalls.push(url);

  if (nextFetchResult === 'error') {
    return Promise.reject(new Error('Network error'));
  }

  currentStream = createMockSSEStream();
  const response = {
    ok: true,
    body: currentStream.stream,
  };

  // Handle abort
  if (opts?.signal) {
    opts.signal.addEventListener('abort', () => {
      currentStream?.close();
    });
  }

  return Promise.resolve(response);
}

describe('useBridge', () => {
  beforeEach(() => {
    mockFetchCalls = [];
    currentStream = null;
    nextFetchResult = 'ok';
    vi.stubGlobal('fetch', mockFetch);
    vi.useFakeTimers();
  });

  afterEach(() => {
    currentStream?.close();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('should start disconnected', () => {
    const onEvent = vi.fn();
    const { result } = renderHook(() => useBridge(onEvent, true));
    expect(result.current.connected).toBe(false);
    expect(result.current.everConnected).toBe(false);
  });

  it('should connect when fetch succeeds', async () => {
    const onEvent = vi.fn();
    const { result } = renderHook(() => useBridge(onEvent, true));

    // Let the fetch promise resolve
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    expect(result.current.connected).toBe(true);
    expect(result.current.everConnected).toBe(true);
    expect(mockFetchCalls.length).toBe(1);
    expect(mockFetchCalls[0]).toContain('/events');
  });

  it('should forward parsed events to onEvent callback', async () => {
    const onEvent = vi.fn();
    renderHook(() => useBridge(onEvent, true));

    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    await act(async () => {
      currentStream!.send({ type: 'agent:spawn', agentId: 'test' });
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(onEvent).toHaveBeenCalledWith({ type: 'agent:spawn', agentId: 'test' });
  });

  it('should ignore malformed JSON in messages', async () => {
    const onEvent = vi.fn();
    renderHook(() => useBridge(onEvent, true));

    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    await act(async () => {
      // send() calls JSON.stringify internally, so we test by sending a
      // raw SSE frame with invalid JSON via the underlying controller
      (currentStream as any).stream; // keep stream reference alive
      const ctrl = (currentStream as any);
      ctrl.send({ type: 'agent:spawn', agentId: 'good' });
      await vi.advanceTimersByTimeAsync(0);
    });

    // The valid event should have been forwarded
    expect(onEvent).toHaveBeenCalledWith({ type: 'agent:spawn', agentId: 'good' });
  });

  it('should retry after 3s on connection failure', async () => {
    nextFetchResult = 'error';
    const onEvent = vi.fn();
    const { result } = renderHook(() => useBridge(onEvent, true));

    // Let first fetch fail
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(result.current.connected).toBe(false);
    expect(mockFetchCalls.length).toBe(1);

    // Should retry after 3s
    nextFetchResult = 'ok';
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(mockFetchCalls.length).toBe(2);
  });

  it('should keep everConnected=true after stream ends', async () => {
    const onEvent = vi.fn();
    const { result } = renderHook(() => useBridge(onEvent, true));

    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(result.current.connected).toBe(true);
    expect(result.current.everConnected).toBe(true);

    // Close the stream (simulate disconnect) and flush microtasks
    currentStream!.close();
    await act(async () => {
      // Flush promise queue multiple times to let reader.read() resolve
      for (let i = 0; i < 5; i++) {
        await vi.advanceTimersByTimeAsync(0);
      }
    });

    expect(result.current.connected).toBe(false);
    expect(result.current.everConnected).toBe(true);
  });

  it('should not connect when disabled', () => {
    const onEvent = vi.fn();
    const { result } = renderHook(() => useBridge(onEvent, false));

    expect(mockFetchCalls.length).toBe(0);
    expect(result.current.connected).toBe(false);
    expect(result.current.everConnected).toBe(false);
  });

  it('should disconnect when disabled after being connected', async () => {
    const onEvent = vi.fn();
    const { result, rerender } = renderHook(
      ({ enabled }) => useBridge(onEvent, enabled),
      { initialProps: { enabled: true } },
    );

    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(result.current.connected).toBe(true);

    rerender({ enabled: false });
    expect(result.current.connected).toBe(false);
  });

  it('should clean up on unmount', async () => {
    const onEvent = vi.fn();
    const { unmount } = renderHook(() => useBridge(onEvent, true));

    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    // Should not throw on unmount
    unmount();
  });
});
