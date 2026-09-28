export default function FileUpload({ onFileSelect, disabled = false, accept = ".csv", title = "Upload File", description = "Drag & drop your file here or click to browse", file = null }) {
  function handleDrop(e) {
    e.preventDefault();
    if (disabled) return;
    const dropped = e.dataTransfer?.files?.[0];
    if (dropped) {
      onFileSelect?.(dropped);
    }
  }

  function handleClick() {
    if (disabled) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = (e) => {
      const selected = e.target.files?.[0];
      if (selected) onFileSelect?.(selected);
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
      <div className="upload-icon">📁</div>
      <h3>{title}</h3>
      {file ? (
        <p style={{ color: "var(--accent)", fontWeight: "bold" }}>{file.name}</p>
      ) : (
        <p>{description}</p>
      )}
    </div>
  );
}
