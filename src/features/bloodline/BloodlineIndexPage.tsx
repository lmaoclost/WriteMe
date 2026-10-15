import { Link } from "react-router-dom";
import { useScriptorium } from "../../data/store";
import { Button } from "../../ui/Button";
import { Modal } from "../../ui/Modal";
import { Field } from "../../ui/Field";
import { useState } from "react";
import "./bloodline.css";

export function BloodlineIndexPage({ projectId }: { projectId: string }) {
  const bloodlines = useScriptorium((s) => s.bloodlines);
  const mine = bloodlines.filter((b) => b.projectId === projectId);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [toDelete, setToDelete] = useState<string | null>(null);
  const pushToast = useScriptorium((s) => s.pushToast);

  const target = mine.find((b) => b.id === toDelete);

  return (
    <div className="bloodline-index">
      <header className="library-head">
        <h1>Bloodline</h1>
        <p className="library-sub">Family trees, lineages and the houses they belong to.</p>
        <Button onClick={() => setCreating(true)}>Forge New Bloodline</Button>
      </header>

      {mine.length === 0 ? (
        <div className="empty">
          <p>No saved bloodlines found. Create a new bloodline first!</p>
          <p className="empty-hint">Create a new family tree from scratch.</p>
        </div>
      ) : (
        <div className="library-grid">
          {mine.map((b) => (
            <article key={b.id} className="project-card">
              <Link className="project-link" to={`/p/${projectId}/bloodline/${b.id}`}>
                <h2 className="project-name">{b.name}</h2>
                <p className="project-desc">{b.persons.length} {b.persons.length === 1 ? "person" : "persons"} · {b.houses.length} {b.houses.length === 1 ? "house" : "houses"}</p>
              </Link>
              <button title="Delete bloodline" className="project-delete" onClick={() => setToDelete(b.id)}>✕</button>
            </article>
          ))}
        </div>
      )}

      {creating ? (
        <Modal title="Forge New Bloodline" onClose={() => setCreating(false)}>
          <div className="form-stack">
            <Field label="Name"><input aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <div className="form-actions">
              <Button onClick={() => {
                const n = name.trim();
                if (!n) { pushToast("error", "Please enter a family name."); return; }
                useScriptorium.getState().addBloodline(projectId, n);
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
          <p className="modal-warning">Removes persons, houses and notes. No undo.</p>
          <div className="form-actions">
            <Button kind="danger" onClick={() => {
              useScriptorium.getState().deleteBloodline(target.id);
              pushToast("success", "Bloodline deleted.");
              setToDelete(null);
            }}>Delete</Button>
            <Button kind="ghost" onClick={() => setToDelete(null)}>Cancel</Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
