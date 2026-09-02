import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";
import Leaderboard from "../components/Leaderboard";
import "./Dashboard.css";

export default function Dashboard() {
  const { user } = useAuth();
  const [globalBoard, setGlobalBoard] = useState([]);
  const [compBoard, setCompBoard] = useState([]);
  const [activeComp, setActiveComp] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [global, comp] = await Promise.all([
          api.getGlobalLeaderboard(),
          api.getActiveCompetition(),
        ]);
        setGlobalBoard(global);
        setActiveComp(comp);

        if (comp?.id) {
          const compLeaderboard = await api.getCompetitionLeaderboard(comp.id);
          setCompBoard(compLeaderboard);
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

  return (
    <div className="dashboard fade-in">
      <div className="page-header">
        <h1>Leaderboard</h1>
        <p>Welcome back, {user?.member_name || user?.team_name}</p>
      </div>

      <div className="dual-leaderboard">
        <div className="card">
          <div className="card-header">
            <h2>{activeComp ? `${activeComp.name} Leaderboard` : "Competition Leaderboard"}</h2>
          </div>
          {activeComp ? (
            <Leaderboard
              entries={compBoard}
              pointsKey="competition_points"
              label="Competition Pts"
            />
          ) : (
            <div className="empty-state">
              <div className="icon">🏁</div>
              <h3>No active competition</h3>
              <p>Check back soon for the next challenge.</p>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Global Leaderboard</h2>
          </div>
          <Leaderboard entries={globalBoard} pointsKey="total_points" label="Total Pts" />
        </div>
      </div>
    </div>
  );
}
