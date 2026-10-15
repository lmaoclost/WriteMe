import { useState } from "react";
import { Link } from "react-router-dom";
import { useScriptorium } from "../../data/store";
import { Button } from "../../ui/Button";
import { Modal } from "../../ui/Modal";
import { Field } from "../../ui/Field";
import "./calendar.css";

export function CalendarIndexPage({ projectId }: { projectId: string }) {
  const cals = useScriptorium((s) => s.calendars ?? []);
  const pushToast = useScriptorium((s) => s.pushToast);
  const mine = cals.filter((c) => c.projectId === projectId);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [toDelete, setToDelete] = useState<string | null>(null);
  const target = mine.find((c) => c.id === toDelete);

  return (
    <div className="bloodline-index">
      <header className="library-head">
        <h1>Calendar</h1>
        <p className="library-sub">Build the calendar your world actually runs on.</p>
        <Button onClick={() => setCreating(true)}>Forge New Calendar</Button>
      </header>

      {mine.length === 0 ? (
        <div className="empty">
          <p>No saved calendars found. Create a new calendar first!</p>
          <p className="empty-hint">Choose your own months, weekdays and year length.</p>
        </div>
      ) : (
        <div className="library-grid">
          {mine.map((c) => (
            <article key={c.id} className="project-card">
              <Link className="project-link" to={`/p/${projectId}/calendar/${c.id}`}>
                <h2 className="project-name">{c.name}</h2>
                <p className="project-desc">{c.months.length} months · {Object.keys(c.events).length} days with events</p>
              </Link>
              <button title="Delete calendar" className="project-delete" onClick={() => setToDelete(c.id)}>✕</button>
            </article>
          ))}
        </div>
      )}

      {creating ? (
        <Modal title="Forge New Calendar" onClose={() => setCreating(false)}>
          <div className="form-stack">
            <Field label="Name"><input aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <div className="form-actions">
              <Button onClick={() => {
                const n = name.trim();
                if (!n) { pushToast("error", "Please enter a calendar name."); return; }
                useScriptorium.getState().addCalendar(projectId, n);
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
          <p className="modal-warning">Removes months, days and events. No undo.</p>
          <div className="form-actions">
            <Button kind="danger" onClick={() => {
              useScriptorium.getState().deleteCalendar(target.id);
              pushToast("success", "Calendar deleted.");
              setToDelete(null);
            }}>Delete</Button>
            <Button kind="ghost" onClick={() => setToDelete(null)}>Cancel</Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
