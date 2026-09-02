import { useState, useEffect } from "react";
import { api } from "../api";
import FileUpload from "../components/FileUpload";
import "./UploadModel.css";

export default function UploadModel() {
  const [comp, setComp] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadMsg, setUploadMsg] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const activeComp = await api.getActiveCompetition();
        if (activeComp) {
          setComp(activeComp);
          const sub = await api.getMySubmissions(activeComp.id);
          setSubmissions(sub);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleUpload(file) {
    if (!comp) return;
    try {
      await api.submitModel(comp.id);
      setUploadMsg("Model submitted successfully!");
      const sub = await api.getMySubmissions(comp.id);
      setSubmissions(sub);
    } catch (err) {
      setUploadMsg(err.message);
    }
    setTimeout(() => setUploadMsg(""), 4000);
  }

  if (loading) return <div className="loading-spinner" />;

  if (!comp) {
    return (
      <div className="fade-in">
        <div className="page-header">
          <h1>Upload Model</h1>
        </div>
        <div className="card">
          <div className="empty-state">
            <div className="icon">📤</div>
            <h3>No active competition</h3>
            <p>There is currently no competition running. Check back later!</p>
          </div>
        </div>
      </div>
    );
  }

  const todayStr = new Date().toISOString().split("T")[0];
  const hasSubmittedToday = submissions.some(
    s => s.submitted_at.split("T")[0] === todayStr
  );

  return (
    <div className="upload-model-page fade-in">
      <div className="page-header">
        <h1>Upload Model</h1>
        <p>{comp.name}</p>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Submit ONNX Model</h2>
          {hasSubmittedToday && <span className="tag tag-active">Submitted today</span>}
        </div>
        <FileUpload onFileSelect={handleUpload} disabled={hasSubmittedToday} />
        {uploadMsg && (
          <div className={`upload-msg ${uploadMsg.includes("success") ? "success" : "error"}`}>
            {uploadMsg}
          </div>
        )}
      </div>

      {submissions.length > 0 && (
        <div className="card" style={{ marginTop: "20px" }}>
          <div className="card-header">
            <h2>Recent Submissions</h2>
            <span className="badge">{submissions.length} total</span>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th style={{ textAlign: "right" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((sub, i) => (
                  <tr key={i}>
                    <td>{new Date(sub.submitted_at).toLocaleString("de-DE")}</td>
                    <td style={{ textAlign: "right" }}>
                      <span className="tag tag-active">Submitted</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
