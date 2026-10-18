import { useState } from "react";
import { Link } from "react-router-dom";
import { useScriptorium } from "../../data/store";
import { Button } from "../../ui/Button";
import { CARD_GRID, WORLD_CARD, CARD_LINK, CARD_NAME, CARD_DESC, DELETE_CHIP, EMPTY_STATE } from "../../ui/pageBits";
import { Modal } from "../../ui/Modal";
import { Field } from "../../ui/Field";

export function WellSpringIndexPage({ projectId }: { projectId: string }) {
  const wells = useScriptorium((s) => s.wellsprings ?? []);
  const pushToast = useScriptorium((s) => s.pushToast);
  const mine = wells.filter((w) => w.projectId === projectId);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [toDelete, setToDelete] = useState<string | null>(null);
  const target = mine.find((w) => w.id === toDelete);

  return (
    <div className="mx-auto max-w-[900px] px-6 py-8">
      <header className="grid gap-1.5 justify-items-start mb-5">
        <h1>Ideas</h1>
        <p className="text-slate text-sm">Somewhere to put an idea before it has a home.</p>
        <Button onClick={() => setCreating(true)}>New idea board</Button>
      </header>

      {mine.length === 0 ? (
        <div className={EMPTY_STATE}>
          <p>No idea boards found. Create a new one first!</p>
          <p className="text-slate text-sm">Loose ideas, before they have a home.</p>
        </div>
      ) : (
        <div className={CARD_GRID}>
          {mine.map((w) => (
            <article key={w.id} className={WORLD_CARD}>
              <Link className={CARD_LINK} to={`/p/${projectId}/wellspring/${w.id}`}>
                <h2 className={CARD_NAME}>{w.name}</h2>
                <p className={CARD_DESC}>{w.nodes.length} circles · {w.borders.length} lines</p>
              </Link>
              <button title="Delete idea board" className={DELETE_CHIP} onClick={() => setToDelete(w.id)}>✕</button>
            </article>
          ))}
        </div>
      )}

      {creating ? (
        <Modal title="New idea board" onClose={() => setCreating(false)}>
          <div className="grid gap-3">
            <Field label="Name"><input aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <div className="mt-2 flex justify-end gap-2.5">
              <Button onClick={() => {
                const n = name.trim();
                if (!n) { pushToast("error", "Please enter a name."); return; }
                useScriptorium.getState().addWellSpring(projectId, n);
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
          <p className="text-parchment-dim">Removes circles and lines. No undo.</p>
          <div className="mt-2 flex justify-end gap-2.5">
            <Button kind="danger" onClick={() => {
              useScriptorium.getState().deleteWellSpring(target.id);
              pushToast("success", "Idea board deleted.");
              setToDelete(null);
            }}>Delete</Button>
            <Button kind="ghost" onClick={() => setToDelete(null)}>Cancel</Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
