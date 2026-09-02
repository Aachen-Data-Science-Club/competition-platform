import { useState, useEffect } from "react";
import { api } from "../api";
import ScoreChart from "../components/ScoreChart";
import "./Competition.css";

export default function Competition() {
  const [comp, setComp] = useState(null);
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const activeComp = await api.getActiveCompetition();
        if (activeComp) {
          setComp(activeComp);
          const s = await api.getMyScores(activeComp.id);
          setScores(s);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div className="loading-spinner" />;

  if (!comp) {
    return (
      <div className="fade-in">
        <div className="page-header">
          <h1>Performance</h1>
        </div>
        <div className="card">
          <div className="empty-state">
            <div className="icon">🏁</div>
            <h3>No active competition</h3>
            <p>There is currently no competition running. Check back later!</p>
          </div>
        </div>
      </div>
    );
  }

  const totalPoints = scores.reduce((sum, s) => sum + s.points, 0);
  const bestDay = scores.length > 0 ? Math.max(...scores.map(s => s.points)) : 0;
  const daysLeft = Math.max(0, Math.ceil((new Date(comp.end_date) - new Date()) / 86400000));

  return (
    <div className="competition-page fade-in">
      <div className="page-header">
        <h1>Performance</h1>
        <p>{comp.name}</p>
      </div>

      <div className="grid-3" style={{ marginBottom: "28px" }}>
        <div className="stat-card">
          <span className="stat-label">Your Total Points</span>
          <span className="stat-value accent">{totalPoints}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Best Daily Score</span>
          <span className="stat-value">{bestDay}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Days Remaining</span>
          <span className="stat-value">{daysLeft}</span>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Daily Score History</h2>
          <span className="badge">{scores.length} days evaluated</span>
        </div>
        <ScoreChart scores={scores} />
      </div>
    </div>
  );
}
