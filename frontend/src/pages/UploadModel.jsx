import { useState, useEffect } from "react";
import { api } from "../api";
import FileUpload from "../components/FileUpload";
import "./UploadModel.css";

export default function UploadModel() {
  const [comp, setComp] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadMsg, setUploadMsg] = useState("");
  
  const [csvFile, setCsvFile] = useState(null);
  const [codeFile, setCodeFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [aiChecked, setAiChecked] = useState(false);

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

  async function handleUpload() {
    if (!comp) return;
    if (!csvFile || !codeFile) {
      setUploadMsg("Please select both a .csv file and a .zip file");
      setTimeout(() => setUploadMsg(""), 4000);
      return;
    }
    
    setIsSubmitting(true);
    try {
      await api.submitModel(comp.id, csvFile, codeFile);
      setUploadMsg("Submission successful!");
      setCsvFile(null);
      setCodeFile(null);
      setAiChecked(false);
      const sub = await api.getMySubmissions(comp.id);
      setSubmissions(sub);
    } catch (err) {
      setUploadMsg(err.message);
    }
    setIsSubmitting(false);
    setTimeout(() => setUploadMsg(""), 4000);
  }

  if (loading) return <div className="loading-spinner" />;

  if (!comp) {
    return (
      <div className="fade-in">
        <div className="page-header">
          <h1>Upload Submission</h1>
        </div>
        <div className="card">
          <div className="empty-state">
            <div className="icon">ℹ️</div>
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
  const requiredFields = (comp.required_predictions || comp.classification_schema || [])
    .map(f => f.field)
    .filter(Boolean);

  return (
    <div className="upload-model-page fade-in">
      <div className="page-header">
        <h1>Upload Submission</h1>
        <p>{comp.name}</p>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Submit Data</h2>
          {hasSubmittedToday && <span className="tag tag-active">Submitted today</span>}
        </div>

        <p style={{ marginBottom: "16px", fontSize: "0.9rem", color: "var(--text-secondary)" }}>
          Note: Only the required prediction columns need to be uploaded in your predictions <code>.csv</code> file
          {requiredFields.length > 0 && (
            <> ({requiredFields.map((col, idx) => (
              <span key={col}>
                <code>{col}</code>{idx < requiredFields.length - 1 ? ", " : ""}
              </span>
            ))})</>
          )}.
        </p>
        
        <div style={{ display: "grid", gap: "20px", gridTemplateColumns: "1fr 1fr", marginBottom: "20px" }}>
          <FileUpload 
            onFileSelect={setCodeFile} 
            disabled={hasSubmittedToday || isSubmitting} 
            accept=".zip" 
            title="Upload Code (.zip)" 
            description="Drag & drop your code .zip here"
            file={codeFile}
          />
          <FileUpload 
            onFileSelect={setCsvFile} 
            disabled={hasSubmittedToday || isSubmitting} 
            accept=".csv" 
            title="Upload Predictions (.csv)" 
            description="Drag & drop your predictions .csv here (only required prediction columns needed)"
            file={csvFile}
          />
        </div>
        
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "12px" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "0.9rem" }}>
            <input 
              type="checkbox" 
              checked={aiChecked} 
              onChange={(e) => setAiChecked(e.target.checked)}
              disabled={hasSubmittedToday || isSubmitting}
            />
            I hereby confirm that I did not use the help of AI for this submission.
          </label>
          <button 
            className="btn btn-primary" 
            onClick={handleUpload} 
            disabled={hasSubmittedToday || isSubmitting || !csvFile || !codeFile || !aiChecked}
          >
            {isSubmitting ? "Uploading..." : "Submit Files"}
          </button>
        </div>

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

