import { useState } from "react";
import { Link } from "react-router-dom";
import { useScriptorium } from "../../data/store";
import { Button } from "../../ui/Button";
import { CARD_GRID, WORLD_CARD, CARD_LINK, CARD_NAME, CARD_DESC, DELETE_CHIP, EMPTY_STATE } from "../../ui/pageBits";
import { Modal } from "../../ui/Modal";
import { Field } from "../../ui/Field";

export function CalendarIndexPage({ projectId }: { projectId: string }) {
  const cals = useScriptorium((s) => s.calendars ?? []);
  const pushToast = useScriptorium((s) => s.pushToast);
  const mine = cals.filter((c) => c.projectId === projectId);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [toDelete, setToDelete] = useState<string | null>(null);
  const target = mine.find((c) => c.id === toDelete);

  return (
    <div className="mx-auto max-w-[900px] px-6 py-8">
      <header className="grid gap-1.5 justify-items-start mb-5">
        <h1>Calendar</h1>
        <p className="text-slate text-sm">Build the calendar your world actually runs on.</p>
        <Button onClick={() => setCreating(true)}>New calendar</Button>
      </header>

      {mine.length === 0 ? (
        <div className={EMPTY_STATE}>
          <p>No saved calendars found. Create a new calendar first!</p>
          <p className="text-slate text-sm">Choose your own months, weekdays and year length.</p>
        </div>
      ) : (
        <div className={CARD_GRID}>
          {mine.map((c) => (
            <article key={c.id} className={WORLD_CARD}>
              <Link className={CARD_LINK} to={`/p/${projectId}/calendar/${c.id}`}>
                <h2 className={CARD_NAME}>{c.name}</h2>
                <p className={CARD_DESC}>{c.months.length} months · {Object.keys(c.events).length} days with events</p>
              </Link>
              <button title="Delete calendar" className={DELETE_CHIP} onClick={() => setToDelete(c.id)}>✕</button>
            </article>
          ))}
        </div>
      )}

      {creating ? (
        <Modal title="New calendar" onClose={() => setCreating(false)}>
          <div className="grid gap-3">
            <Field label="Name"><input aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <div className="mt-2 flex justify-end gap-2.5">
              <Button onClick={() => {
                const n = name.trim();
                if (!n) { pushToast("error", "Please enter a calendar name."); return; }
                useScriptorium.getState().addCalendar(projectId, n);
                setCreating(false);
                setName("");
              }}>Create</Button>
              <Button kind="ghost" onClick={() => setCreating(false)}>Cancel</Button>
            </div>
          </div>
        </Modal>
      ) : null}

      {target ? (
        <Modal title={`Excluir "${target.name}"?`} onClose={() => setToDelete(null)}>
          <p className="text-parchment-dim">Removes months, days and events. No undo.</p>
          <div className="mt-2 flex justify-end gap-2.5">
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
