import React, { useState } from "react";
import { createRule, updateRule } from "../api.js";
import { metricLabel } from "../format.js";

const RATE_METRICS = new Set(["transaction_count", "failed_login_count"]);

const emptyRule = {
  name: "",
  description: "",
  category: "Fraud",
  severity: "Medium",
  metric: "transaction_amount",
  operator: ">",
  threshold_value: 1000000,
  time_window_seconds: 0,
  enabled: true,
};

export default function RuleForm({ rule, meta, onClose, onSaved }) {
  const isEdit = Boolean(rule);
  const [form, setForm] = useState(rule ? { ...rule } : { ...emptyRule });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const isRate = RATE_METRICS.has(form.metric);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const payload = {
      name: form.name,
      description: form.description,
      category: form.category,
      severity: form.severity,
      metric: form.metric,
      operator: form.operator,
      threshold_value: Number(form.threshold_value),
      time_window_seconds: Number(form.time_window_seconds) || 0,
      enabled: Boolean(form.enabled),
    };
    try {
      const saved = isEdit ? await updateRule(rule.id, payload) : await createRule(payload);
      onSaved(saved);
    } catch (e2) {
      setError(e2.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2 className="modal-title">{isEdit ? "Edit alert rule" : "New alert rule"}</h2>
          <button className="icon-btn" onClick={onClose}>×</button>
        </div>

        <form onSubmit={submit} className="rule-form">
          <label className="field">
            <span>Name</span>
            <input value={form.name} onChange={(e) => update("name", e.target.value)} required placeholder="e.g. High-value transaction" />
          </label>

          <label className="field">
            <span>Description</span>
            <input value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="Optional description" />
          </label>

          <div className="field-row">
            <label className="field">
              <span>Category</span>
              <select value={form.category} onChange={(e) => update("category", e.target.value)}>
                {meta.categories.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Severity</span>
              <select value={form.severity} onChange={(e) => update("severity", e.target.value)}>
                {meta.severities.map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
          </div>

          <label className="field">
            <span>Metric</span>
            <select value={form.metric} onChange={(e) => update("metric", e.target.value)}>
              {meta.metrics.map((m) => <option key={m} value={m}>{metricLabel(m)}</option>)}
            </select>
          </label>

          <div className="field-row">
            <label className="field">
              <span>Operator</span>
              <select value={form.operator} onChange={(e) => update("operator", e.target.value)}>
                {meta.operators.map((o) => <option key={o}>{o}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Threshold value</span>
              <input type="number" step="any" value={form.threshold_value} onChange={(e) => update("threshold_value", e.target.value)} required />
            </label>
          </div>

          {isRate && (
            <label className="field">
              <span>Time window (seconds)</span>
              <input type="number" value={form.time_window_seconds} onChange={(e) => update("time_window_seconds", e.target.value)} placeholder="e.g. 600 for 10 minutes" />
              <small className="hint">Rate-based metric: count is evaluated within this rolling window.</small>
            </label>
          )}

          <label className="field-check">
            <input type="checkbox" checked={form.enabled} onChange={(e) => update("enabled", e.target.checked)} />
            <span>Enabled (actively monitored)</span>
          </label>

          {error && <div className="form-error">{error}</div>}

          <div className="modal-actions">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? "Saving…" : isEdit ? "Save changes" : "Create rule"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          </div>
          <small className="hint">Creating/editing rules requires the admin token (Admin → Settings).</small>
        </form>
      </div>
    </div>
  );
}
