import { useState } from "react";
import { Link } from "react-router-dom";
import { useScriptorium } from "../../data/store";
import { Button } from "../../ui/Button";
import { Modal } from "../../ui/Modal";
import { Field } from "../../ui/Field";
import "./wellspring.css";

export function WellSpringIndexPage({ projectId }: { projectId: string }) {
  const wells = useScriptorium((s) => s.wellsprings ?? []);
  const pushToast = useScriptorium((s) => s.pushToast);
  const mine = wells.filter((w) => w.projectId === projectId);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [toDelete, setToDelete] = useState<string | null>(null);
  const target = mine.find((w) => w.id === toDelete);

  return (
    <div className="bloodline-index">
      <header className="library-head">
        <h1>Wellspring</h1>
        <p className="library-sub">A fonte da história: personagens, ambientes, conflitos e perguntas bordando a ideia.</p>
        <Button onClick={() => setCreating(true)}>Nova fonte</Button>
      </header>

      {mine.length === 0 ? (
        <div className="empty">
          <p>Nenhuma fonte ainda.</p>
          <p className="empty-hint">A fonte da história começa aqui.</p>
        </div>
      ) : (
        <div className="library-grid">
          {mine.map((w) => (
            <article key={w.id} className="project-card">
              <Link className="project-link" to={`/p/${projectId}/wellspring/${w.id}`}>
                <h2 className="project-name">{w.name}</h2>
                <p className="project-desc">{w.nodes.length} nós · {w.borders.length} bordas</p>
              </Link>
              <button title="Excluir fonte" className="project-delete" onClick={() => setToDelete(w.id)}>✕</button>
            </article>
          ))}
        </div>
      )}

      {creating ? (
        <Modal title="Nova fonte" onClose={() => setCreating(false)}>
          <div className="form-stack">
            <Field label="Nome"><input aria-label="Nome" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <div className="form-actions">
              <Button onClick={() => {
                const n = name.trim();
                if (!n) { pushToast("error", "Dê um nome à fonte."); return; }
                useScriptorium.getState().addWellSpring(projectId, n);
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
          <p className="modal-warning">Remove nós e bordas. Sem voltar.</p>
          <div className="form-actions">
            <Button kind="danger" onClick={() => {
              useScriptorium.getState().deleteWellSpring(target.id);
              pushToast("success", "Fonte excluída.");
              setToDelete(null);
            }}>Excluir</Button>
            <Button kind="ghost" onClick={() => setToDelete(null)}>Cancelar</Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
