import { useState } from "react";
import { Link } from "react-router-dom";
import { useScriptorium } from "../../data/store";
import { undoToastAction } from "../../ui/undoAction";
import { Button } from "../../ui/Button";
import { CARD_GRID, WORLD_CARD, CARD_LINK, CARD_NAME, CARD_DESC, DELETE_CHIP, EMPTY_STATE } from "../../ui/pageBits";
import { Modal } from "../../ui/Modal";
import { Field } from "../../ui/Field";

export function TimelineIndexPage({ projectId }: { projectId: string }) {
  const lines = useScriptorium((s) => s.timelines ?? []);
  const pushToast = useScriptorium((s) => s.pushToast);
  const mine = lines.filter((t) => t.projectId === projectId);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [toDelete, setToDelete] = useState<string | null>(null);
  const target = mine.find((t) => t.id === toDelete);

  return (
    <div className="mx-auto max-w-[900px] px-6 py-8">
      <header className="grid gap-1.5 justify-items-start mb-5">
        <h1>Timeline</h1>
        <p className="text-slate text-sm">Lay your world's history out on a line you can walk.</p>
        <Button onClick={() => setCreating(true)}>New timeline</Button>
      </header>

      {mine.length === 0 ? (
        <div className={EMPTY_STATE}>
          <p>No saved timelines found. Create a new timeline first!</p>
          <p className="text-slate text-sm">Place the first event on the wire.</p>
        </div>
      ) : (
        <div className={CARD_GRID}>
          {mine.map((t) => (
            <article key={t.id} className={WORLD_CARD}>
              <Link className={CARD_LINK} to={`/p/${projectId}/linewheel/${t.id}`}>
                <h2 className={CARD_NAME}>{t.name}</h2>
                <p className={CARD_DESC}>{t.beads.length} events · {t.segments.length} eras</p>
              </Link>
              <button title="Delete timeline" className={DELETE_CHIP} onClick={() => setToDelete(t.id)}>✕</button>
            </article>
          ))}
        </div>
      )}

      {creating ? (
        <Modal title="New timeline" onClose={() => setCreating(false)}>
          <div className="grid gap-3">
            <Field label="Name"><input aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <div className="mt-2 flex justify-end gap-2.5">
              <Button onClick={() => {
                const n = name.trim();
                if (!n) { pushToast("error", "Please enter a timeline name."); return; }
                useScriptorium.getState().addTimeline(projectId, n);
                setCreating(false);
                setName("");
              }}>Create</Button>
              <Button kind="ghost" onClick={() => setCreating(false)}>Cancel</Button>
            </div>
          </div>
        </Modal>
      ) : null}

      {target ? (
        <Modal title={`Delete "${target.name}"?`} onClose={() => setToDelete(null)}>
          <p className="text-parchment-dim">Removes events and eras from the timeline. No undo.</p>
          <div className="mt-2 flex justify-end gap-2.5">
            <Button kind="danger" onClick={() => {
              useScriptorium.getState().deleteTimeline(target.id);
              pushToast("success", "Timeline deleted.", undoToastAction());
              setToDelete(null);
            }}>Delete</Button>
            <Button kind="ghost" onClick={() => setToDelete(null)}>Cancel</Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
