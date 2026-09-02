import { useEffect, useRef } from "react";
import "./ScoreChart.css";

export default function ScoreChart({ scores }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!scores || scores.length === 0 || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;

    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = 280 * dpr;
    canvas.style.width = rect.width + "px";
    canvas.style.height = "280px";
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = 280;
    const padding = { top: 20, right: 20, bottom: 50, left: 60 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    ctx.clearRect(0, 0, w, h);

    const maxPoints = Math.max(...scores.map(s => s.points), 100);
    const minPoints = 0;
    const range = maxPoints - minPoints || 1;

    ctx.strokeStyle = "#2a2a2a";
    ctx.lineWidth = 1;
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
      const y = padding.top + (i / gridLines) * chartH;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();

      const val = Math.round(maxPoints - (i / gridLines) * range);
      ctx.fillStyle = "#666";
      ctx.font = "11px Inter, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(String(val), padding.left - 10, y + 4);
    }

    const barGap = 6;
    const totalGaps = (scores.length - 1) * barGap;
    const barWidth = Math.max(8, (chartW - totalGaps) / scores.length);

    const gradient = ctx.createLinearGradient(0, padding.top, 0, h - padding.bottom);
    gradient.addColorStop(0, "#E8461C");
    gradient.addColorStop(1, "rgba(232, 70, 28, 0.4)");

    scores.forEach((s, i) => {
      const x = padding.left + i * (barWidth + barGap);
      const barH = ((s.points - minPoints) / range) * chartH;
      const y = padding.top + chartH - barH;

      ctx.fillStyle = gradient;
      ctx.beginPath();
      const radius = Math.min(4, barWidth / 2);
      ctx.moveTo(x, y + radius);
      ctx.arcTo(x, y, x + barWidth, y, radius);
      ctx.arcTo(x + barWidth, y, x + barWidth, y + barH, radius);
      ctx.lineTo(x + barWidth, padding.top + chartH);
      ctx.lineTo(x, padding.top + chartH);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#888";
      ctx.font = "10px Inter, sans-serif";
      ctx.textAlign = "center";
      const dateStr = new Date(s.date).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
      ctx.save();
      ctx.translate(x + barWidth / 2, h - padding.bottom + 20);
      ctx.rotate(-Math.PI / 6);
      ctx.fillText(dateStr, 0, 0);
      ctx.restore();
    });

  }, [scores]);

  if (!scores || scores.length === 0) {
    return (
      <div className="empty-state">
        <div className="icon">📊</div>
        <h3>No scores yet</h3>
        <p>Your daily scores will appear here after evaluation.</p>
      </div>
    );
  }

  return (
    <div className="score-chart">
      <canvas ref={canvasRef} />
    </div>
  );
}
