import { Link } from "react-router-dom";
import { useScriptorium } from "../../data/store";
import { Button } from "../../ui/Button";
import { Modal } from "../../ui/Modal";
import { Field } from "../../ui/Field";
import { useState } from "react";
import "./bloodline.css";

export function BloodlineIndexPage({ projectId }: { projectId: string }) {
  const bloodlines = useScriptorium((s) => s.bloodlines);
  const mine = bloodlines.filter((b) => b.projectId === projectId);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [toDelete, setToDelete] = useState<string | null>(null);
  const pushToast = useScriptorium((s) => s.pushToast);

  const target = mine.find((b) => b.id === toDelete);

  return (
    <div className="bloodline-index">
      <header className="library-head">
        <h1>Linhagens</h1>
        <p className="library-sub">Genealogias do mundo — pessoas, casas e laços de sangue.</p>
        <Button onClick={() => setCreating(true)}>Nova linhagem</Button>
      </header>

      {mine.length === 0 ? (
        <div className="empty">
          <p>Nenhuma linhagem ainda.</p>
          <p className="empty-hint">Comece pela linhagem — crie uma.</p>
        </div>
      ) : (
        <div className="library-grid">
          {mine.map((b) => (
            <article key={b.id} className="project-card">
              <Link className="project-link" to={`/p/${projectId}/bloodline/${b.id}`}>
                <h2 className="project-name">{b.name}</h2>
                <p className="project-desc">{b.persons.length} pessoa{b.persons.length === 1 ? "" : "s"} · {b.houses.length} casa{b.houses.length === 1 ? "" : "s"}</p>
              </Link>
              <button title="Excluir linhagem" className="project-delete" onClick={() => setToDelete(b.id)}>✕</button>
            </article>
          ))}
        </div>
      )}

      {creating ? (
        <Modal title="Nova linhagem" onClose={() => setCreating(false)}>
          <div className="form-stack">
            <Field label="Nome"><input aria-label="Nome" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <div className="form-actions">
              <Button onClick={() => {
                const n = name.trim();
                if (!n) { pushToast("error", "Dê um nome à linhagem."); return; }
                useScriptorium.getState().addBloodline(projectId, n);
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
          <p className="modal-warning">Isso remove pessoas, casas e notas da linhagem. Sem voltar.</p>
          <div className="form-actions">
            <Button kind="danger" onClick={() => {
              useScriptorium.getState().deleteBloodline(target.id);
              pushToast("success", "Linhagem excluída.");
              setToDelete(null);
            }}>Excluir</Button>
            <Button kind="ghost" onClick={() => setToDelete(null)}>Cancelar</Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}