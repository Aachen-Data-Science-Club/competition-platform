import { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";
import "./Sidebar.css";

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeComp, setActiveComp] = useState(null);
  const [competitions, setCompetitions] = useState([]);

  useEffect(() => {
    function load() {
      api.getActiveCompetition().then(setActiveComp).catch(() => setActiveComp(null));
      if (user?.is_admin) {
        api.getCompetitions().then(setCompetitions).catch(() => setCompetitions([]));
      }
    }
    load();
    window.addEventListener("competitions_changed", load);
    return () => window.removeEventListener("competitions_changed", load);
  }, [user]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  async function handleDownloadTraining() {
    if (!activeComp) return;
    try {
      const response = await api.downloadTrainingData(activeComp.id)
      if (!response.ok) throw new Error("Training data not available");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${activeComp.name}_training_data.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <img src="/logo.png" alt="ADSC Logo" style={{ height: "32px", display: "block", maxWidth: "100%", objectFit: "contain" }} />
      </div>

      <nav className="sidebar-nav">
        

        <div className="nav-section">
          <span className="nav-label">Main</span>
          <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5C5.1 4 5.5 4 6 4.5"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5C18.9 4 18.5 4 18 4.5"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 19.24 7 20v2"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 19.24 17 20v2"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
            Leaderboard
          </NavLink>
          <NavLink to="/performance" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            Performance
          </NavLink>
          <NavLink to="/upload-model" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Upload Submission
          </NavLink>
          <NavLink to="/challenge-information" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            Challenge Information
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
            Settings
          </NavLink>
        </div>

        {user?.is_admin && (
          <div className="nav-section">
            <span className="nav-label">Admin</span>
            <NavLink to="/admin/teams" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              Teams
            </NavLink>
            <NavLink to="/admin/challenges" end className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
              Challenges Overview
            </NavLink>
            <div className="sidebar-sub-nav">
              {competitions.map((comp) => (
                <NavLink key={comp.id} to={`/admin/challenges/${comp.id}`} className={({ isActive }) => `nav-link sub-link ${isActive ? "active" : ""}`}>
                  • {comp.name}
                </NavLink>
              ))}
              <NavLink to="/admin/challenges/new" className={({ isActive }) => `nav-link sub-link ${isActive ? "active" : ""}`}>
                + New Challenge
              </NavLink>
            </div>
          </div>
        )}
      </nav>

      <div className="sidebar-footer">
        <div className="user-info">
          <div className="user-avatar">{(user?.team_name || "U")[0]}</div>
          <div className="user-details">
            <span className="user-name">{user?.team_name || "User"}</span>
            <span className="user-role">{user?.is_admin ? "Admin" : user?.member_name}</span>
          </div>
        </div>
        <button className="logout-btn" onClick={handleLogout} title="Logout">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        </button>
      </div>
    </aside>
  );
}
