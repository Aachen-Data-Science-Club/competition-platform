import { useState, useEffect } from "react";
import { api } from "../../api";
import "./AdminTeams.css";

export default function AdminTeams() {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTeam, setNewTeam] = useState({ name: "", members: [{ name: "", email: "" }] });
  const [msg, setMsg] = useState({ text: "", type: "" });
  const [expandedTeam, setExpandedTeam] = useState(null);
  const [generatedCodes, setGeneratedCodes] = useState(null);

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

  function showMsg(text, type = "success") {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: "", type: "" }), 4000);
  }

  function addMemberField() {
    setNewTeam(prev => ({
      ...prev,
      members: [...prev.members, { name: "", email: "" }],
    }));
  }

  function updateMemberField(idx, field, value) {
    setNewTeam(prev => ({
      ...prev,
      members: prev.members.map((m, i) => i === idx ? { ...m, [field]: value } : m),
    }));
  }

  function removeMemberField(idx) {
    setNewTeam(prev => ({
      ...prev,
      members: prev.members.filter((_, i) => i !== idx),
    }));
  }

  async function handleCreate(e) {
    e.preventDefault();
    try {
      await api.adminCreateTeam(newTeam);
      setShowCreate(false);
      setNewTeam({ name: "", members: [{ name: "", email: "" }] });
      await loadTeams();
      showMsg("Team created successfully");
    } catch (err) {
      showMsg(err.message, "error");
    }
  }

  async function handleDelete(teamId, teamName) {
    if (!confirm(`Delete team "${teamName}" and all its data?`)) return;
    try {
      await api.adminDeleteTeam(teamId);
      await loadTeams();
      showMsg("Team deleted");
    } catch (err) {
      showMsg(err.message, "error");
    }
  }

  async function handleKickMember(memberId, memberName) {
    if (!confirm(`Deactivate ${memberName}?`)) return;
    try {
      await api.adminKickMember(memberId);
      await loadTeams();
      showMsg(`${memberName} deactivated`);
    } catch (err) {
      showMsg(err.message, "error");
    }
  }

  async function handleGenerateCodes(teamId) {
    try {
      const result = await api.adminGenerateCodes(teamId);
      setGeneratedCodes(result.codes);
      showMsg("Access codes regenerated");
    } catch (err) {
      showMsg(err.message, "error");
    }
  }

  async function handleAddMember(teamId) {
    const name = prompt("Member name:");
    if (!name) return;
    const email = prompt("Member email:");
    if (!email) return;
    try {
      await api.adminAddMember(teamId, { name, email });
      await loadTeams();
      showMsg("Member added");
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

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Create Team</h2>
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
                      ✕
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
          </div>
        </div>
      )}

      {generatedCodes && (
        <div className="modal-overlay" onClick={() => setGeneratedCodes(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Generated Access Codes</h2>
            <div className="codes-list">
              {generatedCodes.map((c, i) => (
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
              <button className="btn btn-primary" onClick={() => setGeneratedCodes(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      <div className="teams-list">
        {teams.map((team) => (
          <div key={team.id} className="card team-card">
            <div className="team-card-header" onClick={() => setExpandedTeam(expandedTeam === team.id ? null : team.id)}>
              <div className="team-card-info">
                <div className="team-card-avatar">{team.name[0]}</div>
                <div>
                  <h3>{team.name}</h3>
                  <span className="team-card-meta">
                    {team.members.filter(m => m.is_active).length} active members · {team.total_points.toLocaleString()} pts
                  </span>
                </div>
              </div>
              <div className="team-card-actions">
                <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); handleGenerateCodes(team.id); }}>
                  🔑 Generate Codes
                </button>
                <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); handleAddMember(team.id); }}>
                  + Member
                </button>
                <button className="btn btn-danger btn-sm" onClick={(e) => { e.stopPropagation(); handleDelete(team.id, team.name); }}>
                  Delete
                </button>
                <span className="expand-icon">{expandedTeam === team.id ? "▲" : "▼"}</span>
              </div>
            </div>

            {expandedTeam === team.id && (
              <div className="team-members-expanded">
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
              </div>
            )}
          </div>
        ))}
      </div>

      {msg.text && <div className={`toast toast-${msg.type}`}>{msg.text}</div>}
    </div>
  );
}
