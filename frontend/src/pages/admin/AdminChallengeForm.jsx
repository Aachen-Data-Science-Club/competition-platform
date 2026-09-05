import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import JSZip from "jszip";
import { api } from "../../api";
import "./AdminCompetitions.css";
import Toast from "../../components/Toast";

export default function AdminChallengeForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(isEdit);
  const [msg, setMsg] = useState({ text: "", type: "" });
  const [trainingFile, setTrainingFile] = useState(null);
  const [testFile, setTestFile] = useState(null);
  const [previewTestCount, setPreviewTestCount] = useState(null);
  const [initialCount, setInitialCount] = useState(0);

  const today = new Date().toISOString().split("T")[0];

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    start_date: today,
    end_date: "",
    evaluation_time: "20:00",
    classification_schema: [{ field: "", type: "boolean" }],
  });

  useEffect(() => {
    if (isEdit) {
      api.getCompetitions().then(comps => {
        const comp = comps.find(c => c.id === parseInt(id));
        if (comp) {
          setFormData({
            ...comp,
            classification_schema: comp.classification_schema || []
          });
          setInitialCount(comp.test_data_count || 0);
        } else {
          setMsg({ text: "Challenge not found", type: "error" });
        }
        setLoading(false);
      }).catch(err => {
        console.error(err);
        setMsg({ text: "Error loading challenge", type: "error" });
        setLoading(false);
      });
    }
  }, [id, isEdit]);

  async function handleTestFileChange(e) {
    const file = e.target.files?.[0] || null;
    setTestFile(file);
    if (file) {
      try {
        const zip = new JSZip();
        const contents = await zip.loadAsync(file);
        let count = 0;
        contents.forEach((relativePath, zipEntry) => {
          if (!zipEntry.dir) count++;
        });
        setPreviewTestCount(count);
      } catch (err) {
        console.error("Error reading zip", err);
        setPreviewTestCount(0);
      }
    } else {
      setPreviewTestCount(null);
    }
  }

  function calculateStats(comp, fileCount = null) {
    const count = fileCount !== null ? fileCount : initialCount;
    if (!count || !comp?.start_date || !comp?.end_date) return null;
    
    const start = new Date(comp.start_date);
    const end = new Date(comp.end_date);
    const days = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
    const perDay = Math.ceil(count / days);
    
    return { count, days, perDay };
  }

  function updateField(key, value) {
    setFormData({ ...formData, [key]: value });
  }

  function updateSchemaField(index, key, value) {
    const newSchema = [...formData.classification_schema];
    newSchema[index] = { ...newSchema[index], [key]: value };
    setFormData({ ...formData, classification_schema: newSchema });
  }

  function addSchemaField() {
    setFormData({
      ...formData,
      classification_schema: [...formData.classification_schema, { field: "", type: "boolean" }]
    });
  }

  function removeSchemaField(index) {
    const newSchema = formData.classification_schema.filter((_, i) => i !== index);
    setFormData({ ...formData, classification_schema: newSchema });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg({ text: "Saving...", type: "info" });

    try {
      let savedComp;
      if (isEdit) {
        savedComp = await api.adminUpdateCompetition(id, formData);
        savedComp = await api.adminCreateCompetition(formData);
      }
      if (trainingFile) await api.adminUploadTraining(savedComp.id, trainingFile);
      if (testFile) await api.adminUploadTest(savedComp.id, testFile);

      setMsg({ text: "Saved successfully!", type: "success" });
      setTimeout(() => navigate("/admin/challenges"), 1500);
    } catch (err) {
      setMsg({ text: err.message || "An error occurred", type: "error" });
    }
  }

  async function handleDelete() {
    if (!confirm("Are you sure you want to permanently delete this challenge?")) return;
    setMsg({ text: "Deleting...", type: "info" });
    try {
      await api.adminDeleteCompetition(id);
      setMsg({ text: "Challenge deleted", type: "success" });
      setTimeout(() => navigate("/admin/challenges"), 1000);
    } catch (err) {
      setMsg({ text: err.message || "An error occurred", type: "error" });
    }
  }

  if (loading) return <div className="page-container"><p>Loading...</p></div>;

  const isStarted = isEdit && formData.start_date <= today;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>{isEdit ? "Edit Challenge" : "New Challenge"}</h1>
        {isEdit && (
          <button className="btn btn-secondary" onClick={handleDelete} style={{ color: "var(--error)", borderColor: "var(--error)" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            Delete Challenge
          </button>
        )}
      </div>

      <div className="card" style={{ maxWidth: "800px" }}>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="label">Name</label>
            <input type="text" className="input" value={formData.name}
              onChange={(e) => updateField("name", e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="label">Description</label>
            <textarea className="input" rows={4} value={formData.description}
              onChange={(e) => updateField("description", e.target.value)} />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="label">Start Date {isStarted && "(Locked)"}</label>
              <input type="date" className="input" value={formData.start_date}
                onChange={(e) => updateField("start_date", e.target.value)} required 
                disabled={isStarted} />
            </div>
            <div className="form-group">
              <label className="label">End Date</label>
              <input type="date" className="input" value={formData.end_date}
                onChange={(e) => updateField("end_date", e.target.value)} required />
            </div>
          </div>
          <div className="form-group">
            <label className="label">Evaluation Time</label>
            <input type="time" className="input" value={formData.evaluation_time}
              onChange={(e) => updateField("evaluation_time", e.target.value)} />
          </div>

          <div className="schema-builder">
            <div className="schema-header">
              <label className="label">Required Output Format</label>
              <button type="button" className="btn btn-secondary btn-sm" onClick={addSchemaField}>+ Add Field</button>
            </div>
            {formData.classification_schema.map((schema, index) => (
              <div key={index} className="schema-row">
                <input type="text" className="input" placeholder="Field name (e.g. brand)"
                  value={schema.field} onChange={(e) => updateSchemaField(index, "field", e.target.value)} required />
                <select className="input" value={schema.type}
                  onChange={(e) => updateSchemaField(index, "type", e.target.value)}>
                  <option value="boolean">Boolean (0/1)</option>
                  <option value="range">Range</option>
                </select>
                {schema.type === "range" && (
                  <>
                    <input type="number" className="input" placeholder="Min"
                      value={schema.min || ""} onChange={(e) => updateSchemaField(index, "min", parseInt(e.target.value))} required style={{ width: "80px" }} />
                    <input type="number" className="input" placeholder="Max"
                      value={schema.max || ""} onChange={(e) => updateSchemaField(index, "max", parseInt(e.target.value))} required style={{ width: "80px" }} />
                  </>
                )}
                {formData.classification_schema.length > 1 && (
                  <button type="button" className="btn btn-secondary btn-icon" onClick={() => removeSchemaField(index)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="grid-2" style={{ marginTop: "24px" }}>
            <div className="form-group">
              <label className="label">Training Data (.zip)</label>
              <div className="file-upload-btn" onClick={() => document.getElementById("form-training-file").click()}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                {trainingFile ? trainingFile.name : "Select file..."}
              </div>
              <input id="form-training-file" type="file" accept=".zip" style={{ display: "none" }}
                onChange={(e) => setTrainingFile(e.target.files?.[0] || null)} />
            </div>
            <div className="form-group">
              <label className="label">Test Data (.zip)</label>
              <div className="file-upload-btn" onClick={() => document.getElementById("form-test-file").click()}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                {testFile ? testFile.name : "Select file..."}
              </div>
              <input id="form-test-file" type="file" accept=".zip" style={{ display: "none" }}
                onChange={handleTestFileChange} />
            </div>
          </div>

          {(() => {
            const count = previewTestCount !== null ? previewTestCount : initialCount;
            if (count > 0) {
              const stats = calculateStats(formData, count);
              return stats ? (
                <div className="test-data-stats">
                  Total Test Data: <strong>{stats.count} files</strong>
                  <br/>
                  Evaluation rate: <strong>{stats.perDay} files / day</strong> (over {stats.days} days)
                </div>
              ) : null;
            }
            return null;
          })()}

          <div style={{ display: "flex", gap: "12px", marginTop: "32px", justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-secondary" onClick={() => navigate("/admin/challenges")}>Cancel</button>
            <button type="submit" className="btn btn-primary">{isEdit ? "Publish Changes" : "Publish Challenge"}</button>
          </div>
        </form>
      </div>

      <Toast text={msg.text} type={msg.type} />
    </div>
  );
}
