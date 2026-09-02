export default function FileUpload({ onFileSelect, disabled = false }) {
  function handleDrop(e) {
    e.preventDefault();
    if (disabled) return;
    const file = e.dataTransfer?.files?.[0];
    if (file && file.name.endsWith(".onnx")) {
      onFileSelect?.(file);
    }
  }

  function handleClick() {
    if (disabled) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".onnx";
    input.onchange = (e) => {
      const file = e.target.files?.[0];
      if (file) onFileSelect?.(file);
    };
    input.click();
  }

  return (
    <div
      className={`upload-zone ${disabled ? "disabled" : ""}`}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      onClick={handleClick}
      style={disabled ? { opacity: 0.5, cursor: "not-allowed" } : {}}
    >
      <div className="upload-icon">📤</div>
      <h3>Upload ONNX Model</h3>
      <p>Drag & drop your .onnx file here or click to browse</p>
      <p style={{ marginTop: "8px", fontSize: "12px", color: "var(--text-muted)" }}>
        Daily limit: 1 upload per day
      </p>
    </div>
  );
}
