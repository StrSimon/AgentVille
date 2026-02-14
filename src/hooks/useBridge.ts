import { useEffect, useRef, useState } from 'react';
import type { AgentEvent } from '../types';

const BRIDGE_URL = import.meta.env.VITE_BRIDGE_URL || 'http://localhost:4242';

export function useBridge(
  onEvent: (event: AgentEvent) => void,
  enabled: boolean,
) {
  const [connected, setConnected] = useState(false);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!enabled) {
      setConnected(false);
      return;
    }

    let es: EventSource | null = null;
    let retryTimeout: number | null = null;
    let disposed = false;

    function connect() {
      if (disposed) return;

      es = new EventSource(`${BRIDGE_URL}/events`);

      es.onopen = () => {
        setConnected(true);
      };

      es.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data) as AgentEvent;
          onEventRef.current(event);
        } catch {
          // ignore parse errors
        }
      };

      es.onerror = () => {
        setConnected(false);
        es?.close();
        // Retry after 3 seconds
        retryTimeout = window.setTimeout(connect, 3000);
      };
    }

    connect();

    return () => {
      disposed = true;
      es?.close();
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [enabled]);

  return { connected };
}
