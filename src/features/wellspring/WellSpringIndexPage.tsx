import { useState } from "react";
import { Link } from "react-router-dom";
import { useScriptorium } from "../../data/store";
import { Button } from "../../ui/Button";
import { Modal } from "../../ui/Modal";
import { Field } from "../../ui/Field";
import "./wellspring.css";

export function WellSpringIndexPage({ projectId }: { projectId: string }) {
  const wells = useScriptorium((s) => s.wellsprings ?? []);
  const pushToast = useScriptorium((s) => s.pushToast);
  const mine = wells.filter((w) => w.projectId === projectId);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [toDelete, setToDelete] = useState<string | null>(null);
  const target = mine.find((w) => w.id === toDelete);

  return (
    <div className="bloodline-index">
      <header className="library-head">
        <h1>The Wellspring</h1>
        <p className="library-sub">Somewhere to put an idea before it has a home.</p>
        <Button onClick={() => setCreating(true)}>Forge New Wellspring</Button>
      </header>

      {mine.length === 0 ? (
        <div className="empty">
          <p>No saved wellsprings found. Create a new one first!</p>
          <p className="empty-hint">Loose ideas, before they have a home.</p>
        </div>
      ) : (
        <div className="library-grid">
          {mine.map((w) => (
            <article key={w.id} className="project-card">
              <Link className="project-link" to={`/p/${projectId}/wellspring/${w.id}`}>
                <h2 className="project-name">{w.name}</h2>
                <p className="project-desc">{w.nodes.length} circles · {w.borders.length} lines</p>
              </Link>
              <button title="Delete wellspring" className="project-delete" onClick={() => setToDelete(w.id)}>✕</button>
            </article>
          ))}
        </div>
      )}

      {creating ? (
        <Modal title="Forge New Wellspring" onClose={() => setCreating(false)}>
          <div className="form-stack">
            <Field label="Name"><input aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <div className="form-actions">
              <Button onClick={() => {
                const n = name.trim();
                if (!n) { pushToast("error", "Please enter a wellspring name."); return; }
                useScriptorium.getState().addWellSpring(projectId, n);
                setCreating(false);
                setName("");
              }}>Forge</Button>
              <Button kind="ghost" onClick={() => setCreating(false)}>Cancel</Button>
            </div>
          </div>
        </Modal>
      ) : null}

      {target ? (
        <Modal title={`Excluir "${target.name}"?`} onClose={() => setToDelete(null)}>
          <p className="modal-warning">Removes circles and lines. No undo.</p>
          <div className="form-actions">
            <Button kind="danger" onClick={() => {
              useScriptorium.getState().deleteWellSpring(target.id);
              pushToast("success", "Wellspring deleted.");
              setToDelete(null);
            }}>Delete</Button>
            <Button kind="ghost" onClick={() => setToDelete(null)}>Cancel</Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
