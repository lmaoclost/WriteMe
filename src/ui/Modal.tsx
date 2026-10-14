import type { ReactNode } from "react";

export function Modal({ title, onClose, children }: { title: ReactNode; onClose: () => void; children?: ReactNode | undefined }) {
  return (
    <div className="modal-scrim" onClick={onClose} role="presentation">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : "Diálogo"}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-head">
          <h2 className="modal-title">{title}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Fechar">✕</button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}