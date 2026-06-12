import React, { useState, useEffect } from "react";
import { Routes, Route, NavLink, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard.jsx";
import Rules from "./pages/Rules.jsx";
import Admin from "./pages/Admin.jsx";
import Toasts from "./components/Toasts.jsx";
import { useLive } from "./context/LiveContext.jsx";

function Navbar({ theme, toggleTheme }) {
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
        <button 
          className="btn btn-ghost btn-sm" 
          onClick={toggleTheme} 
          title="Toggle Theme"
          style={{ fontSize: "16px", padding: "4px 8px" }}
        >
          {theme === "dark" ? "☀️" : "🌙"}
        </button>
        <div style={{ width: "1px", height: "16px", background: "var(--border)", margin: "0 8px" }} />
        
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
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("bams_theme") || "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("bams_theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <div className="app">
      <Navbar theme={theme} toggleTheme={toggleTheme} />
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
