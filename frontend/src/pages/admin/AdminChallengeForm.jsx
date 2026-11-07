import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import JSZip from "jszip";
import { api } from "../../api";
import "./AdminCompetitions.css";
import Toast from "../../components/Toast";

function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split("T")[0];
}

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toPayload(f) {
  return {
    name: f.name.trim(),
    description: f.description,
    start_date: f.start_date,
    end_date: f.end_date,
    evaluation_time: f.evaluation_time,
    evaluation_days: f.evaluation_days,
    required_predictions: f.required_predictions.map(s => ({
      field: s.field.trim(),
      type: s.type,
    })),
  };
}

function validateForm(f) {
  if (!f.name.trim()) return "Name must not be empty";
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(f.evaluation_time || "")) return "Evaluation time must be HH:MM";
  if (f.end_date < f.start_date) return "End date must not be before start date";
  const names = f.required_predictions.map(s => s.field.trim());
  if (names.length === 0) return "At least one prediction field is required";
  if (names.some(n => !n)) return "Field names must not be empty";
  if (new Set(names).size !== names.length) return "Duplicate field names in the output format";
  return null;
}

export default function AdminChallengeForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ text: "", type: "" });
  const [trainingFile, setTrainingFile] = useState(null);
  const [saving, setSaving] = useState(false);

  const today = localToday();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    start_date: "",
    end_date: "",
    evaluation_time: "20:00",
    evaluation_days: "",
    required_predictions: [{ field: "", type: "boolean" }],
  });
  
  const [dayFiles, setDayFiles] = useState({});

  const [blockedRanges, setBlockedRanges] = useState([]);
  const [defaultStart, setDefaultStart] = useState(today);
  
  useEffect(() => {
    api.getCompetitions().then(comps => {
      const others = comps.filter(c => c.id !== parseInt(id, 10));
      const relevant = others.filter(c => c.end_date >= today);   
      setBlockedRanges(relevant.map(c => ({ name: c.name, start: c.start_date, end: c.end_date })));

      if (isEdit) {
        const comp = comps.find(c => c.id === parseInt(id, 10));
        if (comp) {
          setFormData({
            name: comp.name, description: comp.description,
            start_date: comp.start_date, end_date: comp.end_date,
            evaluation_time: comp.evaluation_time,
            evaluation_days: comp.evaluation_days || "",
            required_predictions: comp.required_predictions || comp.classification_schema || [],
          });
        } else {
          setMsg({ text: "Challenge not found", type: "error" });
        }
      } else {
        const lastEnd = relevant.reduce((m, c) => (c.end_date > m ? c.end_date : m), "");
        const next = lastEnd ? addDays(lastEnd, 1) : today;
        setDefaultStart(next);
        
        setFormData({
          name: "",
          description: "",
          start_date: next,
          end_date: "",
          evaluation_time: "20:00",
          evaluation_days: "",
          required_predictions: [{ field: "", type: "boolean" }],
        });
        setTrainingFile(null);
        setDayFiles({});
      }
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setMsg({ text: "Error loading challenges", type: "error" });
      setLoading(false);
    });
  }, [id, isEdit, today]);

  function handleResetForm() {
    if (!window.confirm("Are you sure you want to clear all form fields?")) return;
    setFormData(prev => ({
      name: "",
      description: "",
      start_date: isEdit
        ? ((prev.start_date && prev.start_date <= today) ? prev.start_date : "")
        : defaultStart,
      end_date: "",
      evaluation_time: "20:00",
      evaluation_days: "",
      required_predictions: [{ field: "", type: "boolean" }],
    }));
    setTrainingFile(null);
    setDayFiles({});
  }

  function updateField(key, value) {
    setFormData({ ...formData, [key]: value });
  }

  function updateSchemaField(index, key, value) {
    const newSchema = [...formData.required_predictions];
    newSchema[index] = { ...newSchema[index], [key]: value };
    setFormData({ ...formData, required_predictions: newSchema });
  }

  function addSchemaField() {
    setFormData({
      ...formData,
      required_predictions: [...formData.required_predictions, { field: "", type: "boolean" }]
    });
  }

  function removeSchemaField(index) {
    const newSchema = formData.required_predictions.filter((_, i) => i !== index);
    setFormData({ ...formData, required_predictions: newSchema });
  }
  
  function handleDayFileChange(dateStr, type, file) {
    setDayFiles(prev => ({
      ...prev,
      [dateStr]: {
        ...(prev[dateStr] || {}),
        [type]: file
      }
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const err = validateForm(formData);
    if (err) { setMsg({ text: err, type: "error" }); return; }

    setMsg({ text: "Saving...", type: "info" });
    setSaving(true);

    let savedComp;
    try {
      savedComp = isEdit
        ? await api.adminUpdateCompetition(id, toPayload(formData))
        : await api.adminCreateCompetition(toPayload(formData));
    } catch (err) {
      setSaving(false);
      setMsg({ text: err.message || "An error occurred", type: "error" });
      return;
    }

    try {
      if (trainingFile) await api.adminUploadTraining(savedComp.id, trainingFile);
      
      const dates = formData.evaluation_days.split(",").map(d => d.trim()).filter(Boolean);
      for (const date of dates) {
        if (dayFiles[date]?.unlabeled) {
          await api.adminUploadDayData(savedComp.id, date, "unlabeled", dayFiles[date].unlabeled);
        }
        if (dayFiles[date]?.labeled) {
          await api.adminUploadDayData(savedComp.id, date, "labeled", dayFiles[date].labeled);
        }
      }
      
    } catch (err) {
      setSaving(false);
      window.dispatchEvent(new Event("competitions_changed"));
      setMsg({
        text: `Challenge saved, but file-upload failed: ${err.message}. Please resubmit the files.`,
        type: "error",
      });
      setTimeout(() => navigate(`/admin/challenges/${savedComp.id}`), 2500);
      return;
    }

    window.dispatchEvent(new Event("competitions_changed"));
    setMsg({ text: "Saved successfully!", type: "success" });
    setTimeout(() => navigate("/admin/challenges"), 1500);
  }

  async function handleDelete() {
    if (!window.confirm("Are you sure you want to permanently delete this challenge?")) return;
    setMsg({ text: "Deleting...", type: "info" });
    try {
      await api.adminDeleteCompetition(id);
      window.dispatchEvent(new Event("competitions_changed"));
      setMsg({ text: "Challenge deleted", type: "success" });
      setTimeout(() => navigate("/admin/challenges"), 1000);
    } catch (err) {
      setMsg({ text: err.message || "An error occurred", type: "error" });
    }
  }

  if (loading) return <div className="page-container"><p>Loading...</p></div>;

  const isStarted = isEdit && Boolean(formData.start_date) && formData.start_date <= today;
  
  const parsedDays = formData.evaluation_days.split(",").map(d => d.trim()).filter(Boolean);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>{isEdit ? "Edit Challenge" : "New Challenge"}</h1>
        {isEdit && (
          <button className="btn btn-secondary" onClick={handleDelete} style={{ color: "var(--error)", borderColor: "var(--error)" }}>
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
              onChange={(e) => updateField("description", e.target.value)}
              style={{ resize: "vertical" }} />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="label">Start Date {isStarted && "(Locked)"}</label>
              <input type="date" className="input" value={formData.start_date}
                min={isEdit ? undefined : today}
                onChange={(e) => updateField("start_date", e.target.value)} required
                disabled={isStarted} />
            </div>
            <div className="form-group">
              <label className="label">End Date</label>
              <input type="date" className="input" value={formData.end_date}
                onChange={(e) => updateField("end_date", e.target.value)} required />
            </div>
          </div>
          {blockedRanges.length > 0 && (
            <p className="form-hint">
              Blocked: {blockedRanges.map(r => `${r.name} (${r.start} - ${r.end})`).join(", ")}
            </p>
          )}
          
          <div className="form-group" style={{marginTop: "16px"}}>
            <label className="label">Evaluation Time</label>
            <input type="time" className="input" value={formData.evaluation_time}
              onChange={(e) => updateField("evaluation_time", e.target.value)} />
          </div>
          
          <div className="form-group" style={{marginTop: "16px"}}>
            <label className="label">Evaluation Days (Comma separated YYYY-MM-DD)</label>
            <input type="text" className="input" value={formData.evaluation_days} placeholder="e.g. 2026-10-01, 2026-10-05"
              onChange={(e) => updateField("evaluation_days", e.target.value)} />
          </div>

          <div className="schema-builder" style={{marginTop: "24px"}}>
            <div className="schema-header">
              <label className="label">Required Predictions</label>
              <button type="button" className="btn btn-secondary btn-sm" onClick={addSchemaField}>+ Add Field</button>
            </div>
            {formData.required_predictions.map((schema, index) => (
              <div key={index} className="schema-row">
                <input type="text" className="input" placeholder="Field name (e.g. brand)"
                  value={schema.field} onChange={(e) => updateSchemaField(index, "field", e.target.value)} required />
                <select className="input" value={schema.type}
                  onChange={(e) => updateSchemaField(index, "type", e.target.value)}>
                  <option value="boolean">Boolean</option>
                  <option value="range">Range</option>
                </select>
                {formData.required_predictions.length > 1 && (
                  <button type="button" className="btn btn-secondary btn-icon" onClick={() => removeSchemaField(index)}>
                    X
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="form-group" style={{ marginTop: "24px" }}>
            <label className="label">Training Data (.zip)</label>
            <div className="file-upload-btn" onClick={() => document.getElementById("form-training-file").click()}>
              {trainingFile ? trainingFile.name : "Select file..."}
            </div>
            <input id="form-training-file" type="file" accept=".zip" style={{ display: "none" }}
              onChange={(e) => setTrainingFile(e.target.files?.[0] || null)} />
          </div>

          {parsedDays.length > 0 && (
            <div style={{ marginTop: "24px", padding: "16px", background: "var(--bg-surface)", borderRadius: "8px" }}>
              <label className="label" style={{marginBottom: "12px", display: "block"}}>Evaluation Data per Day</label>
              {parsedDays.map(dateStr => (
                <div key={dateStr} style={{ marginBottom: "16px", padding: "12px", border: "1px solid var(--border)", borderRadius: "6px" }}>
                  <strong>{dateStr}</strong>
                  <div className="grid-2" style={{ marginTop: "8px" }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="label" style={{fontSize: "0.8rem"}}>Unlabeled Data (.zip)</label>
                      <input type="file" accept=".zip" className="input" style={{padding: "4px"}}
                        onChange={(e) => handleDayFileChange(dateStr, "unlabeled", e.target.files?.[0] || null)} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="label" style={{fontSize: "0.8rem"}}>Labeled Data (.zip)</label>
                      <input type="file" accept=".zip" className="input" style={{padding: "4px"}}
                        onChange={(e) => handleDayFileChange(dateStr, "labeled", e.target.files?.[0] || null)} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: "12px", marginTop: "32px", justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-secondary" onClick={handleResetForm}>Clear Form</button>
            <button type="button" className="btn btn-secondary" onClick={() => navigate("/admin/challenges")}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving..." : isEdit ? "Publish Changes" : "Publish Challenge"}
            </button>
          </div>
        </form>
      </div>

      <Toast text={msg.text} type={msg.type} />
    </div>
  );
}
