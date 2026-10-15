import type { WorldEntry } from "../../domain/types";

export interface ImagePickerProps {
  images: Record<string, string>;
  entries: WorldEntry[];
  onPick(dataUrl: string): void;
}

export function ImagePicker({ images, entries, onPick }: ImagePickerProps) {
  return (
    <div className="codex-imagelist" role="group" aria-label="Entry images">
      {entries.length === 0 ? (
        <p className="codex-picker-empty">Nenhuma imagem no códex.</p>
      ) : (
        <ul className="codex-thumbgrid">
          {entries.map((entry) => (
            <li key={entry.id}>
              <button type="button" onClick={() => onPick(images[entry.imageKey as string])}>
                <img src={images[entry.imageKey as string]} alt="" />
                <span>{entry.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
