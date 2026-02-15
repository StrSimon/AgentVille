import { useEffect, useRef, useState } from 'react';
import type { AgentEvent } from '../types';

const BRIDGE_URL = import.meta.env.VITE_BRIDGE_URL || 'http://localhost:4242';

export function useBridge(
  onEvent: (event: AgentEvent) => void,
  enabled: boolean,
) {
  const [connected, setConnected] = useState(false);
  const [everConnected, setEverConnected] = useState(false);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!enabled) {
      setConnected(false);
      return;
    }

    let abortController: AbortController | null = null;
    let retryTimeout: number | null = null;
    let disposed = false;

    async function connect() {
      if (disposed) return;

      abortController = new AbortController();

      try {
        const res = await fetch(`${BRIDGE_URL}/events`, {
          signal: abortController.signal,
        });

        if (!res.ok || !res.body) {
          throw new Error('SSE connection failed');
        }

        setConnected(true);
        setEverConnected(true);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done || disposed) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE frames: "data: {...}\n\n"
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const event = JSON.parse(line.slice(6)) as AgentEvent;
                onEventRef.current(event);
              } catch {
                // ignore parse errors
              }
            }
          }
        }
      } catch {
        // fetch aborted or network error
      }

      if (!disposed) {
        setConnected(false);
        retryTimeout = window.setTimeout(connect, 3000);
      }
    }

    connect();

    return () => {
      disposed = true;
      abortController?.abort();
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [enabled]);

  return { connected, everConnected };
}
