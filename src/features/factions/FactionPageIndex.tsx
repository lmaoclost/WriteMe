import { useState } from "react";
import { Link } from "react-router-dom";
import { useScriptorium } from "../../data/store";
import { undoToastAction } from "../../ui/undoAction";
import { Button } from "../../ui/Button";
import { CARD_GRID, WORLD_CARD, CARD_LINK, CARD_NAME, CARD_DESC, DELETE_CHIP, EMPTY_STATE } from "../../ui/pageBits";
import { Modal } from "../../ui/Modal";
import { Field } from "../../ui/Field";

export function FactionWebServicePage({ projectId }: { projectId: string }) {
  const webs = useScriptorium((s) => s.factionWebs ?? []);
  const pushToast = useScriptorium((s) => s.pushToast);
  const mine = webs.filter((w) => w.projectId === projectId);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [toDelete, setToDelete] = useState<string | null>(null);
  const target = mine.find((w) => w.id === toDelete);

  return (
    <div className="mx-auto max-w-[900px] px-6 py-8">
      <header className="grid gap-1.5 justify-items-start mb-5">
        <h1>Factions</h1>
        <p className="text-slate text-sm">How the powers in your world regard one another.</p>
        <Button onClick={() => setCreating(true)}>New faction web</Button>
      </header>

      {mine.length === 0 ? (
        <div className={EMPTY_STATE}>
          <p>No saved faction webs found. Create a new one first!</p>
          <p className="text-slate text-sm">Add the first faction to the web.</p>
        </div>
      ) : (
        <div className={CARD_GRID}>
          {mine.map((w) => (
            <article key={w.id} className={WORLD_CARD}>
              <Link className={CARD_LINK} to={`/p/${projectId}/factions/${w.id}`}>
                <h2 className={CARD_NAME}>{w.name}</h2>
                <p className={CARD_DESC}>{w.factions.length} factions · {w.connections.length} connections</p>
              </Link>
              <button title="Delete faction web" className={DELETE_CHIP} onClick={() => setToDelete(w.id)}>✕</button>
            </article>
          ))}
        </div>
      )}

      {creating ? (
        <Modal title="New faction web" onClose={() => setCreating(false)}>
          <div className="grid gap-3">
            <Field label="Name"><input aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <div className="mt-2 flex justify-end gap-2.5">
              <Button onClick={() => {
                const n = name.trim();
                if (!n) { pushToast("error", "Please enter a web name."); return; }
                useScriptorium.getState().addFactionWeb(projectId, n);
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
          <p className="text-parchment-dim">Removes factions and connections. No undo.</p>
          <div className="mt-2 flex justify-end gap-2.5">
            <Button kind="danger" onClick={() => {
              useScriptorium.getState().deleteFactionWeb(target.id);
              pushToast("success", "Faction web deleted.", undoToastAction());
              setToDelete(null);
            }}>Delete</Button>
            <Button kind="ghost" onClick={() => setToDelete(null)}>Cancel</Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
