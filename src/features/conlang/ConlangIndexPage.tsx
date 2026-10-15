import { useState } from "react";
import { Link } from "react-router-dom";
import { useScriptorium } from "../../data/store";
import { Button } from "../../ui/Button";
import { Modal } from "../../ui/Modal";
import { Field } from "../../ui/Field";
import "./conlang.css";

export function ConlangIndexPage({ projectId }: { projectId: string }) {
  const conlangs = useScriptorium((s) => s.conlangs ?? []);
  const pushToast = useScriptorium((s) => s.pushToast);
  const mine = conlangs.filter((c) => c.projectId === projectId);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [toDelete, setToDelete] = useState<string | null>(null);
  const target = mine.find((c) => c.id === toDelete);

  return (
    <div className="bloodline-index">
      <header className="library-head">
        <h1>Conlang & Lexicon</h1>
        <p className="library-sub">Build a language with its own script and lexicon.</p>
        <Button onClick={() => setCreating(true)}>Forge Conlang</Button>
      </header>

      {mine.length === 0 ? (
        <div className="empty">
          <p>No saved conlangs found. Create a new one first!</p>
          <p className="empty-hint">Invented letters, too.</p>
        </div>
      ) : (
        <div className="library-grid">
          {mine.map((c) => (
            <article key={c.id} className="project-card">
              <Link className="project-link" to={`/p/${projectId}/conlang/${c.id}`}>
                <h2 className="project-name">{c.name}</h2>
                <p className="project-desc">{c.glyphs.length} glyphs · {c.words.length} words</p>
              </Link>
              <button title="Delete conlang" className="project-delete" onClick={() => setToDelete(c.id)}>✕</button>
            </article>
          ))}
        </div>
      )}

      {creating ? (
        <Modal title="Forge Conlang" onClose={() => setCreating(false)}>
          <div className="form-stack">
            <Field label="Name"><input aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <div className="form-actions">
              <Button onClick={() => {
                const n = name.trim();
                if (!n) { pushToast("error", "Please enter a conlang name."); return; }
                useScriptorium.getState().addConlang(projectId, n);
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
          <p className="modal-warning">Removes glyphs and words. No undo.</p>
          <div className="form-actions">
            <Button kind="danger" onClick={() => {
              useScriptorium.getState().deleteConlang(target.id);
              pushToast("success", "Conlang deleted.");
              setToDelete(null);
            }}>Delete</Button>
            <Button kind="ghost" onClick={() => setToDelete(null)}>Cancel</Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
