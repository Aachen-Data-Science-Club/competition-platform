import { createPortal } from "react-dom";

export default function Toast({ text, type = "success" }) {
  if (!text) return null;

  return createPortal(
    <div className={`toast toast-${type}`} role="status" aria-live="polite">
      {text}
    </div>,
    document.body
  );
}
