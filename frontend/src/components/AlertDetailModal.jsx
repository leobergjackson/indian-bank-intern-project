import React, { useState } from "react";
import { SeverityBadge, StatusBadge, CategoryBadge } from "./Badges.jsx";
import { formatDateTime, metricLabel, formatMetricValue } from "../format.js";
import { updateAlertStatus, createAlertTask, updateAlertTask, deleteAlertTask } from "../api.js";

export default function AlertDetailModal({ alert, onClose, onUpdated }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [newTaskText, setNewTaskText] = useState("");

  const tasks = alert.tasks || [];

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

  async function handleAddTask(e) {
    e.preventDefault();
    if (!newTaskText.trim()) return;
    setBusy(true);
    try {
      const task = await createAlertTask(alert.id, { description: newTaskText.trim(), is_completed: false });
      const updatedAlert = { ...alert, tasks: [...tasks, task] };
      onUpdated(updatedAlert);
      setNewTaskText("");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleTask(task) {
    setBusy(true);
    try {
      const updatedTask = await updateAlertTask(task.id, !task.is_completed);
      const updatedAlert = { ...alert, tasks: tasks.map(t => t.id === task.id ? updatedTask : t) };
      onUpdated(updatedAlert);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteTask(taskId) {
    setBusy(true);
    try {
      await deleteAlertTask(taskId);
      const updatedAlert = { ...alert, tasks: tasks.filter(t => t.id !== taskId) };
      onUpdated(updatedAlert);
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

        <div className="tasks-section" style={{ marginTop: "1.5rem", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
          <h3 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>Checklist / Notes</h3>
          <ul style={{ listStyle: "none", padding: 0, margin: "0 0 1rem 0" }}>
            {tasks.map(task => (
              <li key={task.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <input 
                  type="checkbox" 
                  checked={task.is_completed} 
                  onChange={() => handleToggleTask(task)}
                  disabled={busy}
                />
                <span style={{ flex: 1, textDecoration: task.is_completed ? "line-through" : "none", color: task.is_completed ? "var(--muted)" : "inherit" }}>
                  {task.description}
                </span>
                <button 
                  className="icon-btn btn-xs" 
                  onClick={() => handleDeleteTask(task.id)}
                  disabled={busy}
                  style={{ opacity: 0.5 }}
                >
                  ×
                </button>
              </li>
            ))}
            {tasks.length === 0 && <li className="muted" style={{ fontSize: "0.9rem" }}>No items yet.</li>}
          </ul>
          
          <form onSubmit={handleAddTask} style={{ display: "flex", gap: "0.5rem" }}>
            <input 
              type="text" 
              placeholder="Add a new task or note..." 
              value={newTaskText}
              onChange={(e) => setNewTaskText(e.target.value)}
              disabled={busy}
              style={{ flex: 1 }}
            />
            <button type="submit" className="btn btn-default btn-sm" disabled={busy || !newTaskText.trim()}>Add</button>
          </form>
        </div>

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
