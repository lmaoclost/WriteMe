import { useState, type KeyboardEvent } from "react";
import { Link, useNavigate, useOutletContext } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import { useScriptorium } from "../../data/store";
import type { Atlas } from "../../domain/types";
import { Button } from "../../ui/Button";
import { Field } from "../../ui/Field";
import { Modal } from "../../ui/Modal";
import type { WorkspaceContext } from "../workspace/OverviewPage";
import "./atlas.css";

function AtlasCard({ atlas, confirm, onConfirmArm, onDelete }: {
  atlas: Atlas;
  confirm: boolean;
  onConfirmArm(): void;
  onDelete(): void;
}) {
  const images = useScriptorium((s) => s.images);
  const thumb = atlas.mapImageKey ? images[atlas.mapImageKey] : undefined;
  return (
    <article className="atlas-card">
      <Link className="atlas-card-link" to={atlas.id}>
        <div className="atlas-card-thumb">
          {thumb ? <img src={thumb} alt={`Map of ${atlas.name}`} /> : <span aria-hidden="true">◇</span>}
        </div>
        <h2 className="atlas-card-name">{atlas.name}</h2>
        <p className="atlas-card-counts">
          {atlas.regions.length} regions · {atlas.pins.length} pins
        </p>
      </Link>
      <button
        type="button"
        className={"atlas-card-delete" + (confirm ? " armed" : "")}
        aria-label={`Delete atlas ${atlas.name}`}
        onClick={() => (confirm ? onDelete() : onConfirmArm())}
      >
        {confirm ? "Confirm?" : "✕"}
      </button>
    </article>
  );
}

export function AtlasIndexPage() {
  const { projectId } = useOutletContext<WorkspaceContext>();
  const projectAtlases = useScriptorium(
    useShallow((s) => s.atlases.filter((a) => a.projectId === projectId)),
  );
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [name, setName] = useState("");

  const create = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const atlas = useScriptorium.getState().addAtlas(projectId, trimmed);
    setCreating(false);
    setName("");
    navigate(`/p/${projectId}/atlas/${atlas.id}`);
  };

  const remove = (atlasId: string) => {
    useScriptorium.getState().deleteAtlas(atlasId);
    useScriptorium.getState().pushToast("success", "Atlas deleted.");
    setConfirmId(null);
  };

  const createOnEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      create();
    }
  };

  return (
    <div className="atlas-index">
      <header className="atlas-index-head">
        <h1>Atlas</h1>
        <Button onClick={() => setCreating(true)}>Forge New Atlas</Button>
      </header>
      {projectAtlases.length === 0 ? (
        <p className="atlas-index-empty">No saved atlases found. Create a new one first!</p>
      ) : (
        <div className="atlas-card-grid">
          {projectAtlases.map((a) => (
            <AtlasCard
              key={a.id}
              atlas={a}
              confirm={confirmId === a.id}
              onConfirmArm={() => setConfirmId(a.id)}
              onDelete={() => remove(a.id)}
            />
          ))}
        </div>
      )}
      {creating ? (
        <Modal title="Forge New Atlas" onClose={() => setCreating(false)}>
          <div className="atlas-create-form">
            <Field label="Name">
              <input
                type="text"
                aria-label="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={createOnEnter}
              />
            </Field>
            <div className="atlas-create-actions">
              <Button kind="ghost" onClick={() => setCreating(false)}>Cancel</Button>
              <Button onClick={create}>Forge</Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
