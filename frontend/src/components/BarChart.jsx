import React from "react";

// Lightweight horizontal bar chart (no external charting dependency).
// data: [{ label, value, cls }]
export default function BarChart({ data }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="barchart">
      {data.map((d) => (
        <div className="bar-row" key={d.label}>
          <div className="bar-label">{d.label}</div>
          <div className="bar-track">
            <div
              className={`bar-fill ${d.cls || ""}`}
              style={{ width: `${(d.value / max) * 100}%` }}
            />
          </div>
          <div className="bar-value">{d.value}</div>
        </div>
      ))}
    </div>
  );
}
