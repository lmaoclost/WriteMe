import { useState, type KeyboardEvent } from "react";
import { Link, useNavigate, useOutletContext } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import { useScriptorium } from "../../data/store";
import type { Atlas } from "../../domain/types";
import { Button } from "../../ui/Button";
import { Field } from "../../ui/Field";
import { Modal } from "../../ui/Modal";
import type { WorkspaceContext } from "../workspace/OverviewPage";

function AtlasCard({ atlas, confirm, onConfirmArm, onDelete }: {
  atlas: Atlas;
  confirm: boolean;
  onConfirmArm(): void;
  onDelete(): void;
}) {
  const images = useScriptorium((s) => s.images);
  const thumb = atlas.mapImageKey ? images[atlas.mapImageKey] : undefined;
  return (
    <article className="atlas-card relative bg-night-2 border border-line rounded-lg overflow-hidden hover:border-gold-dim transition-[border-color]">
      <Link className="block text-inherit no-underline" to={atlas.id}>
        <div className="h-[110px] flex items-center justify-center bg-ink text-slate text-[1.375rem] [&_img]:w-full [&_img]:h-full [&_img]:object-cover">
          {thumb ? <img src={thumb} alt={`Map of ${atlas.name}`} /> : <span aria-hidden="true">◇</span>}
        </div>
        <h2 className="atlas-card-name mx-3 mt-2.5 mb-0.5 text-[15px]">{atlas.name}</h2>
        <p className="atlas-card-counts mx-3 mb-3 font-mono text-xs text-parchment-dim">
          {atlas.regions.length} regions · {atlas.pins.length} pins
        </p>
      </Link>
      <button
        type="button"
        className={"atlas-card-delete absolute top-2 right-2 bg-[color-mix(in_srgb,var(--night)_85%,transparent)] border border-line rounded-lg text-parchment-dim px-2 py-0.5 text-xs cursor-pointer hover:text-[var(--ember)] hover:border-[var(--ember)]" + (confirm ? " armed text-[var(--ember)] border-[var(--ember)] bg-[color-mix(in_srgb,var(--ember)_20%,transparent)]" : "")}
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
    <div className="px-7 py-6 flex flex-col gap-[18px] overflow-y-auto h-full">
      <header className="flex items-center justify-between gap-3">
        <h1 className="m-0 text-[22px]">Atlas</h1>
        <Button onClick={() => setCreating(true)}>New atlas</Button>
      </header>
      {projectAtlases.length === 0 ? (
        <p className="text-parchment-dim text-[15px]">No saved atlases found. Create a new one first!</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3.5">
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
        <Modal title="New atlas" onClose={() => setCreating(false)}>
          <div className="flex flex-col gap-3.5 min-w-[260px]">
            <Field label="Name">
              <input
                type="text"
                aria-label="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={createOnEnter}
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button kind="ghost" onClick={() => setCreating(false)}>Cancel</Button>
              <Button onClick={create}>Create</Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
