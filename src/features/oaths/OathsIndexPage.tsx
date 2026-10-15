import { useState } from "react";
import { Link } from "react-router-dom";
import { useScriptorium } from "../../data/store";
import { Button } from "../../ui/Button";
import { Modal } from "../../ui/Modal";
import { Field } from "../../ui/Field";
import "./oaths.css";

export function OathsIndexPage({ projectId }: { projectId: string }) {
  const charts = useScriptorium((s) => s.oathsCharts ?? []);
  const pushToast = useScriptorium((s) => s.pushToast);
  const mine = charts.filter((c) => c.projectId === projectId);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [toDelete, setToDelete] = useState<string | null>(null);
  const target = mine.find((c) => c.id === toDelete);

  return (
    <div className="bloodline-index">
      <header className="library-head">
        <h1>Oaths Hierarchy</h1>
        <p className="library-sub">Chart who answers to whom — courts, orders, armies and guilds.</p>
        <Button onClick={() => setCreating(true)}>Forge New Oaths Hierarchy</Button>
      </header>

      {mine.length === 0 ? (
        <div className="empty">
          <p>No saved chains of command found. Create a new one first!</p>
          <p className="empty-hint">A primary chain sets the rank.</p>
        </div>
      ) : (
        <div className="library-grid">
          {mine.map((c) => (
            <article key={c.id} className="project-card">
              <Link className="project-link" to={`/p/${projectId}/oaths/${c.id}`}>
                <h2 className="project-name">{c.name}</h2>
                <p className="project-desc">{c.members.length} members · {c.oathLinks.length} oaths</p>
              </Link>
              <button title="Delete oaths hierarchy" className="project-delete" onClick={() => setToDelete(c.id)}>✕</button>
            </article>
          ))}
        </div>
      )}

      {creating ? (
        <Modal title="Forge New Oaths Hierarchy" onClose={() => setCreating(false)}>
          <div className="form-stack">
            <Field label="Name"><input aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <div className="form-actions">
              <Button onClick={() => {
                const n = name.trim();
                if (!n) { pushToast("error", "Please enter a chain name."); return; }
                useScriptorium.getState().addOathsChart(projectId, n);
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
          <p className="modal-warning">Removes members and oaths. No undo.</p>
          <div className="form-actions">
            <Button kind="danger" onClick={() => {
              useScriptorium.getState().deleteOathsChart(target.id);
              pushToast("success", "Hierarchy deleted.");
              setToDelete(null);
            }}>Delete</Button>
            <Button kind="ghost" onClick={() => setToDelete(null)}>Cancel</Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
