import React, { useCallback, useEffect, useRef, useState } from "react";
import StatCard from "../components/StatCard.jsx";
import { SeverityBadge, StatusBadge, CategoryBadge } from "../components/Badges.jsx";
import AlertDetailModal from "../components/AlertDetailModal.jsx";
import { getAlerts, getStats, getMeta, updateAlertStatus, tickSimulator } from "../api.js";
import { formatMetricValue, timeAgo, formatDateTime } from "../format.js";
import { useLive } from "../context/LiveContext.jsx";

const emptyFilters = { status: "", severity: "", category: "", search: "", date_from: "", date_to: "" };

export default function Dashboard() {
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState(null);
  const [meta, setMeta] = useState({ severities: [], categories: [], statuses: [] });
  const [filters, setFilters] = useState(emptyFilters);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const { subscribe, clearUnread } = useLive();
  const refetchTimer = useRef(null);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const loadAlerts = useCallback(async () => {
    const params = { ...filtersRef.current };
    if (params.date_from) params.date_from = new Date(params.date_from).toISOString();
    if (params.date_to) params.date_to = new Date(params.date_to).toISOString();
    const data = await getAlerts(params);
    setAlerts(data);
  }, []);

  const loadStats = useCallback(async () => setStats(await getStats()), []);

  // Initial load
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        setMeta(await getMeta());
        await Promise.all([loadAlerts(), loadStats()]);
      } finally {
        setLoading(false);
      }
    })();
    clearUnread();
  }, [loadAlerts, loadStats, clearUnread]);

  // Refetch when filters change
  useEffect(() => {
    loadAlerts();
  }, [filters, loadAlerts]);

  // Live updates: throttle refetches triggered by WS events
  useEffect(() => {
    return subscribe((msg) => {
      if (["alert", "alert_updated", "stats", "poll"].includes(msg.type)) {
        clearTimeout(refetchTimer.current);
        refetchTimer.current = setTimeout(() => {
          loadAlerts();
          loadStats();
        }, 400);
      }
    });
  }, [subscribe, loadAlerts, loadStats]);

  function setFilter(field, value) {
    setFilters((f) => ({ ...f, [field]: value }));
  }

  async function quickAction(alert, status, e) {
    e.stopPropagation();
    await updateAlertStatus(alert.id, status);
    loadAlerts();
    loadStats();
  }

  async function simulate() {
    await tickSimulator();
    // live feed will refresh; also refetch immediately for snappiness
    setTimeout(() => { loadAlerts(); loadStats(); }, 200);
  }

  const criticalActive = alerts.filter((a) => a.severity === "Critical" && a.status === "Active").length;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Operations Dashboard</h1>
          <p className="muted">Real-time view of alerts triggered by breached thresholds.</p>
        </div>
        <button className="btn btn-primary" onClick={simulate}>⚡ Simulate event</button>
      </div>

      {stats && (
        <div className="stat-grid">
          <StatCard label="Active alerts" value={stats.active} tone="danger" sub={`${criticalActive} critical`} />
          <StatCard label="Acknowledged" value={stats.acknowledged} tone="warn" />
          <StatCard label="Resolved" value={stats.resolved} tone="success" />
          <StatCard label="Alerts (24h)" value={stats.alerts_last_24h} tone="info" />
          <StatCard label="Rules enabled" value={`${stats.rules_enabled}/${stats.rules_total}`} tone="default" />
          <StatCard label="Transactions" value={stats.transactions_total} tone="default" sub={stats.simulator_running ? "simulator live" : "simulator off"} />
        </div>
      )}

      <div className="filter-bar">
        <input
          className="search"
          placeholder="Search rule, message, account…"
          value={filters.search}
          onChange={(e) => setFilter("search", e.target.value)}
        />
        <select value={filters.severity} onChange={(e) => setFilter("severity", e.target.value)}>
          <option value="">All severities</option>
          {meta.severities.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select value={filters.category} onChange={(e) => setFilter("category", e.target.value)}>
          <option value="">All categories</option>
          {meta.categories.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select value={filters.status} onChange={(e) => setFilter("status", e.target.value)}>
          <option value="">All statuses</option>
          {meta.statuses.map((s) => <option key={s}>{s}</option>)}
        </select>
        <label className="date-field">From<input type="datetime-local" value={filters.date_from} onChange={(e) => setFilter("date_from", e.target.value)} /></label>
        <label className="date-field">To<input type="datetime-local" value={filters.date_to} onChange={(e) => setFilter("date_to", e.target.value)} /></label>
        <button className="btn btn-ghost btn-sm" onClick={() => setFilters(emptyFilters)}>Reset</button>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Alerts <span className="count-pill">{alerts.length}</span></h2>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Severity</th>
                <th>Status</th>
                <th>Rule</th>
                <th>Category</th>
                <th>Source</th>
                <th>Actual / Threshold</th>
                <th>Triggered</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={8} className="empty">Loading…</td></tr>
              )}
              {!loading && alerts.length === 0 && (
                <tr><td colSpan={8} className="empty">No alerts match the current filters.</td></tr>
              )}
              {alerts.map((a) => (
                <tr key={a.id} className="clickable" onClick={() => setSelected(a)}>
                  <td><SeverityBadge severity={a.severity} /></td>
                  <td><StatusBadge status={a.status} /></td>
                  <td>
                    <div className="cell-strong">{a.rule_name}</div>
                    <div className="cell-sub">{a.message}</div>
                  </td>
                  <td><CategoryBadge category={a.category} /></td>
                  <td className="mono">{a.source}</td>
                  <td>
                    <span className="cell-strong">{formatMetricValue(a.metric, a.actual_value)}</span>
                    <span className="cell-sub"> vs {formatMetricValue(a.metric, a.threshold_value)}</span>
                  </td>
                  <td title={formatDateTime(a.triggered_at)}>{timeAgo(a.triggered_at)}</td>
                  <td className="actions" onClick={(e) => e.stopPropagation()}>
                    <button className="btn btn-warn btn-xs" disabled={a.status !== "Active"} onClick={(e) => quickAction(a, "Acknowledged", e)}>Ack</button>
                    <button className="btn btn-success btn-xs" disabled={a.status === "Resolved"} onClick={(e) => quickAction(a, "Resolved", e)}>Resolve</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <AlertDetailModal
          alert={selected}
          onClose={() => setSelected(null)}
          onUpdated={(updated) => {
            setSelected(updated);
            loadAlerts();
            loadStats();
          }}
        />
      )}
    </div>
  );
}
