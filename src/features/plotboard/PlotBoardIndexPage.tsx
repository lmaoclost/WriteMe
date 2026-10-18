import { useState } from "react";
import { Link } from "react-router-dom";
import { useScriptorium } from "../../data/store";
import { undoToastAction } from "../../ui/undoAction";
import { Button } from "../../ui/Button";
import { CARD_GRID, WORLD_CARD, CARD_LINK, CARD_NAME, CARD_DESC, DELETE_CHIP, EMPTY_STATE } from "../../ui/pageBits";
import { Modal } from "../../ui/Modal";
import { Field } from "../../ui/Field";

export function PlotBoardIndexPage({ projectId }: { projectId: string }) {
  const boards = useScriptorium((s) => s.plotBoards ?? []);
  const pushToast = useScriptorium((s) => s.pushToast);
  const mine = boards.filter((b) => b.projectId === projectId);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [toDelete, setToDelete] = useState<string | null>(null);
  const target = mine.find((b) => b.id === toDelete);

  return (
    <div className="mx-auto max-w-[900px] px-6 py-8">
      <header className="grid gap-1.5 justify-items-start mb-5">
        <h1>Plot board</h1>
        <p className="text-slate text-sm">Plan your story as scenes you can move around.</p>
        <Button onClick={() => setCreating(true)}>New plot board</Button>
      </header>

      {mine.length === 0 ? (
        <div className={EMPTY_STATE}>
          <p>No saved plot boards found. Create a new one first!</p>
          <p className="text-slate text-sm">Click anywhere to place your first scene.</p>
        </div>
      ) : (
        <div className={CARD_GRID}>
          {mine.map((b) => (
            <article key={b.id} className={WORLD_CARD}>
              <Link className={CARD_LINK} to={`/p/${projectId}/plotboard/${b.id}`}>
                <h2 className={CARD_NAME}>{b.name}</h2>
                <p className={CARD_DESC}>{b.acts.length} acts · {b.cards.length} scenes · {b.wires.length} wires</p>
              </Link>
              <button title="Delete plot board" className={DELETE_CHIP} onClick={() => setToDelete(b.id)}>✕</button>
            </article>
          ))}
        </div>
      )}

      {creating ? (
        <Modal title="New plot board" onClose={() => setCreating(false)}>
          <div className="grid gap-3">
            <Field label="Name"><input aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <div className="mt-2 flex justify-end gap-2.5">
              <Button onClick={() => {
                const n = name.trim();
                if (!n) { pushToast("error", "Please enter a plot board name."); return; }
                useScriptorium.getState().addPlotBoard(projectId, n);
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
          <p className="text-parchment-dim">Removes acts, scenes and wires. Undo right after works, from the notification.</p>
          <div className="mt-2 flex justify-end gap-2.5">
            <Button kind="danger" onClick={() => {
              useScriptorium.getState().deletePlotBoard(target.id);
              pushToast("success", "Plot board deleted.", undoToastAction());
              setToDelete(null);
            }}>Delete</Button>
            <Button kind="ghost" onClick={() => setToDelete(null)}>Cancel</Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
