const API_BASE = "/api";

function getToken() {
  return localStorage.getItem("adsc_token");
}

async function request(endpoint, options = {}) {
  const token = getToken();
  const headers = { ...options.headers };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    localStorage.removeItem("adsc_token");
    localStorage.removeItem("adsc_user");
    window.location.href = "/login";
    return;
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(error.detail || "Request failed");
  }

  if (response.status === 204) return null;
  return response.json();
}

export const api = {
  login: (accessCode) =>
    request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ access_code: accessCode }),
    }),

  getMyTeam: () => request("/teams/me"),
  updateTeamName: (name) =>
    request("/teams/me/name", {
      method: "PUT",
      body: JSON.stringify({ name }),
    }),
  kickMember: (memberId) =>
    request(`/teams/me/members/${memberId}`, { method: "DELETE" }),

  getCompetitions: () => request("/competitions/"),
  getActiveCompetition: () => request("/competitions/active"),
  getCompetition: (id) => request(`/competitions/${id}`),
  getMyScores: (compId) => request(`/competitions/${compId}/my-scores`),
  getMySubmissions: (compId) => request(`/competitions/${compId}/my-submissions`),
  submitModel: (compId) =>
    request(`/competitions/${compId}/submit`, { method: "POST" }),

  getGlobalLeaderboard: () => request("/leaderboard/global"),
  getCompetitionLeaderboard: (compId) => request(`/leaderboard/competition/${compId}`),

  adminGetTeams: () => request("/admin/teams"),
  adminCreateTeam: (data) =>
    request("/admin/teams", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  adminDeleteTeam: (id) =>
    request(`/admin/teams/${id}`, { method: "DELETE" }),
  adminAddMember: (teamId, data) =>
    request(`/admin/teams/${teamId}/members`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  adminUpdateMemberName: (memberId, name) =>
    request(`/admin/members/${memberId}/name`, {
      method: "PUT",
      body: JSON.stringify({ name }),
    }),
  adminKickMember: (memberId) =>
    request(`/admin/members/${memberId}`, { method: "DELETE" }),
  adminGenerateCodes: (teamId) =>
    request(`/admin/teams/${teamId}/generate-codes`, { method: "POST" }),
  adminSendCodes: (teamId) => 
    request(`/admin/teams/${teamId}/send-codes`, { method: "POST" }),
  adminCreateCompetition: (data) =>
    request("/admin/competitions", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  adminUpdateCompetition: (id, data) =>
    request(`/admin/competitions/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  adminDeleteCompetition: (id) =>
    request(`/admin/competitions/${id}`, { method: "DELETE" }),
  adminUploadTraining: (compId, file) => {
    const formData = new FormData();
    formData.append("file", file);
    return request(`/admin/competitions/${compId}/upload-training`, {
      method: "POST",
      body: formData,
    });
  },
  adminUploadTest: (compId, file) => {
    const formData = new FormData();
    formData.append("file", file);
    return request(`/admin/competitions/${compId}/upload-test`, {
      method: "POST",
      body: formData,
    });
  },
  adminResetSemester: () =>
    request("/admin/reset-semester", { method: "POST" }),
  downloadTrainingData: async (compId) => {
    const token = localStorage.getItem("adsc_token");
    return fetch(`${API_BASE}/competitions/${compId}/training-data`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }
};
