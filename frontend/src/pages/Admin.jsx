import React, { useCallback, useEffect, useRef, useState } from "react";
import StatCard from "../components/StatCard.jsx";
import BarChart from "../components/BarChart.jsx";
import { LevelBadge } from "../components/Badges.jsx";
import {
  getStats, getLogs, getSimulator, startSimulator, stopSimulator, tickSimulator,
  getAdminToken, setAdminToken,
} from "../api.js";
import { formatDateTime } from "../format.js";
import { useLive } from "../context/LiveContext.jsx";

export default function Admin() {
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [levelFilter, setLevelFilter] = useState("");
  const [sim, setSim] = useState({ running: false, generated: 0 });
  const [token, setToken] = useState(getAdminToken());
  const [tokenSaved, setTokenSaved] = useState(false);
  const [error, setError] = useState("");
  const { subscribe } = useLive();
  const timer = useRef(null);

  const loadStats = useCallback(async () => setStats(await getStats()), []);
  const loadSim = useCallback(async () => setSim(await getSimulator()), []);
  const loadLogs = useCallback(async () => {
    setLogs(await getLogs(levelFilter ? { level: levelFilter, limit: 100 } : { limit: 100 }));
  }, [levelFilter]);

  useEffect(() => { loadStats(); loadSim(); }, [loadStats, loadSim]);
  useEffect(() => { loadLogs(); }, [loadLogs]);

  useEffect(() => {
    return subscribe(() => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => { loadStats(); loadLogs(); loadSim(); }, 600);
    });
  }, [subscribe, loadStats, loadLogs, loadSim]);

  async function doSim(action) {
    setError("");
    try {
      if (action === "start") await startSimulator();
      else if (action === "stop") await stopSimulator();
      else if (action === "tick") await tickSimulator();
      loadSim();
    } catch (e) {
      setError(e.message);
    }
  }

  function saveToken() {
    setAdminToken(token.trim());
    setTokenSaved(true);
    setTimeout(() => setTokenSaved(false), 2000);
  }

  const severityData = stats ? [
    { label: "Critical", value: stats.by_severity.Critical || 0, cls: "bar-critical" },
    { label: "High", value: stats.by_severity.High || 0, cls: "bar-high" },
    { label: "Medium", value: stats.by_severity.Medium || 0, cls: "bar-medium" },
    { label: "Low", value: stats.by_severity.Low || 0, cls: "bar-low" },
  ] : [];

  const categoryData = stats ? [
    { label: "Fraud", value: stats.by_category.Fraud || 0, cls: "bar-fraud" },
    { label: "Compliance", value: stats.by_category.Compliance || 0, cls: "bar-compliance" },
    { label: "Risk", value: stats.by_category.Risk || 0, cls: "bar-risk" },
    { label: "Performance", value: stats.by_category.Performance || 0, cls: "bar-performance" },
  ] : [];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Admin Panel</h1>
          <p className="muted">System metrics, simulator controls, settings, and logs.</p>
        </div>
      </div>

      {error && <div className="form-error block">{error}</div>}

      {/* Performance metrics */}
      {stats && (
        <>
          <div className="stat-grid">
            <StatCard label="Total alerts" value={stats.total_alerts} tone="info" />
            <StatCard label="Active" value={stats.active} tone="danger" />
            <StatCard label="Resolved" value={stats.resolved} tone="success" />
            <StatCard label="Transactions processed" value={stats.transactions_total} tone="default" />
          </div>

          <div className="two-col">
            <div className="card">
              <div className="card-head"><h2>Alerts by severity</h2></div>
              <BarChart data={severityData} />
            </div>
            <div className="card">
              <div className="card-head"><h2>Alerts by category</h2></div>
              <BarChart data={categoryData} />
            </div>
          </div>
        </>
      )}

      {/* Controls */}
      <div className="two-col">
        <div className="card">
          <div className="card-head"><h2>Transaction simulator</h2></div>
          <div className="sim-controls">
            <div className="sim-status">
              <span className={`conn-dot ${sim.running ? "online" : "offline"}`} />
              <span>{sim.running ? "Running" : "Stopped"}</span>
              <span className="muted">· {sim.generated} events generated</span>
            </div>
            <div className="btn-row">
              <button className="btn btn-success btn-sm" disabled={sim.running} onClick={() => doSim("start")}>Start</button>
              <button className="btn btn-danger btn-sm" disabled={!sim.running} onClick={() => doSim("stop")}>Stop</button>
              <button className="btn btn-primary btn-sm" onClick={() => doSim("tick")}>Generate one</button>
            </div>
            <small className="hint">Start/Stop require the admin token below.</small>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h2>Admin settings</h2></div>
          <div className="field">
            <span>Admin token (for rule changes &amp; simulator control)</span>
            <div className="btn-row">
              <input value={token} onChange={(e) => setToken(e.target.value)} className="grow" />
              <button className="btn btn-primary btn-sm" onClick={saveToken}>Save</button>
            </div>
            {tokenSaved && <small className="hint success">Saved to this browser.</small>}
            <small className="hint">Must match <code>ADMIN_TOKEN</code> in the backend <code>.env</code> (default <code>admin-secret-token</code>).</small>
          </div>
        </div>
      </div>

      {/* System logs */}
      <div className="card">
        <div className="card-head">
          <h2>System logs <span className="count-pill">{logs.length}</span></h2>
          <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)}>
            <option value="">All levels</option>
            <option>INFO</option>
            <option>WARNING</option>
            <option>ERROR</option>
          </select>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Time</th><th>Level</th><th>Category</th><th>Message</th></tr>
            </thead>
            <tbody>
              {logs.length === 0 && <tr><td colSpan={4} className="empty">No logs.</td></tr>}
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="cell-sub nowrap">{formatDateTime(l.created_at)}</td>
                  <td><LevelBadge level={l.level} /></td>
                  <td className="mono">{l.category}</td>
                  <td>{l.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
