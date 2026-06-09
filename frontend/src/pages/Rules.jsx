import React, { useEffect, useState } from "react";
import RuleForm from "../components/RuleForm.jsx";
import { SeverityBadge, CategoryBadge } from "../components/Badges.jsx";
import { getRules, getMeta, deleteRule, updateRule } from "../api.js";
import { metricLabel, formatMetricValue, formatDateTime } from "../format.js";

export default function Rules() {
  const [rules, setRules] = useState([]);
  const [meta, setMeta] = useState(null);
  const [editing, setEditing] = useState(undefined); // undefined=closed, null=new, obj=edit
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [r, m] = await Promise.all([getRules(), getMeta()]);
      setRules(r);
      setMeta(m);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function toggleEnabled(rule) {
    setError("");
    try {
      await updateRule(rule.id, { enabled: !rule.enabled });
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function remove(rule) {
    if (!confirm(`Delete rule "${rule.name}"? This cannot be undone.`)) return;
    setError("");
    try {
      await deleteRule(rule.id);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  function describe(rule) {
    const win = rule.time_window_seconds ? ` within ${Math.round(rule.time_window_seconds / 60)} min` : "";
    return `${metricLabel(rule.metric)} ${rule.operator} ${formatMetricValue(rule.metric, rule.threshold_value)}${win}`;
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Alert Rules</h1>
          <p className="muted">Configure the thresholds that generate alerts.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing(null)}>+ New rule</button>
      </div>

      {error && <div className="form-error block">{error}</div>}

      <div className="card">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Name</th>
                <th>Condition</th>
                <th>Category</th>
                <th>Severity</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="empty">Loading…</td></tr>}
              {!loading && rules.length === 0 && <tr><td colSpan={7} className="empty">No rules yet. Create one to start monitoring.</td></tr>}
              {rules.map((r) => (
                <tr key={r.id}>
                  <td>
                    <label className="switch" title={r.enabled ? "Enabled" : "Disabled"}>
                      <input type="checkbox" checked={r.enabled} onChange={() => toggleEnabled(r)} />
                      <span className="slider" />
                    </label>
                  </td>
                  <td>
                    <div className="cell-strong">{r.name}</div>
                    <div className="cell-sub">{r.description || "—"}</div>
                  </td>
                  <td className="mono">{describe(r)}</td>
                  <td><CategoryBadge category={r.category} /></td>
                  <td><SeverityBadge severity={r.severity} /></td>
                  <td className="cell-sub">{formatDateTime(r.updated_at)}</td>
                  <td className="actions">
                    <button className="btn btn-ghost btn-xs" onClick={() => setEditing(r)}>Edit</button>
                    <button className="btn btn-danger btn-xs" onClick={() => remove(r)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing !== undefined && meta && (
        <RuleForm
          rule={editing}
          meta={meta}
          onClose={() => setEditing(undefined)}
          onSaved={() => { setEditing(undefined); load(); }}
        />
      )}
    </div>
  );
}
