import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * UC-13 — WebSocket hook for real-time sensor data
 * Connects to Django Channels WS endpoint, auto-reconnects
 */
export function useWebSocket(url, { onMessage, enabled = true } = {}) {
  const ws = useRef(null);
  const reconnectTimer = useRef(null);
  const [status, setStatus] = useState('disconnected'); // connecting | connected | disconnected | error

  const connect = useCallback(() => {
    if (!enabled || !url) return;
    setStatus('connecting');
    const socket = new WebSocket(url);
    ws.current = socket;

    socket.onopen = () => setStatus('connected');

    socket.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        onMessage?.(data);
      } catch {
        // ignore malformed
      }
    };

    socket.onerror = () => setStatus('error');

    socket.onclose = (e) => {
      setStatus('disconnected');
      if (!e.wasClean && enabled) {
        reconnectTimer.current = setTimeout(connect, 3000);
      }
    };
  }, [url, enabled, onMessage]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      ws.current?.close(1000, 'unmount');
    };
  }, [connect]);

  const send = useCallback((data) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(data));
    }
  }, []);

  return { status, send };
}
