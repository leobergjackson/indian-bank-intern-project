// Thin REST client. URLs are relative so the Vite dev-server proxy forwards
// them to the FastAPI backend (see vite.config.js).

const ADMIN_TOKEN_KEY = "bams_admin_token";

export function getAdminToken() {
  return localStorage.getItem(ADMIN_TOKEN_KEY) || "admin-secret-token";
}
export function setAdminToken(token) {
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

async function request(method, path, { body, admin = false } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (admin) headers["X-Admin-Token"] = getAdminToken();

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const data = await res.json();
      if (data.detail) detail = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
    } catch (_) {
      /* ignore */
    }
    throw new Error(detail);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ---- Rules ----
export const getRules = () => request("GET", "/rules");
export const createRule = (rule) => request("POST", "/rules", { body: rule, admin: true });
export const updateRule = (id, rule) => request("PUT", `/rules/${id}`, { body: rule, admin: true });
export const deleteRule = (id) => request("DELETE", `/rules/${id}`, { admin: true });

// ---- Alerts ----
export function getAlerts(params = {}) {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== "" && v !== undefined && v !== null)
  ).toString();
  return request("GET", `/alerts${qs ? `?${qs}` : ""}`);
}
export const updateAlertStatus = (id, status, actor = "operator") =>
  request("PATCH", `/alerts/${id}/status`, { body: { status, actor } });

// ---- Transactions ----
export const getTransactions = (limit = 50) => request("GET", `/transactions?limit=${limit}`);
export const createTransaction = (txn) => request("POST", "/transactions", { body: txn });

// ---- Admin / meta ----
export const getLogs = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return request("GET", `/logs${qs ? `?${qs}` : ""}`);
};
export const getStats = () => request("GET", "/stats");
export const getMeta = () => request("GET", "/meta");

// ---- Simulator ----
export const getSimulator = () => request("GET", "/simulator");
export const startSimulator = () => request("POST", "/simulator/start", { admin: true });
export const stopSimulator = () => request("POST", "/simulator/stop", { admin: true });
export const tickSimulator = () => request("POST", "/simulator/tick");
