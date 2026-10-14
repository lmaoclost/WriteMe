import { useEffect, useState } from "react";
import type { Id, WorldEntry } from "../../../domain/types";
import type { Region } from "../../../domain/types";
import { useScriptorium } from "../../../data/store";
import { ColorSwatches } from "./ColorSwatches";
import { LinkPicker } from "./LinkPicker";
import "../atlas.css";

export interface RegionPanelProps {
  atlasId: Id;
  region: Region;
  entries: WorldEntry[];
  onDelete(regionId: Id): void;
}

export function RegionPanel({ atlasId, region, entries, onDelete }: RegionPanelProps) {
  const [label, setLabel] = useState(region.label);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  // Key on the id only: resetting on every label change would close the link
  // picker and disarm the delete confirm while typing.
  useEffect(() => {
    setLabel(region.label);
    setPickerOpen(false);
    setConfirming(false);
  }, [region.id]);

  const patch = (p: Partial<Omit<Region, "id">>) => {
    useScriptorium.getState().updateRegion(region.id, p);
  };

  const claimRemaining = () => {
    const s = useScriptorium.getState();
    const count = s.claimRemainingArea(atlasId, region.id);
    if (count > 0) {
      s.pushToast(
        "success",
        `${count} ${count === 1 ? "área reivindicada" : "áreas reivindicadas"} — nomeie.`,
      );
    } else {
      s.pushToast("error", "Não há área restante a reivindicar.");
    }
  };

  return (
    <div className="panel region-panel">
      <div className="panel-title">Região</div>
      <div className="field">
        <label className="field-label" htmlFor="region-label-input">Rótulo</label>
        <input
          id="region-label-input"
          aria-label="Rótulo da região"
          type="text"
          value={label}
          onChange={(e) => {
            setLabel(e.target.value);
            patch({ label: e.target.value });
          }}
        />
      </div>
      <div className="field">
        <span className="field-label">Cor</span>
        <ColorSwatches
          currentColor={region.color}
          onPickColor={(color) => patch({ color })}
        />
      </div>
      <div className="field">
        <span className="field-label">Preenchimento</span>
        <div className="range-row">
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={region.fillOpacity}
            aria-label="Opacidade do preenchimento"
            onChange={(e) => patch({ fillOpacity: Number(e.target.value) })}
          />
          <output data-testid="opacity-value">{Math.round(region.fillOpacity * 100)}%</output>
        </div>
      </div>
      <div className="field">
        <span className="field-label">Vínculo</span>
        <button
          type="button"
          aria-pressed={pickerOpen}
          onClick={() => setPickerOpen((open) => !open)}
        >
          Vincular entrada
        </button>
        {pickerOpen ? (
          <LinkPicker
            entries={entries}
            currentEntryId={region.entryId}
            onPick={(entryId) => {
              patch({ entryId });
              setPickerOpen(false);
            }}
            onClear={() => patch({ entryId: undefined })}
          />
        ) : null}
      </div>
      <div className="panel-meta">
        <span data-testid="vertex-count">Vértices: {region.points.length}</span>
      </div>
      <div className="field">
        <button type="button" onClick={claimRemaining}>Reivindicar área restante</button>
      </div>
      <button
        type="button"
        className="btn-danger panel-delete"
        onClick={() => (confirming ? onDelete(region.id) : setConfirming(true))}
      >
        {confirming ? "Confirmar?" : "Excluir região"}
      </button>
    </div>
  );
}