import { useState } from "react";
import { Link } from "react-router-dom";
import { useScriptorium } from "../../data/store";
import { Button } from "../../ui/Button";
import { Modal } from "../../ui/Modal";
import { Field } from "../../ui/Field";
import "./plotboard.css";

export function PlotBoardIndexPage({ projectId }: { projectId: string }) {
  const boards = useScriptorium((s) => s.plotBoards ?? []);
  const pushToast = useScriptorium((s) => s.pushToast);
  const mine = boards.filter((b) => b.projectId === projectId);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [toDelete, setToDelete] = useState<string | null>(null);
  const target = mine.find((b) => b.id === toDelete);

  return (
    <div className="bloodline-index">
      <header className="library-head">
        <h1>Planos</h1>
        <p className="library-sub">A história como cenas que se movem — atos, POV e beats.</p>
        <Button onClick={() => setCreating(true)}>Novo plano</Button>
      </header>

      {mine.length === 0 ? (
        <div className="empty">
          <p>Nenhum plano ainda.</p>
          <p className="empty-hint">Escreva a primeira cena do plano.</p>
        </div>
      ) : (
        <div className="library-grid">
          {mine.map((b) => (
            <article key={b.id} className="project-card">
              <Link className="project-link" to={`/p/${projectId}/plotboard/${b.id}`}>
                <h2 className="project-name">{b.name}</h2>
                <p className="project-desc">{b.acts.length} atos · {b.cards.length} cenas · {b.wires.length} fios</p>
              </Link>
              <button title="Excluir plano" className="project-delete" onClick={() => setToDelete(b.id)}>✕</button>
            </article>
          ))}
        </div>
      )}

      {creating ? (
        <Modal title="Novo plano" onClose={() => setCreating(false)}>
          <div className="form-stack">
            <Field label="Nome"><input aria-label="Nome" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <div className="form-actions">
              <Button onClick={() => {
                const n = name.trim();
                if (!n) { pushToast("error", "Dê um nome ao plano."); return; }
                useScriptorium.getState().addPlotBoard(projectId, n);
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
          <p className="modal-warning">Remove atos, cenas e fios do plano. Sem voltar.</p>
          <div className="form-actions">
            <Button kind="danger" onClick={() => {
              useScriptorium.getState().deletePlotBoard(target.id);
              pushToast("success", "Plano excluído.");
              setToDelete(null);
            }}>Excluir</Button>
            <Button kind="ghost" onClick={() => setToDelete(null)}>Cancelar</Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}