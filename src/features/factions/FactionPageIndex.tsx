import { useState } from "react";
import { Link } from "react-router-dom";
import { useScriptorium } from "../../data/store";
import { Button } from "../../ui/Button";
import { Modal } from "../../ui/Modal";
import { Field } from "../../ui/Field";
import "./factions.css";

export function FactionWebServicePage({ projectId }: { projectId: string }) {
  const webs = useScriptorium((s) => s.factionWebs ?? []);
  const pushToast = useScriptorium((s) => s.pushToast);
  const mine = webs.filter((w) => w.projectId === projectId);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [toDelete, setToDelete] = useState<string | null>(null);
  const target = mine.find((w) => w.id === toDelete);

  return (
    <div className="bloodline-index">
      <header className="library-head">
        <h1>Faction Webs</h1>
        <p className="library-sub">How the powers in your world regard one another.</p>
        <Button onClick={() => setCreating(true)}>Forge New Faction Web</Button>
      </header>

      {mine.length === 0 ? (
        <div className="empty">
          <p>No saved faction webs found. Create a new one first!</p>
          <p className="empty-hint">Add the first faction to the web.</p>
        </div>
      ) : (
        <div className="library-grid">
          {mine.map((w) => (
            <article key={w.id} className="project-card">
              <Link className="project-link" to={`/p/${projectId}/factions/${w.id}`}>
                <h2 className="project-name">{w.name}</h2>
                <p className="project-desc">{w.factions.length} factions · {w.connections.length} connections</p>
              </Link>
              <button title="Delete faction web" className="project-delete" onClick={() => setToDelete(w.id)}>✕</button>
            </article>
          ))}
        </div>
      )}

      {creating ? (
        <Modal title="Forge New Faction Web" onClose={() => setCreating(false)}>
          <div className="form-stack">
            <Field label="Name"><input aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <div className="form-actions">
              <Button onClick={() => {
                const n = name.trim();
                if (!n) { pushToast("error", "Please enter a web name."); return; }
                useScriptorium.getState().addFactionWeb(projectId, n);
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
          <p className="modal-warning">Removes factions and connections. No undo.</p>
          <div className="form-actions">
            <Button kind="danger" onClick={() => {
              useScriptorium.getState().deleteFactionWeb(target.id);
              pushToast("success", "Faction web deleted.");
              setToDelete(null);
            }}>Delete</Button>
            <Button kind="ghost" onClick={() => setToDelete(null)}>Cancel</Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
