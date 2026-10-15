import { useState } from "react";
import { Link } from "react-router-dom";
import { useScriptorium } from "../../data/store";
import { Button } from "../../ui/Button";
import { Modal } from "../../ui/Modal";
import { Field } from "../../ui/Field";
import "./timelinecanvas.css";

export function TimelineIndexPage({ projectId }: { projectId: string }) {
  const lines = useScriptorium((s) => s.timelines ?? []);
  const pushToast = useScriptorium((s) => s.pushToast);
  const mine = lines.filter((t) => t.projectId === projectId);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [toDelete, setToDelete] = useState<string | null>(null);
  const target = mine.find((t) => t.id === toDelete);

  return (
    <div className="bloodline-index">
      <header className="library-head">
        <h1>Linhas do Tempo</h1>
        <p className="library-sub">O fio da história: eventos e eras pendurados numa linha andável.</p>
        <Button onClick={() => setCreating(true)}>Nova linha</Button>
      </header>

      {mine.length === 0 ? (
        <div className="empty">
          <p>Nenhuma linha ainda.</p>
          <p className="empty-hint">Coloque o primeiro evento no fio.</p>
        </div>
      ) : (
        <div className="library-grid">
          {mine.map((t) => (
            <article key={t.id} className="project-card">
              <Link className="project-link" to={`/p/${projectId}/linewheel/${t.id}`}>
                <h2 className="project-name">{t.name}</h2>
                <p className="project-desc">{t.beads.length} eventos · {t.segments.length} eras</p>
              </Link>
              <button title="Excluir linha" className="project-delete" onClick={() => setToDelete(t.id)}>✕</button>
            </article>
          ))}
        </div>
      )}

      {creating ? (
        <Modal title="Nova linha do tempo" onClose={() => setCreating(false)}>
          <div className="form-stack">
            <Field label="Nome"><input aria-label="Nome" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <div className="form-actions">
              <Button onClick={() => {
                const n = name.trim();
                if (!n) { pushToast("error", "Dê um nome à linha."); return; }
                useScriptorium.getState().addTimeline(projectId, n);
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
          <p className="modal-warning">Remove eventos e eras da linha. Sem voltar.</p>
          <div className="form-actions">
            <Button kind="danger" onClick={() => {
              useScriptorium.getState().deleteTimeline(target.id);
              pushToast("success", "Linha excluída.");
              setToDelete(null);
            }}>Excluir</Button>
            <Button kind="ghost" onClick={() => setToDelete(null)}>Cancelar</Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}