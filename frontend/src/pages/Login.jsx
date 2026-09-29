import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";
import "./Login.css";

export default function Login() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!code.trim()) return;

    setError("");
    setLoading(true);
    try {
      const data = await api.login(code.trim());
      login(data);
      navigate(data.is_admin ? "/admin/teams" : "/");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-bg-pattern" />
      <div className="login-container fade-in">
        <div className="login-logo" style={{ display: "flex", justifyContent: "center" }}>
          <img src="/logo.png" alt="ADSC Logo" style={{ height: "48px", objectFit: "contain" }} />
        </div>
        <h1>Competition Platform</h1>
        <p className="login-subtitle">Enter your access code to continue</p>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <input
              type="text"
              className="input login-input"
              placeholder="Your access code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoFocus
              disabled={loading}
            />
          </div>

          {error && <div className="login-error">{error}</div>}

          <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="login-footer">
          Don't have an access code? Contact the ADSC team: <a href="mailto:tech@data-science-club.de">tech@data-science-club.de</a>
        </p>
      </div>
    </div>
  );
}
