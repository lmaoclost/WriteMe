import { pushRecentColor, useRecentColors } from "./recentColors";

export const PIN_PALETTE = [
  "#e74c3c", "#c9a227", "#4d8f5f", "#4d6f8f", "#8f7fd0", "#2ecc71", "#a64b35", "#e8dcc3",
] as const;

export function ColorSwatches({ currentColor, onPickColor, recentLabel }: {
  currentColor: string;
  onPickColor(color: string): void;
  recentLabel?: string;
}) {
  const recent = useRecentColors();
  const swatch = (c: string) => (
    <button
      type="button"
      key={c}
      className={"swatch size-5 rounded-full border-2 border-transparent p-0 cursor-pointer" + (currentColor === c ? " current border-parchment" : "")}
      style={{ background: c }}
      aria-label={`Cor ${c}`}
      aria-pressed={currentColor === c}
      onClick={() => {
        pushRecentColor(c);
        onPickColor(c);
      }}
    />
  );
  return (
    <>
      <div className="swatch-row flex flex-wrap gap-1.5" role="group" aria-label="Colors">
        {PIN_PALETTE.map(swatch)}
      </div>
      {recent.length > 0 ? (
        <>
          <div className="swatch-caption text-[11px] text-slate">{recentLabel ?? "Recentes"}</div>
          <div className="swatch-row flex flex-wrap gap-1.5" role="group" aria-label="Recent colors">
            {recent.map(swatch)}
          </div>
        </>
      ) : null}
    </>
  );
}
