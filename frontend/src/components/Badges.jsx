import React from "react";

export function SeverityBadge({ severity }) {
  const cls = `badge sev-${(severity || "").toLowerCase()}`;
  return <span className={cls}>{severity}</span>;
}

export function StatusBadge({ status }) {
  const cls = `badge status-${(status || "").toLowerCase()}`;
  return <span className={cls}>{status}</span>;
}

export function CategoryBadge({ category }) {
  return <span className={`badge cat-${(category || "").toLowerCase()}`}>{category}</span>;
}

export function LevelBadge({ level }) {
  return <span className={`badge level-${(level || "").toLowerCase()}`}>{level}</span>;
}
