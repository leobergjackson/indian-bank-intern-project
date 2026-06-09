import React, { useState } from "react";
import { SeverityBadge, StatusBadge, CategoryBadge } from "./Badges.jsx";
import { formatDateTime, metricLabel, formatMetricValue } from "../format.js";
import { updateAlertStatus } from "../api.js";

export default function AlertDetailModal({ alert, onClose, onUpdated }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function setStatus(status) {
    setBusy(true);
    setError("");
    try {
      const updated = await updateAlertStatus(alert.id, status);
      onUpdated(updated);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const rows = [
    ["Alert ID", `#${alert.id}`],
    ["Rule", alert.rule_name],
    ["Metric", metricLabel(alert.metric)],
    ["Threshold", formatMetricValue(alert.metric, alert.threshold_value)],
    ["Actual value", formatMetricValue(alert.metric, alert.actual_value)],
    ["Source", alert.source || "—"],
    ["Triggered at", formatDateTime(alert.triggered_at)],
    ["Acknowledged", alert.acknowledged_at ? `${formatDateTime(alert.acknowledged_at)} by ${alert.acknowledged_by}` : "—"],
    ["Resolved", alert.resolved_at ? `${formatDateTime(alert.resolved_at)} by ${alert.resolved_by}` : "—"],
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title-group">
            <SeverityBadge severity={alert.severity} />
            <CategoryBadge category={alert.category} />
            <StatusBadge status={alert.status} />
          </div>
          <button className="icon-btn" onClick={onClose}>×</button>
        </div>

        <h2 className="modal-title">{alert.rule_name}</h2>
        <p className="modal-message">{alert.message}</p>

        <table className="detail-table">
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k}>
                <th>{k}</th>
                <td>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {error && <div className="form-error">{error}</div>}

        <div className="modal-actions">
          <button
            className="btn btn-warn"
            disabled={busy || alert.status !== "Active"}
            onClick={() => setStatus("Acknowledged")}
          >
            Acknowledge
          </button>
          <button
            className="btn btn-success"
            disabled={busy || alert.status === "Resolved"}
            onClick={() => setStatus("Resolved")}
          >
            Resolve
          </button>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
