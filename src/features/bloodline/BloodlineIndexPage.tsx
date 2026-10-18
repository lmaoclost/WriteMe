import { Link } from "react-router-dom";
import { useScriptorium } from "../../data/store";
import { undoToastAction } from "../../ui/undoAction";
import { Button } from "../../ui/Button";
import { CARD_GRID, WORLD_CARD, CARD_LINK, CARD_NAME, CARD_DESC, DELETE_CHIP, EMPTY_STATE } from "../../ui/pageBits";
import { Modal } from "../../ui/Modal";
import { Field } from "../../ui/Field";
import { useState } from "react";

export function BloodlineIndexPage({ projectId }: { projectId: string }) {
  const bloodlines = useScriptorium((s) => s.bloodlines);
  const mine = bloodlines.filter((b) => b.projectId === projectId);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [toDelete, setToDelete] = useState<string | null>(null);
  const pushToast = useScriptorium((s) => s.pushToast);

  const target = mine.find((b) => b.id === toDelete);

  return (
    <div className="mx-auto max-w-[900px] px-6 py-8">
      <header className="grid gap-1.5 justify-items-start mb-5">
        <h1>Bloodline</h1>
        <p className="text-slate text-sm">Family trees, lineages and the houses they belong to.</p>
        <Button onClick={() => setCreating(true)}>New bloodline</Button>
      </header>

      {mine.length === 0 ? (
        <div className={EMPTY_STATE}>
          <p>No saved bloodlines found. Create a new bloodline first!</p>
          <p className="text-slate text-sm">Create a new family tree from scratch.</p>
        </div>
      ) : (
        <div className={CARD_GRID}>
          {mine.map((b) => (
            <article key={b.id} className={WORLD_CARD}>
              <Link className={CARD_LINK} to={`/p/${projectId}/bloodline/${b.id}`}>
                <h2 className={CARD_NAME}>{b.name}</h2>
                <p className={CARD_DESC}>{b.persons.length} {b.persons.length === 1 ? "person" : "persons"} · {b.houses.length} {b.houses.length === 1 ? "house" : "houses"}</p>
              </Link>
              <button title="Delete bloodline" className={DELETE_CHIP} onClick={() => setToDelete(b.id)}>✕</button>
            </article>
          ))}
        </div>
      )}

      {creating ? (
        <Modal title="New bloodline" onClose={() => setCreating(false)}>
          <div className="grid gap-3">
            <Field label="Name"><input aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <div className="mt-2 flex justify-end gap-2.5">
              <Button onClick={() => {
                const n = name.trim();
                if (!n) { pushToast("error", "Please enter a family name."); return; }
                useScriptorium.getState().addBloodline(projectId, n);
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
          <p className="text-parchment-dim">Removes persons, houses and notes. No undo.</p>
          <div className="mt-2 flex justify-end gap-2.5">
            <Button kind="danger" onClick={() => {
              useScriptorium.getState().deleteBloodline(target.id);
              pushToast("success", "Bloodline deleted.", undoToastAction());
              setToDelete(null);
            }}>Delete</Button>
            <Button kind="ghost" onClick={() => setToDelete(null)}>Cancel</Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
