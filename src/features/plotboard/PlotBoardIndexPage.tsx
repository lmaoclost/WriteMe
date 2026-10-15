import { useState } from "react";
import { Link } from "react-router-dom";
import { useScriptorium } from "../../data/store";
import { Button } from "../../ui/Button";
import { Modal } from "../../ui/Modal";
import { Field } from "../../ui/Field";
import "./plotboard.css";

export function PlotBoardIndexPage({ projectId }: { projectId: string }) {
  const boards = useScriptorium((s) => s.plotBoards ?? []);
  const pushToast = useScriptorium((s) => s.pushToast);
  const mine = boards.filter((b) => b.projectId === projectId);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [toDelete, setToDelete] = useState<string | null>(null);
  const target = mine.find((b) => b.id === toDelete);

  return (
    <div className="bloodline-index">
      <header className="library-head">
        <h1>Plot board</h1>
        <p className="library-sub">Plan your story as scenes you can move around.</p>
        <Button onClick={() => setCreating(true)}>Forge New Plot Board</Button>
      </header>

      {mine.length === 0 ? (
        <div className="empty">
          <p>No saved plot boards found. Create a new one first!</p>
          <p className="empty-hint">Click anywhere to place your first scene.</p>
        </div>
      ) : (
        <div className="library-grid">
          {mine.map((b) => (
            <article key={b.id} className="project-card">
              <Link className="project-link" to={`/p/${projectId}/plotboard/${b.id}`}>
                <h2 className="project-name">{b.name}</h2>
                <p className="project-desc">{b.acts.length} acts · {b.cards.length} scenes · {b.wires.length} wires</p>
              </Link>
              <button title="Delete plot board" className="project-delete" onClick={() => setToDelete(b.id)}>✕</button>
            </article>
          ))}
        </div>
      )}

      {creating ? (
        <Modal title="Forge New Plot Board" onClose={() => setCreating(false)}>
          <div className="form-stack">
            <Field label="Name"><input aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <div className="form-actions">
              <Button onClick={() => {
                const n = name.trim();
                if (!n) { pushToast("error", "Please enter a plot board name."); return; }
                useScriptorium.getState().addPlotBoard(projectId, n);
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
          <p className="modal-warning">Removes acts, scenes and wires. No undo.</p>
          <div className="form-actions">
            <Button kind="danger" onClick={() => {
              useScriptorium.getState().deletePlotBoard(target.id);
              pushToast("success", "Plot board deleted.");
              setToDelete(null);
            }}>Delete</Button>
            <Button kind="ghost" onClick={() => setToDelete(null)}>Cancel</Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}