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
  const [codesModal, setCodesModal] = useState(null);
  const [addMemberFor, setAddMemberFor] = useState(null);
  const [newMember, setNewMember] = useState({ name: "", email: "" });

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
      const result = await api.adminCreateTeam(newTeam);
      setShowCreate(false);
      setNewTeam({ name: "", members: [{ name: "", email: "" }] });
      await loadTeams();
      setCodesModal({ title: "New Team Access Codes", codes: result.codes });
      const failed = result.email_failures ?? [];
      showMsg(
        failed.length
          ? `Team created, but codes could not be emailed to: ${failed.join(", ")}`
          : `Team created and codes emailed to ${result.emails_sent} member(s)`,
        failed.length ? "error" : "success"
      );
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

  async function handleSendCodes(teamId) {
    try {
      const result = await api.adminSendCodes(teamId);
      setCodesModal({ title: "Access Codes Sent", codes: result.codes });
      const failed = result.email_failures ?? [];
      showMsg(
        failed.length
          ? `Codes sent, but ${failed.length} email(s) failed: ${failed.join(", ")}`
          : `Codes sent to ${result.emails_sent} member(s)`,
        failed.length ? "error" : "success"
      );
    } catch (err) {
      showMsg(err.message, "error");
    }
  }

  async function handleGenerateCodes(teamId) {
    if (!confirm("This replaces every access code in this team. " +
      "Members using their current code will be locked out. Continue?")) return;
    try {
      const result = await api.adminGenerateCodes(teamId);
      setCodesModal({ title: "New Access Codes", codes: result.codes });
      const failed = result.email_failures ?? [];
      showMsg(
        failed.length
          ? `Codes regenerated, but ${failed.length} email(s) failed: ${failed.join(", ")}`
          : `Codes regenerated and emailed to ${result.emails_sent} member(s)`,
        failed.length ? "error" : "success"
      );
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

      {addMemberFor !== null && (
        <div className="modal-overlay" onClick={() => setAddMemberFor(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Add Member</h2>
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
          </div>
        </div>
      )}

      {codesModal && (
        <div className="modal-overlay" onClick={() => setCodesModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{codesModal.title}</h2>
            <div className="codes-list">
              {codesModal.codes.map((c, i) => (
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
                <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); handleSendCodes(team.id); }}>
                  Send Codes
                </button>
                <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); setAddMemberFor(team.id); }}>
                  + Member
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
