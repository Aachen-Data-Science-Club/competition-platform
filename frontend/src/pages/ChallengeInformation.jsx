import { useState, useEffect } from "react";
import { api } from "../api";
import "./ChallengeInformation.css";

export default function ChallengeInformation() {
  const [comp, setComp] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const activeComp = await api.getActiveCompetition();
        setComp(activeComp);
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
          <h1>Challenge Information</h1>
        </div>
        <div className="card">
          <div className="empty-state">
            <div className="icon">ℹ️</div>
            <h3>No active challenge</h3>
            <p>There is currently no challenge running. Check back later!</p>
          </div>
        </div>
      </div>
    );
  }

  const daysLeft = Math.max(0, Math.ceil((new Date(comp.end_date) - new Date()) / 86400000));
  const schema = comp.required_predictions || comp.classification_schema || [];

  return (
    <div className="challenge-info-page fade-in">
      <div className="page-header">
        <h1>Challenge Information</h1>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>{comp.name}</h2>
          <span className="tag tag-active">Active</span>
        </div>

        <div className="challenge-details">
          <div className="challenge-detail-row">
            <span className="challenge-detail-label">Description</span>
            <p className="challenge-detail-value">{comp.description}</p>
          </div>

          <div className="challenge-detail-grid">
            <div className="challenge-detail-row">
              <span className="challenge-detail-label">Start Date</span>
              <span className="challenge-detail-value">{new Date(comp.start_date).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" })}</span>
            </div>
            <div className="challenge-detail-row">
              <span className="challenge-detail-label">End Date</span>
              <span className="challenge-detail-value">{new Date(comp.end_date).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" })}</span>
            </div>
            <div className="challenge-detail-row">
              <span className="challenge-detail-label">Days Remaining</span>
              <span className="challenge-detail-value">{daysLeft}</span>
            </div>
            <div className="challenge-detail-row">
              <span className="challenge-detail-label">Evaluation Time</span>
              <span className="challenge-detail-value">{comp.evaluation_time}</span>
            </div>
            <div className="challenge-detail-row">
              <span className="challenge-detail-label">Evaluation Days</span>
              <span className="challenge-detail-value">{comp.evaluation_days || "Not specified"}</span>
            </div>
          </div>

          <div className="challenge-detail-row">
            <span className="challenge-detail-label">Required Predictions</span>
            <div className="challenge-format-list">
              {schema.map((f, i) => (
                <div key={i} className="challenge-format-item">
                  <span className="challenge-format-name">{f.field}</span>
                  {f.type === "range" && f.min != null && f.max != null && (
                    <span className="challenge-format-range">({f.min} - {f.max})</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="download-data-button">
            <button type="button" className="btn-training-data">Download Training Data</button>
          </div>
        </div>
      </div>
    </div>
  );
}
