import React from "react";

export default function StatCard({ label, value, tone = "default", sub }) {
  return (
    <div className={`stat-card tone-${tone}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {sub !== undefined && <div className="stat-sub">{sub}</div>}
    </div>
  );
}
