import { useState } from "react";
import { Link } from "react-router-dom";
import { useScriptorium } from "../../data/store";
import { Button } from "../../ui/Button";
import { Modal } from "../../ui/Modal";
import { Field } from "../../ui/Field";
import "./factions.css";

export function FactionWebServicePage({ projectId }: { projectId: string }) {
  const webs = useScriptorium((s) => s.factionWebs ?? []);
  const pushToast = useScriptorium((s) => s.pushToast);
  const mine = webs.filter((w) => w.projectId === projectId);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [toDelete, setToDelete] = useState<string | null>(null);
  const target = mine.find((w) => w.id === toDelete);

  return (
    <div className="bloodline-index">
      <header className="library-head">
        <h1>Frações</h1>
        <p className="library-sub">Teias de alianças, rivais e vassalagens.</p>
        <Button onClick={() => setCreating(true)}>Nova teia</Button>
      </header>

      {mine.length === 0 ? (
        <div className="empty">
          <p>Nenhuma teia ainda.</p>
          <p className="empty-hint">Adicione a primeira fração da teia.</p>
        </div>
      ) : (
        <div className="library-grid">
          {mine.map((w) => (
            <article key={w.id} className="project-card">
              <Link className="project-link" to={`/p/${projectId}/factions/${w.id}`}>
                <h2 className="project-name">{w.name}</h2>
                <p className="project-desc">{w.factions.length} frações · {w.connections.length} relações</p>
              </Link>
              <button title="Excluir teia" className="project-delete" onClick={() => setToDelete(w.id)}>✕</button>
            </article>
          ))}
        </div>
      )}

      {creating ? (
        <Modal title="Nova teia de frações" onClose={() => setCreating(false)}>
          <div className="form-stack">
            <Field label="Nome"><input aria-label="Nome" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <div className="form-actions">
              <Button onClick={() => {
                const n = name.trim();
                if (!n) { pushToast("error", "Dê um nome à teia."); return; }
                useScriptorium.getState().addFactionWeb(projectId, n);
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
          <p className="modal-warning">Remove frações e relações. Sem voltar.</p>
          <div className="form-actions">
            <Button kind="danger" onClick={() => {
              useScriptorium.getState().deleteFactionWeb(target.id);
              pushToast("success", "Teia excluída.");
              setToDelete(null);
            }}>Excluir</Button>
            <Button kind="ghost" onClick={() => setToDelete(null)}>Cancelar</Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}