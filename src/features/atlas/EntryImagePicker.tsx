import { useEffect } from "react";
import { useScriptorium } from "../../data/store";
import type { Id, WorldEntry } from "../../domain/types";

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
    else pushToast("error", "Couldn't link the image.");
    onClose();
  };

  return (
    <>
      <div className="chooser-backdrop fixed inset-0 z-29 bg-transparent" onPointerDown={onClose} aria-hidden="true" />
      <div className="fixed top-[52px] right-3 z-30 w-[340px] max-h-[70vh] overflow-y-auto p-2.5 bg-night-2 border border-line rounded-lg" role="dialog" aria-label="Entry image">
        {candidates.length === 0 ? (
          <p className="m-0 text-parchment-dim text-[13px]">Nenhuma entrada com imagem.</p>
        ) : (
          <ul className="list-none m-0 p-0 grid grid-cols-2 gap-2">
            {candidates.map((e) => (
              <li key={e.id}>
                <button type="button" onClick={() => apply(e.id)} className="flex flex-col gap-1 w-full bg-none border border-line rounded-lg p-1.5 text-parchment hover:border-gold-dim">
                  <img src={images[e.imageKey!]} alt="" className="max-h-16 w-full object-cover" />
                  <span className="entry-picker-title text-xs overflow-hidden text-ellipsis whitespace-nowrap">{e.title}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
