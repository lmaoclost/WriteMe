import { useState } from "react";
import { Link } from "react-router-dom";
import { useScriptorium } from "../../data/store";
import { undoToastAction } from "../../ui/undoAction";
import { Button } from "../../ui/Button";
import { Modal } from "../../ui/Modal";
import { Field } from "../../ui/Field";
import { CARD_GRID, WORLD_CARD, CARD_LINK, CARD_NAME, CARD_DESC, DELETE_CHIP, EMPTY_STATE } from "../../ui/pageBits";

export function ConlangIndexPage({ projectId }: { projectId: string }) {
  const conlangs = useScriptorium((s) => s.conlangs ?? []);
  const pushToast = useScriptorium((s) => s.pushToast);
  const mine = conlangs.filter((c) => c.projectId === projectId);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [toDelete, setToDelete] = useState<string | null>(null);
  const target = mine.find((c) => c.id === toDelete);

  return (
    <div className="mx-auto max-w-[900px] px-6 py-8">
      <header className="grid gap-1.5 justify-items-start mb-5">
        <h1>Language</h1>
        <p className="text-slate text-sm">Build a language with its own script and lexicon.</p>
        <Button onClick={() => setCreating(true)}>New language</Button>
      </header>

      {mine.length === 0 ? (
        <div className={EMPTY_STATE}>
          <p>No languages found. Create a new one first!</p>
          <p className="text-slate text-sm">Invented letters, too.</p>
        </div>
      ) : (
        <div className={CARD_GRID}>
          {mine.map((c) => (
            <article key={c.id} className={WORLD_CARD}>
              <Link className={CARD_LINK} to={`/p/${projectId}/conlang/${c.id}`}>
                <h2 className={CARD_NAME}>{c.name}</h2>
                <p className={CARD_DESC}>{c.glyphs.length} glyphs · {c.words.length} words</p>
              </Link>
              <button title="Delete language" className={DELETE_CHIP} onClick={() => setToDelete(c.id)}>✕</button>
            </article>
          ))}
        </div>
      )}

      {creating ? (
        <Modal title="New language" onClose={() => setCreating(false)}>
          <div className="grid gap-3">
            <Field label="Name"><input aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <div className="mt-2 flex justify-end gap-2.5">
              <Button onClick={() => {
                const n = name.trim();
                if (!n) { pushToast("error", "Please enter a name."); return; }
                useScriptorium.getState().addConlang(projectId, n);
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
          <p className="text-parchment-dim">Removes glyphs and words. Undo right after works, from the notification.</p>
          <div className="mt-2 flex justify-end gap-2.5">
            <Button kind="danger" onClick={() => {
              useScriptorium.getState().deleteConlang(target.id);
              pushToast("success", "Language deleted.", undoToastAction());
              setToDelete(null);
            }}>Delete</Button>
            <Button kind="ghost" onClick={() => setToDelete(null)}>Cancel</Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
