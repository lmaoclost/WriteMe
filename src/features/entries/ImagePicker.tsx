import type { WorldEntry } from "../../domain/types";

export interface ImagePickerProps {
  images: Record<string, string>;
  entries: WorldEntry[];
  onPick(dataUrl: string): void;
}

export function ImagePicker({ images, entries, onPick }: ImagePickerProps) {
  return (
    <div className="relative z-30 bg-ink border border-line rounded-lg p-2" role="group" aria-label="Entry images">
      {entries.length === 0 ? (
        <p className="m-1 text-parchment-dim text-[13px]">Nenhuma imagem no códex.</p>
      ) : (
        <ul className="list-none m-0 p-0 grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2">
          {entries.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => onPick(images[entry.imageKey as string])}
                className="flex flex-col items-stretch gap-1 bg-night-2 border border-line rounded-lg p-1.5 text-parchment-dim text-xs cursor-pointer hover:border-gold-dim hover:text-gold"
              >
                <img src={images[entry.imageKey as string]} alt="" className="w-full h-16 object-cover rounded-lg" />
                <span className="overflow-hidden text-ellipsis whitespace-nowrap">{entry.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
