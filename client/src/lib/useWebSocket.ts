import { useEffect, useRef, useCallback, useState } from "react";

type MessageHandler = (data: any) => void;

export function useWebSocket(onMessage: MessageHandler) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const handlersRef = useRef(onMessage);
  handlersRef.current = onMessage;

  const connect = useCallback(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      // Reconnect after 3 seconds
      setTimeout(connect, 3000);
    };
    ws.onerror = () => ws.close();
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handlersRef.current(data);
      } catch (e) {
        console.error("WS parse error", e);
      }
    };

    return ws;
  }, []);

  useEffect(() => {
    const ws = connect();
    return () => {
      ws.close();
    };
  }, [connect]);

  return { connected };
}
