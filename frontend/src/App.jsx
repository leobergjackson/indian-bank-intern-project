import React from "react";
import { Routes, Route, NavLink, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard.jsx";
import Rules from "./pages/Rules.jsx";
import Admin from "./pages/Admin.jsx";
import Toasts from "./components/Toasts.jsx";
import { useLive } from "./context/LiveContext.jsx";

function Navbar() {
  const { connected, unread, clearUnread } = useLive();
  return (
    <header className="navbar">
      <div className="brand">
        <span className="brand-mark">🛡️</span>
        <div>
          <div className="brand-title">Banking Alert Management</div>
          <div className="brand-sub">Threshold monitoring &amp; alerting</div>
        </div>
      </div>

      <nav className="nav-links">
        <NavLink to="/dashboard" className={({ isActive }) => (isActive ? "active" : "")}>
          Dashboard
          {unread > 0 && <span className="nav-badge">{unread}</span>}
        </NavLink>
        <NavLink to="/rules" className={({ isActive }) => (isActive ? "active" : "")}>
          Alert Rules
        </NavLink>
        <NavLink to="/admin" className={({ isActive }) => (isActive ? "active" : "")}>
          Admin
        </NavLink>
      </nav>

      <div className="nav-right">
        <span className={`conn-dot ${connected ? "online" : "offline"}`} title={connected ? "Live" : "Disconnected"} />
        <span className="conn-text">{connected ? "Live" : "Offline"}</span>
        {unread > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={clearUnread}>
            Clear ({unread})
          </button>
        )}
      </div>
    </header>
  );
}

export default function App() {
  return (
    <div className="app">
      <Navbar />
      <main className="content">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/rules" element={<Rules />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
      <Toasts />
    </div>
  );
}
