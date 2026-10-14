import { pushRecentColor, useRecentColors } from "./recentColors";
import "../atlas.css";

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
      className={"swatch" + (currentColor === c ? " current" : "")}
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
      <div className="swatch-row" role="group" aria-label="Cores">
        {PIN_PALETTE.map(swatch)}
      </div>
      {recent.length > 0 ? (
        <>
          <div className="swatch-caption">{recentLabel ?? "Recentes"}</div>
          <div className="swatch-row" role="group" aria-label="Cores recentes">
            {recent.map(swatch)}
          </div>
        </>
      ) : null}
    </>
  );
}
