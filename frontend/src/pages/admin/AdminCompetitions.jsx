import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api";
import "./AdminCompetitions.css";

export default function AdminCompetitions() {
  const [competitions, setCompetitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadCompetitions();
  }, []);

  async function loadCompetitions() {
    try {
      const data = await api.getCompetitions();
      setCompetitions(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleResetSemester() {
    if (!confirm("Reset ALL scores and submissions and end ALL challenges?" +
      " Challenges are kept and can be deleted individually. This cannot be undone!")) return;
    try {
      await api.adminResetSemester();
      alert("Semester reset complete!");
      loadCompetitions();
    } catch (err) {
      alert("Error resetting semester");
    }
  }

  if (loading) return <div className="page-container"><p>Loading...</p></div>;

  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Challenges Overview</h1>
        <div style={{ display: "flex", gap: "12px" }}>
          <button className="btn btn-secondary" onClick={handleResetSemester} style={{ color: "var(--error)", borderColor: "var(--error)" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            Reset Competition
          </button>
          <button className="btn btn-primary" onClick={() => navigate("/admin/challenges/new")}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Challenge
          </button>
        </div>
      </div>

      <div className="competitions-list">
        {competitions.map((comp) => {
          const isExpired = comp.end_date < today;
          const isActive = comp.start_date <= today && comp.end_date >= today;

          return (
            <div key={comp.id} className="card comp-card" style={{ cursor: "pointer" }} onClick={() => navigate(`/admin/challenges/${comp.id}`)}>
              <div className="comp-card-top">
                <div className="comp-card-title">
                  <h3>{comp.name}</h3>
                  <span className={`tag ${isActive ? "tag-active" : "tag-inactive"}`}>
                    {isExpired ? "Ended" : isActive ? "Active" : "Upcoming"}
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {competitions.length === 0 && (
          <div className="card">
            <div className="empty-state">
              <div className="icon">🏆</div>
              <h3>No challenges yet</h3>
              <p>Create your first challenge to get started.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
