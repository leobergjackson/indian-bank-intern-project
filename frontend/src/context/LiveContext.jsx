import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";

// LiveContext owns the single WebSocket connection to the backend and fans
// events out to subscribers. It also drives toast notifications and the
// unread-alert badge in the navbar.

const LiveContext = createContext(null);

export function useLive() {
  const ctx = useContext(LiveContext);
  if (!ctx) throw new Error("useLive must be used within <LiveProvider>");
  return ctx;
}

let toastId = 0;

export function LiveProvider({ children }) {
  const [connected, setConnected] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [unread, setUnread] = useState(0);
  const subscribers = useRef(new Set());
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);

  const subscribe = useCallback((cb) => {
    subscribers.current.add(cb);
    return () => subscribers.current.delete(cb);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const pushToast = useCallback((toast) => {
    const id = ++toastId;
    setToasts((t) => [...t, { id, ...toast }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
  }, []);

  const clearUnread = useCallback(() => setUnread(0), []);

  useEffect(() => {
    let stopped = false;

    function connect() {
      let wsUrl = import.meta.env.VITE_WS_URL;
      if (!wsUrl) {
        const apiBase = import.meta.env.VITE_API_URL;
        if (apiBase) {
          const url = new URL(apiBase);
          wsUrl = `${url.protocol === 'https:' ? 'wss:' : 'ws:'}//${url.host}/ws/alerts`;
        } else {
          const proto = window.location.protocol === "https:" ? "wss" : "ws";
          wsUrl = `${proto}://${window.location.host}/ws/alerts`;
        }
      }
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        if (!stopped) reconnectTimer.current = setTimeout(connect, 2000);
      };
      ws.onerror = () => ws.close();
      ws.onmessage = (evt) => {
        let msg;
        try {
          msg = JSON.parse(evt.data);
        } catch {
          return;
        }
        if (msg.type === "alert" && msg.data) {
          setUnread((u) => u + 1);
          pushToast({
            severity: msg.data.severity,
            title: msg.data.rule_name,
            body: msg.data.message,
          });
        }
        // Notify all page-level subscribers of every event.
        subscribers.current.forEach((cb) => {
          try {
            cb(msg);
          } catch {
            /* ignore subscriber errors */
          }
        });
      };
    }

    connect();
    return () => {
      stopped = true;
      clearTimeout(reconnectTimer.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [pushToast]);

  // Polling fallback — keeps the UI fresh where WebSockets aren't available
  // (e.g. serverless / Vercel). Emits a synthetic "poll" event that page-level
  // subscribers treat as a refetch signal. Harmless alongside a live socket.
  useEffect(() => {
    const interval = setInterval(() => {
      subscribers.current.forEach((cb) => {
        try {
          cb({ type: "poll" });
        } catch {
          /* ignore subscriber errors */
        }
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const value = { connected, toasts, unread, subscribe, dismissToast, pushToast, clearUnread };
  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}
