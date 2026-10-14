import { useEffect } from "react";
import { useScriptorium } from "../../data/store";
import type { Id, WorldEntry } from "../../domain/types";
import "./atlas.css";

export interface EntryImagePickerProps {
  atlasId: Id;
  entries: WorldEntry[];
  images: Record<string, string>;
  onClose(): void;
}

/** Popover listing the project entries that carry their own image; picking
 *  one copies that blob into the atlas map (decoupled from the entry). */
export function EntryImagePicker({ atlasId, entries, images, onClose }: EntryImagePickerProps) {
  const candidates = entries.filter((e) => e.imageKey && images[e.imageKey]);
  const pushToast = useScriptorium((s) => s.pushToast);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const apply = (entryId: Id) => {
    const ok = useScriptorium.getState().setAtlasMapFromEntry(atlasId, entryId);
    if (ok) pushToast("success", "Mapa vinculado ao codex.");
    else pushToast("error", "Não foi possível vincular a imagem.");
    onClose();
  };

  return (
    <>
      <div className="chooser-backdrop" onPointerDown={onClose} aria-hidden="true" />
      <div className="entry-image-picker" role="dialog" aria-label="Imagem do códex">
        {candidates.length === 0 ? (
          <p className="entry-picker-empty">Nenhuma entrada com imagem.</p>
        ) : (
          <ul className="entry-picker-grid">
            {candidates.map((e) => (
              <li key={e.id}>
                <button type="button" onClick={() => apply(e.id)}>
                  <img src={images[e.imageKey!]} alt="" />
                  <span className="entry-picker-title">{e.title}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
