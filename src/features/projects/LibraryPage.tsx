import { useState } from "react";
import { Link } from "react-router-dom";
import { useScriptorium } from "../../data/store";
import { Button } from "../../ui/Button";
import { Field } from "../../ui/Field";
import { Modal } from "../../ui/Modal";
import "./projects.css";

export function LibraryPage() {
  const projects = useScriptorium((s) => s.projects);
  const addProject = useScriptorium((s) => s.addProject);
  const deleteProject = useScriptorium((s) => s.deleteProject);
  const pushToast = useScriptorium((s) => s.pushToast);
  const images = useScriptorium((s) => s.images);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [toDelete, setToDelete] = useState<string | null>(null);

  const submitCreate = () => {
    const n = name.trim();
    if (!n) { pushToast("error", "Dê um nome ao mundo."); return; }
    addProject(n, description.trim());
    setCreating(false);
    setName("");
    setDescription("");
  };

  const target = projects.find((p) => p.id === toDelete);

  return (
    <div className="library">
      <header className="library-head">
        <h1>Scriptorium</h1>
        <p className="library-sub">Mundos, atlas e livros — tudo no seu navegador.</p>
        <Button onClick={() => setCreating(true)}>Novo mundo</Button>
      </header>

      {projects.length === 0 && (
        <div className="empty">
          <p>Nenhum mundo ainda.</p>
          <p className="empty-hint">Crie seu primeiro mundo para começar a construir.</p>
        </div>
      )}

      <div className="library-grid">
        {projects.map((p) => (
          <article key={p.id} className="project-card">
            <Link to={`/p/${p.id}`} className="project-link">
              {p.coverImageKey && images[p.coverImageKey] && (
                <img className="project-cover" src={images[p.coverImageKey]} alt="" />
              )}
              <h2 className="project-name">{p.name}</h2>
              {p.description && <p className="project-desc">{p.description}</p>}
            </Link>
            <button title="Excluir projeto" aria-label="Excluir projeto" className="project-delete" onClick={() => setToDelete(p.id)}>
              ✕
            </button>
          </article>
        ))}
      </div>

      {creating && (
        <Modal title="Novo mundo" onClose={() => setCreating(false)}>
          <div className="form-stack">
            <Field label="Nome"><input aria-label="Nome" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="Descrição"><textarea aria-label="Descrição" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} /></Field>
            <div className="form-actions">
              <Button onClick={submitCreate}>Criar</Button>
              <Button kind="ghost" onClick={() => setCreating(false)}>Cancelar</Button>
            </div>
          </div>
        </Modal>
      )}

      {target && (
        <Modal title={`Excluir "${target.name}"?`} onClose={() => setToDelete(null)}>
          <p className="modal-warning">
            Isso remove o mundo, suas entradas, atlas e manuscritos. Sem voltar.
          </p>
          <div className="form-actions">
            <Button kind="danger" onClick={() => { deleteProject(target.id); setToDelete(null); pushToast("success", "Mundo excluído."); }}>
              Excluir
            </Button>
            <Button kind="ghost" onClick={() => setToDelete(null)}>Cancelar</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}