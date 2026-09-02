import "./Leaderboard.css";

export default function Leaderboard({ entries, pointsKey = "total_points", label = "Points" }) {
  if (!entries || entries.length === 0) {
    return (
      <div className="empty-state">
        <div className="icon">🏆</div>
        <h3>No rankings yet</h3>
        <p>The leaderboard will appear once scores are recorded.</p>
      </div>
    );
  }

  function getRankClass(rank) {
    if (rank === 1) return "rank-1";
    if (rank === 2) return "rank-2";
    if (rank === 3) return "rank-3";
    return "rank-default";
  }

  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th style={{ width: "60px" }}>Rank</th>
            <th>Team</th>
            <th style={{ textAlign: "right" }}>{label}</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.team_id} className={entry.is_current_team ? "highlight" : ""}>
              <td>
                <span className={`rank-badge ${getRankClass(entry.rank)}`}>
                  {entry.rank}
                </span>
              </td>
              <td>
                <span className="team-name-cell">
                  {entry.team_name}
                  {entry.is_current_team && <span className="you-badge">You</span>}
                </span>
              </td>
              <td style={{ textAlign: "right" }}>
                <span className="points-value">{entry[pointsKey] || 0}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
