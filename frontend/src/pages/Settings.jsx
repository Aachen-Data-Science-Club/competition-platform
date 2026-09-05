import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";
import "./Settings.css";
import Toast from "../components/Toast";

export default function Settings() {
  const { user, login } = useAuth();
  const [team, setTeam] = useState(null);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ text: "", type: "" });

  useEffect(() => {
    async function load() {
      try {
        const data = await api.getMyTeam();
        setTeam(data);
        setNewName(data.name);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function showMsg(text, type = "success") {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: "", type: "" }), 4000);
  }

  async function handleRename(e) {
    e.preventDefault();
    if (!newName.trim() || newName === team.name) return;
    try {
      const updated = await api.updateTeamName(newName.trim());
      setTeam(updated);
      const userData = { ...user, team_name: updated.name };
      login(userData);
      showMsg("Team name updated successfully");
    } catch (err) {
      showMsg(err.message, "error");
    }
  }

  async function handleKick(memberId, memberName) {
    if (!confirm(`Remove ${memberName} from the team? Their access code will be deactivated.`)) return;
    try {
      await api.kickMember(memberId);
      setTeam(prev => ({
        ...prev,
        members: prev.members.filter(m => m.id !== memberId),
      }));
      showMsg(`${memberName} has been removed`);
    } catch (err) {
      showMsg(err.message, "error");
    }
  }

  if (loading) return <div className="loading-spinner" />;
  if (!team) return null;

  return (
    <div className="settings-page fade-in">
      <div className="page-header">
        <h1>Settings</h1>
        <p>Manage your team</p>
      </div>

      <div className="settings-grid">
        <div className="card">
          <div className="card-header">
            <h2>Team Name</h2>
          </div>
          <form onSubmit={handleRename} className="rename-form">
            <input
              type="text"
              className="input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              pattern="[a-zA-Z0-9]+"
              title="Only letters and numbers allowed"
            />
            <button type="submit" className="btn btn-primary" disabled={!newName.trim() || newName === team.name}>
              Save
            </button>
          </form>
          <p className="help-text">Only letters and numbers. No spaces or special characters.</p>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Team Members</h2>
            <span className="badge">{team.members.length} members</span>
          </div>
          <div className="members-list">
            {team.members.map((member) => (
              <div key={member.id} className="member-row">
                <div className="member-info">
                  <div className="member-avatar">{member.name[0]}</div>
                  <div>
                    <div className="member-name">{member.name}</div>
                    <div className="member-email">{member.email}</div>
                  </div>
                </div>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => handleKick(member.id, member.name)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Toast text={msg.text} type={msg.type} />
    </div>
  );
}
