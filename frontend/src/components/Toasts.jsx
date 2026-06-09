import React from "react";
import { useLive } from "../context/LiveContext.jsx";

// Floating toast stack driven by the live WebSocket feed.
export default function Toasts() {
  const { toasts, dismissToast } = useLive();
  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <div key={t.id} className={`toast sev-border-${(t.severity || "").toLowerCase()}`}>
          <div className="toast-head">
            <span className={`badge sev-${(t.severity || "").toLowerCase()}`}>{t.severity}</span>
            <strong>{t.title}</strong>
            <button className="toast-close" onClick={() => dismissToast(t.id)}>
              ×
            </button>
          </div>
          <div className="toast-body">{t.body}</div>
        </div>
      ))}
    </div>
  );
}
