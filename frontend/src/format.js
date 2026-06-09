// Formatting helpers shared across the UI.

// Indian-style currency (lakh/crore grouping).
export function formatINR(value) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-IN").format(value);
}

export function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "medium",
  });
}

export function timeAgo(iso) {
  if (!iso) return "—";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// Friendly labels for metric keys.
export const METRIC_LABELS = {
  transaction_amount: "Transaction amount",
  fund_transfer_amount: "Fund transfer amount",
  transaction_count: "Transaction count",
  failed_login_count: "Failed login count",
  login_location: "Login location",
};

export function metricLabel(metric) {
  return METRIC_LABELS[metric] || metric;
}

// Format an alert's actual/threshold value depending on the metric.
export function formatMetricValue(metric, value) {
  if (metric === "login_location") return value >= 1 ? "Unusual" : "Normal";
  if (metric === "transaction_amount" || metric === "fund_transfer_amount") return formatINR(value);
  return formatNumber(value);
}
