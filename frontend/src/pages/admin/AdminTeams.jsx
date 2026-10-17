import { useState, useEffect } from "react";
import { api } from "../../api";
import "./AdminTeams.css";
import Modal from "../../components/Modal";
import Toast from "../../components/Toast";

export default function AdminTeams() {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTeam, setNewTeam] = useState({ name: "", members: [{ name: "", email: "" }] });
  const [msg, setMsg] = useState({ text: "", type: "" });
  const [expandedTeam, setExpandedTeam] = useState(null);
  const [codesModal, setCodesModal] = useState(null);
  const [addMemberFor, setAddMemberFor] = useState(null);
  const [newMember, setNewMember] = useState({ name: "", email: "" });
  const [teamSubmissions, setTeamSubmissions] = useState({});

  useEffect(() => { loadTeams(); }, []);

  async function loadTeams() {
    try {
      const data = await api.adminGetTeams();
      setTeams(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function showMsg(text, type) {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: "", type: "" }), 3000);
  }

  async function handleExpandTeam(teamId) {
    if (expandedTeam === teamId) {
      setExpandedTeam(null);
      return;
    }
    setExpandedTeam(teamId);
    try {
      const subs = await api.adminGetTeamSubmissions(teamId);
      setTeamSubmissions(prev => ({ ...prev, [teamId]: subs }));
    } catch (err) {
      console.error("Failed to load submissions for team", err);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    try {
      await api.adminCreateTeam(newTeam);
      setShowCreate(false);
      setNewTeam({ name: "", members: [{ name: "", email: "" }] });
      await loadTeams();
      showMsg("Team created successfully!", "success");
    } catch (err) {
      showMsg(err.message, "error");
    }
  }

  function addMemberField() {
    setNewTeam(prev => ({
      ...prev,
      members: [...prev.members, { name: "", email: "" }]
    }));
  }

  function updateMemberField(index, field, value) {
    const newMembers = [...newTeam.members];
    newMembers[index][field] = value;
    setNewTeam(prev => ({ ...prev, members: newMembers }));
  }

  function removeMemberField(index) {
    const newMembers = newTeam.members.filter((_, i) => i !== index);
    setNewTeam(prev => ({ ...prev, members: newMembers }));
  }

  async function handleDelete(teamId, teamName) {
    if (!confirm(`Are you sure you want to completely delete team "${teamName}"?`)) return;
    try {
      await api.adminDeleteTeam(teamId);
      await loadTeams();
      showMsg("Team deleted.", "success");
    } catch (err) {
      showMsg(err.message, "error");
    }
  }

  async function handleKickMember(memberId, memberName) {
    if (!confirm(`Are you sure you want to remove member "${memberName}"?`)) return;
    try {
      await api.adminKickMember(memberId);
      await loadTeams();
      showMsg("Member removed.", "success");
    } catch (err) {
      showMsg(err.message, "error");
    }
  }

  async function handleGenerateCodes(teamId) {
    if (!confirm("This will invalidate old codes for all active members in this team and generate new ones. Send emails?")) return;
    try {
      const result = await api.adminGenerateCodes(teamId);
      await loadTeams();
      setCodesModal({ title: "New Access Codes", codes: result.codes });
      showMsg("Codes regenerated.", "success");
    } catch (err) {
      showMsg(err.message, "error");
    }
  }

  async function handleSendCodes(teamId) {
    if (!confirm("Send current active access codes to all team members?")) return;
    try {
      const result = await api.adminSendCodes(teamId);
      const { email_failures: failed = [], emails_sent: sent_count = 0 } = result;
      showMsg(
        failed.length ? `Sent ${sent_count}. Failed: ${failed.join(", ")}` : `Sent codes to ${sent_count} members.`,
        failed.length ? "error" : "success"
      );
    } catch (err) {
      showMsg(err.message, "error");
    }
  }

  async function handleResetSubmissions(teamId) {
    if (!confirm("Are you sure you want to reset today's upload limit for this team? This deletes their existing submission for today.")) return;
    try {
      const res = await api.adminResetTeamSubmissions(teamId);
      showMsg(res.detail || "Upload limit reset.", "success");
    } catch (err) {
      showMsg(err.message, "error");
    }
  }

  async function handleAddMember(e) {
    e.preventDefault();
    try {
      const result = await api.adminAddMember(addMemberFor, newMember);
      setAddMemberFor(null);
      setNewMember({ name: "", email: "" });
      await loadTeams();
      setCodesModal({ title: "New Member Access Code", codes: result.codes });
      showMsg(
        result.email_sent ? "Member added and code emailed" : "Member added, but the code email failed",
        result.email_sent ? "success" : "error"
      );
    } catch (err) {
      showMsg(err.message, "error");
    }
  }

  async function handleDownloadCode(subId, dateStr) {
    try {
      const response = await api.adminDownloadSubmissionCode(subId);
      if (!response.ok) throw new Error("Code file not available");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `submission_${subId}_code_${dateStr.split('T')[0]}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      showMsg(err.message, "error");
    }
  }

  if (loading) return <div className="loading-spinner" />;

  return (
    <div className="admin-teams fade-in">
      <div className="page-header">
        <h1>Team Management</h1>
        <p>Create, manage, and configure teams</p>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          + Create Team
        </button>
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Team">
        <form onSubmit={handleCreate}>
          <div className="form-group">
            <label className="label">Team Name</label>
            <input
              type="text"
              className="input"
              value={newTeam.name}
              onChange={(e) => setNewTeam(prev => ({ ...prev, name: e.target.value }))}
              pattern="[a-zA-Z0-9]+"
              placeholder="e.g. AlphaAI"
              required
            />
          </div>

          <label className="label">Members</label>
          {newTeam.members.map((m, i) => (
            <div key={i} className="member-input-row">
              <input
                type="text"
                className="input"
                placeholder="Name"
                value={m.name}
                onChange={(e) => updateMemberField(i, "name", e.target.value)}
                required
              />
              <input
                type="email"
                className="input"
                placeholder="Email"
                value={m.email}
                onChange={(e) => updateMemberField(i, "email", e.target.value)}
                required
              />
              {newTeam.members.length > 1 && (
                <button type="button" className="btn btn-danger btn-icon" onClick={() => removeMemberField(i)}>
                  🗑️
                </button>
              )}
            </div>
          ))}
          <button type="button" className="btn btn-secondary btn-sm" onClick={addMemberField} style={{ marginTop: "8px" }}>
            + Add Member
          </button>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Create</button>
          </div>
        </form>
      </Modal>

      <Modal open={addMemberFor !== null} onClose={() => setAddMemberFor(null)} title="Add Member">
        <form onSubmit={handleAddMember}>
          <div className="form-group">
            <label className="label">Name</label>
            <input
              type="text"
              className="input"
              value={newMember.name}
              onChange={(e) => setNewMember(prev => ({ ...prev, name: e.target.value }))}
              required
            />
          </div>
          <div className="form-group">
            <label className="label">Email</label>
            <input
              type="email"
              className="input"
              value={newMember.email}
              onChange={(e) => setNewMember(prev => ({ ...prev, email: e.target.value }))}
              required
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setAddMemberFor(null)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Add</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!codesModal} onClose={() => setCodesModal(null)} title={codesModal?.title}>
        <div className="codes-list">
          {codesModal?.codes.map((c, i) => (
            <div key={i} className="code-row">
              <div>
                <div className="member-name">{c.name}</div>
                <div className="member-email">{c.email}</div>
              </div>
              <code className="access-code">{c.access_code}</code>
            </div>
          ))}
        </div>
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={() => setCodesModal(null)}>Close</button>
        </div>
      </Modal>

      <div className="teams-list">
        {teams.map((team) => (
          <div key={team.id} className="card team-card">
            <div className="team-card-header" onClick={() => handleExpandTeam(team.id)}>
              <div className="team-card-info">
                <div className="team-card-avatar">{team.name[0]}</div>
                <div>
                  <h3>{team.name}</h3>
                  <span className="team-card-meta">
                    {team.members.filter(m => m.is_active).length} active members • {team.total_points.toLocaleString()} pts
                  </span>
                </div>
              </div>
              <div className="team-card-actions">
                <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); handleSendCodes(team.id); }}>
                  Send Codes
                </button>
                <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); setAddMemberFor(team.id); }}>
                  + Member
                </button>
                <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); handleResetSubmissions(team.id); }}>
                  Reset Submission
                </button>
                <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); handleGenerateCodes(team.id); }}>
                  Regenerate
                </button>
                <button className="btn btn-danger btn-sm" onClick={(e) => { e.stopPropagation(); handleDelete(team.id, team.name); }}>
                  Delete
                </button>
                <span className="expand-icon">{expandedTeam === team.id ? "▲" : "▼"}</span>
              </div>
            </div>

            {expandedTeam === team.id && (
              <div className="team-members-expanded">
                <h4 style={{ margin: "0 0 10px 0", color: "var(--text-secondary)" }}>Members</h4>
                {team.members.map((member) => (
                  <div key={member.id} className={`member-row ${!member.is_active ? "inactive" : ""}`}>
                    <div className="member-info">
                      <div className="member-avatar">{member.name[0]}</div>
                      <div>
                        <div className="member-name">
                          {member.name}
                          {!member.is_active && <span className="tag tag-inactive" style={{ marginLeft: "8px" }}>Inactive</span>}
                        </div>
                        <div className="member-email">{member.email}</div>
                      </div>
                    </div>
                    {member.is_active && (
                      <button className="btn btn-danger btn-sm" onClick={() => handleKickMember(member.id, member.name)}>
                        Kick
                      </button>
                    )}
                  </div>
                ))}
                
                <h4 style={{ margin: "20px 0 10px 0", color: "var(--text-secondary)" }}>Submissions</h4>
                {!teamSubmissions[team.id] ? (
                  <div style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Loading submissions...</div>
                ) : teamSubmissions[team.id].length === 0 ? (
                  <div style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>No submissions found.</div>
                ) : (
                  teamSubmissions[team.id].map(sub => (
                    <div key={sub.id} className="member-row" style={{ padding: "8px 12px", background: "var(--bg-primary)" }}>
                      <div className="member-info">
                        <div>
                          <div className="member-name">Submission #{sub.id}</div>
                          <div className="member-email">{new Date(sub.submitted_at).toLocaleString("de-DE")}</div>
                        </div>
                      </div>
                      {sub.has_code ? (
                        <button 
                          className="btn btn-primary btn-sm"
                          onClick={() => handleDownloadCode(sub.id, sub.submitted_at)}
                        >
                          Download Code
                        </button>
                      ) : (
                        <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>No code attached</span>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <Toast text={msg.text} type={msg.type} />
    </div>
  );
}
