import { useState } from "react";
import { Link } from "react-router-dom";
import { useScriptorium } from "../../data/store";
import { Button } from "../../ui/Button";
import { Modal } from "../../ui/Modal";
import { Field } from "../../ui/Field";
import "./calendar.css";

export function CalendarIndexPage({ projectId }: { projectId: string }) {
  const cals = useScriptorium((s) => s.calendars ?? []);
  const pushToast = useScriptorium((s) => s.pushToast);
  const mine = cals.filter((c) => c.projectId === projectId);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [toDelete, setToDelete] = useState<string | null>(null);
  const target = mine.find((c) => c.id === toDelete);

  return (
    <div className="bloodline-index">
      <header className="library-head">
        <h1>Calendários</h1>
        <p className="library-sub">O tempo do seu mundo — meses, dias e festas próprios.</p>
        <Button onClick={() => setCreating(true)}>Novo calendário</Button>
      </header>

      {mine.length === 0 ? (
        <div className="empty">
          <p>Nenhum calendário ainda.</p>
          <p className="empty-hint">Crie o tempo do seu mundo.</p>
        </div>
      ) : (
        <div className="library-grid">
          {mine.map((c) => (
            <article key={c.id} className="project-card">
              <Link className="project-link" to={`/p/${projectId}/calendar/${c.id}`}>
                <h2 className="project-name">{c.name}</h2>
                <p className="project-desc">{c.months.length} meses · {Object.keys(c.events).length} dias com eventos</p>
              </Link>
              <button title="Excluir calendário" className="project-delete" onClick={() => setToDelete(c.id)}>✕</button>
            </article>
          ))}
        </div>
      )}

      {creating ? (
        <Modal title="Novo calendário" onClose={() => setCreating(false)}>
          <div className="form-stack">
            <Field label="Nome"><input aria-label="Nome" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <div className="form-actions">
              <Button onClick={() => {
                const n = name.trim();
                if (!n) { pushToast("error", "Dê um nome ao calendário."); return; }
                useScriptorium.getState().addCalendar(projectId, n);
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
          <p className="modal-warning">Remove meses, dias e eventos. Sem voltar.</p>
          <div className="form-actions">
            <Button kind="danger" onClick={() => {
              useScriptorium.getState().deleteCalendar(target.id);
              pushToast("success", "Calendário excluído.");
              setToDelete(null);
            }}>Excluir</Button>
            <Button kind="ghost" onClick={() => setToDelete(null)}>Cancelar</Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}