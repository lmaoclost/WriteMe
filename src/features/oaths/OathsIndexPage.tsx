import { useState } from "react";
import { Link } from "react-router-dom";
import { useScriptorium } from "../../data/store";
import { Button } from "../../ui/Button";
import { Modal } from "../../ui/Modal";
import { Field } from "../../ui/Field";
import "./oaths.css";

export function OathsIndexPage({ projectId }: { projectId: string }) {
  const charts = useScriptorium((s) => s.oathsCharts ?? []);
  const pushToast = useScriptorium((s) => s.pushToast);
  const mine = charts.filter((c) => c.projectId === projectId);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [toDelete, setToDelete] = useState<string | null>(null);
  const target = mine.find((c) => c.id === toDelete);

  return (
    <div className="bloodline-index">
      <header className="library-head">
        <h1>Oaths</h1>
        <p className="library-sub">Cadeias de comando — quem jura a quem.</p>
        <Button onClick={() => setCreating(true)}>Nova hierarquia</Button>
      </header>

      {mine.length === 0 ? (
        <div className="empty">
          <p>Nenhuma hierarquia ainda.</p>
          <p className="empty-hint">Coloque o fundador — todos os oaths descem dele.</p>
        </div>
      ) : (
        <div className="library-grid">
          {mine.map((c) => (
            <article key={c.id} className="project-card">
              <Link className="project-link" to={`/p/${projectId}/oaths/${c.id}`}>
                <h2 className="project-name">{c.name}</h2>
                <p className="project-desc">{c.members.length} membros · {c.oathLinks.length} oaths</p>
              </Link>
              <button title="Excluir hierarquia" className="project-delete" onClick={() => setToDelete(c.id)}>✕</button>
            </article>
          ))}
        </div>
      )}

      {creating ? (
        <Modal title="Nova hierarquia" onClose={() => setCreating(false)}>
          <div className="form-stack">
            <Field label="Nome"><input aria-label="Nome" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <div className="form-actions">
              <Button onClick={() => {
                const n = name.trim();
                if (!n) { pushToast("error", "Dê um nome à hierarquia."); return; }
                useScriptorium.getState().addOathsChart(projectId, n);
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
          <p className="modal-warning">Remove membros e oaths. Sem voltar.</p>
          <div className="form-actions">
            <Button kind="danger" onClick={() => {
              useScriptorium.getState().deleteOathsChart(target.id);
              pushToast("success", "Hierarquia excluída.");
              setToDelete(null);
            }}>Excluir</Button>
            <Button kind="ghost" onClick={() => setToDelete(null)}>Cancelar</Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
