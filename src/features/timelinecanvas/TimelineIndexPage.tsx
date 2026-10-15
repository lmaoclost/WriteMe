import { useState } from "react";
import { Link } from "react-router-dom";
import { useScriptorium } from "../../data/store";
import { Button } from "../../ui/Button";
import { Modal } from "../../ui/Modal";
import { Field } from "../../ui/Field";
import "./timelinecanvas.css";

export function TimelineIndexPage({ projectId }: { projectId: string }) {
  const lines = useScriptorium((s) => s.timelines ?? []);
  const pushToast = useScriptorium((s) => s.pushToast);
  const mine = lines.filter((t) => t.projectId === projectId);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [toDelete, setToDelete] = useState<string | null>(null);
  const target = mine.find((t) => t.id === toDelete);

  return (
    <div className="bloodline-index">
      <header className="library-head">
        <h1>Calendar</h1>
        <p className="library-sub">Lay your world's history out on a line you can walk.</p>
        <Button onClick={() => setCreating(true)}>Forge New Timeline</Button>
      </header>

      {mine.length === 0 ? (
        <div className="empty">
          <p>No saved timelines found. Create a new timeline first!</p>
          <p className="empty-hint">Place the first event on the wire.</p>
        </div>
      ) : (
        <div className="library-grid">
          {mine.map((t) => (
            <article key={t.id} className="project-card">
              <Link className="project-link" to={`/p/${projectId}/linewheel/${t.id}`}>
                <h2 className="project-name">{t.name}</h2>
                <p className="project-desc">{t.beads.length} events · {t.segments.length} eras</p>
              </Link>
              <button title="Delete timeline" className="project-delete" onClick={() => setToDelete(t.id)}>✕</button>
            </article>
          ))}
        </div>
      )}

      {creating ? (
        <Modal title="Forge New Timeline" onClose={() => setCreating(false)}>
          <div className="form-stack">
            <Field label="Name"><input aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <div className="form-actions">
              <Button onClick={() => {
                const n = name.trim();
                if (!n) { pushToast("error", "Please enter a timeline name."); return; }
                useScriptorium.getState().addTimeline(projectId, n);
                setCreating(false);
                setName("");
              }}>Forge</Button>
              <Button kind="ghost" onClick={() => setCreating(false)}>Cancel</Button>
            </div>
          </div>
        </Modal>
      ) : null}

      {target ? (
        <Modal title={`Delete "${target.name}"?`} onClose={() => setToDelete(null)}>
          <p className="modal-warning">Removes events and eras from the timeline. No undo.</p>
          <div className="form-actions">
            <Button kind="danger" onClick={() => {
              useScriptorium.getState().deleteTimeline(target.id);
              pushToast("success", "Timeline deleted.");
              setToDelete(null);
            }}>Delete</Button>
            <Button kind="ghost" onClick={() => setToDelete(null)}>Cancel</Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}