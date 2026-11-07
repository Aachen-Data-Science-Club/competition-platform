import { useState, useEffect } from "react";
import { api } from "../api";
import "./ChallengeInformation.css";

export default function ChallengeInformation() {
  const [comp, setComp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloadingTrainingData, setDownloadingTrainingData] = useState(false);
  const [downloadingTestData, setDownloadingTestData] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const [isAgreed, setIsAgreed] = useState(false);

  async function downloadTrainingData() {
    if(!isAgreed){
      alert("Please agree to the terms before downloading any data!");
      return; 
    }
    setDownloadingTrainingData(true);
    setDownloadError("");
    try {
      const response = await api.downloadTrainingData(comp.id);
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || "Unable to download training data");
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = response.headers.get("content-disposition")?.match(/filename="?([^";]+)"?/i)?.[1]
        || `${comp.name}_training_data.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setDownloadError(err.message || "Unable to download training data");
    } finally {
      setDownloadingTrainingData(false);
    }
  }

  async function downloadNextTestData() {
    if(!isAgreed){
      alert("Please agree to the terms before downloading any data!");
      return; 
    }
    setDownloadingTestData(true);
    setDownloadError("");
    try {
      const response = await api.downloadNextTestData(comp.id);
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || "Unable to download test data");
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = response.headers.get("content-disposition")?.match(/filename="?([^";]+)"?/i)?.[1]
        || `${comp.name}_test_data.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setDownloadError(err.message || "Unable to download test data");
    } finally {
      setDownloadingTestData(false);
    }
  }

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
                </div>
              ))}
            </div>
          </div>
          <div className="data-agreement-button">
            <input type="checkbox" id="agreement-button" 
            checked={isAgreed} 
            onChange={(e) => setIsAgreed(e.target.checked)}>
            </input>
            <label htmlFor="agreement-button"> I agree to use the provided data exclusively for the purposes of this challenge.</label>
            
          </div>
          <div className="download-data-button">
            <button type="button" className="btn-training-data" onClick={downloadTrainingData} disabled={downloadingTrainingData}>
              {downloadingTrainingData ? "Downloading..." : "Download Training Data"}
            </button>
            <button type="button" className="btn-test-data" onClick={downloadNextTestData} disabled={downloadingTestData}>
              {downloadingTestData ? "Downloading..." : "Download Test Data"}
            </button>
          </div>
          {downloadError && <p role="alert">{downloadError}</p>}
        </div>
      </div>
    </div>
  );
}
