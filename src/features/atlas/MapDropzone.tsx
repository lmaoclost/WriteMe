import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { fileToDataUrl } from "../../data/image";
import { useScriptorium, type ToastKind } from "../../data/store";

export type PushToast = (kind: ToastKind, message: string) => void;

/** Shared pipeline for the dropzone and the "Substituir mapa" header flow. */
export async function loadMapIntoAtlas(atlasId: string, file: File, pushToast: PushToast): Promise<void> {
  try {
    const { dataUrl } = await fileToDataUrl(file);
    const ok = useScriptorium.getState().putMapImage(atlasId, dataUrl);
    if (ok) pushToast("success", "Mapa carregado.");
    else pushToast("error", "Upload failed. Please try again.");
  } catch {
    pushToast("error", "Upload failed. Please try again.");
  }
}

/** Full-stage overlay for an atlas without a map: drag&drop or click → file
 *  input → fileToDataUrl → putMapImage. */
export function MapDropzone({ atlasId }: { atlasId: string }) {
  const pushToast = useScriptorium((s) => s.pushToast);
  const inputRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  const [over, setOver] = useState(false);

  const loadFile = (file: File) => {
    if (busyRef.current) return;
    busyRef.current = true;
    void loadMapIntoAtlas(atlasId, file, pushToast).finally(() => {
      busyRef.current = false;
    });
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) loadFile(file);
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setOver(true);
  };

  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
    e.target.value = "";
  };

  return (
    <div
      className={"map-dropzone group absolute inset-0 z-10 flex flex-col items-center justify-center gap-2.5 p-6 bg-[color-mix(in_srgb,var(--ink)_82%,transparent)] border-2 border-dashed border-line text-center cursor-pointer" + (over ? " drag-over border-gold bg-[color-mix(in_srgb,var(--gold)_8%,var(--ink))]" : "")}
      onClick={() => inputRef.current?.click()}
      onDragOver={onDragOver}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
    >
      <p className="m-0 text-parchment-dim text-[15px] group-[.drag-over]:text-gold">Arraste um mapa…</p>
      <p className="m-0 text-slate text-[13px]">ou clique para escolher o arquivo.</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label="Arquivo do mapa"
        onChange={pick}
      />
    </div>
  );
}
