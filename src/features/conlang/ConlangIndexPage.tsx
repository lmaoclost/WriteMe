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
        <h1>Conlangs</h1>
        <p className="library-sub">Línguas inventadas — glifos, alfabeto e léxico.</p>
        <Button onClick={() => setCreating(true)}>Novo conlang</Button>
      </header>

      {mine.length === 0 ? (
        <div className="empty">
          <p>Nenhum conlang ainda.</p>
          <p className="empty-hint">Uma língua inventada, até as formas das letras.</p>
        </div>
      ) : (
        <div className="library-grid">
          {mine.map((c) => (
            <article key={c.id} className="project-card">
              <Link className="project-link" to={`/p/${projectId}/conlang/${c.id}`}>
                <h2 className="project-name">{c.name}</h2>
                <p className="project-desc">{c.glyphs.length} glifos · {c.words.length} palavras</p>
              </Link>
              <button title="Excluir conlang" className="project-delete" onClick={() => setToDelete(c.id)}>✕</button>
            </article>
          ))}
        </div>
      )}

      {creating ? (
        <Modal title="Novo conlang" onClose={() => setCreating(false)}>
          <div className="form-stack">
            <Field label="Nome"><input aria-label="Nome" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <div className="form-actions">
              <Button onClick={() => {
                const n = name.trim();
                if (!n) { pushToast("error", "Dê um nome ao conlang."); return; }
                useScriptorium.getState().addConlang(projectId, n);
                setCreating(false);
                setName("");
              }}>Criar</Button>
              <Button kind="ghost" onClick={() => setCreating(false)}>Cancelar</Button>
            </div>
          </div>
        </Modal>
      ) : null}

      {target ? (
        <Modal title={`Excluir "${target.name}"?`} onClose={() => setToDelete(null)}>
          <p className="modal-warning">Remove glifos e palavras. Sem voltar.</p>
          <div className="form-actions">
            <Button kind="danger" onClick={() => {
              useScriptorium.getState().deleteConlang(target.id);
              pushToast("success", "Conlang excluído.");
              setToDelete(null);
            }}>Excluir</Button>
            <Button kind="ghost" onClick={() => setToDelete(null)}>Cancelar</Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}