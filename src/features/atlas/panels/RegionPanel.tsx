import { useEffect, useState } from "react";
import type { Id, WorldEntry } from "../../../domain/types";
import type { Region } from "../../../domain/types";
import { useScriptorium } from "../../../data/store";
import { ColorSwatches } from "./ColorSwatches";
import { LinkPicker } from "./LinkPicker";
import { Field } from "../../../ui/Field";
import { Button } from "../../../ui/Button";

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
        `${count} ${count === 1 ? "area claimed" : "areas claimed"} — name it.`,
      );
    } else {
      s.pushToast("error", "No un-regioned area left in this State.");
    }
  };

  return (
    <div className="panel flex flex-col gap-3">
      <div className="text-xs tracking-[0.08em] uppercase text-slate">Region</div>
      <Field label="Label">
          <input
            id="region-label-input"
            aria-label="Region label"
            type="text"
            value={label}
            onChange={(e) => {
              setLabel(e.target.value);
              patch({ label: e.target.value });
            }}
          />
      </Field>
      <Field label="Color">
        <ColorSwatches
          currentColor={region.color}
          onPickColor={(color) => patch({ color })}
        />
      </Field>
      <Field label="Fill">
        <div className="flex items-center gap-2 [&_input[type=range]]:flex-1 [&_input[type=range]]:accent-[var(--gold)] [&_output]:font-mono [&_output]:text-xs [&_output]:text-parchment-dim [&_output]:min-w-[38px]">
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={region.fillOpacity}
            aria-label="Fill opacity"
            onChange={(e) => patch({ fillOpacity: Number(e.target.value) })}
          />
          <output data-testid="opacity-value">{Math.round(region.fillOpacity * 100)}%</output>
        </div>
      </Field>
      <Field label="Tome entry">
        <button
          type="button"
          aria-pressed={pickerOpen}
          onClick={() => setPickerOpen((open) => !open)}
          className="bg-none border border-line text-parchment rounded-lg px-2.5 py-1.5 text-[13px] hover:border-gold-dim aria-pressed:border-gold aria-pressed:text-gold"
        >
          Link entry
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
      </Field>
      <div className="text-xs text-parchment-dim">
        <span data-testid="vertex-count">Vertices: {region.points.length}</span>
      </div>
      <Field label="Claim area">
        <button type="button" onClick={claimRemaining} className="bg-none border border-line text-parchment rounded-lg px-2.5 py-1.5 text-[13px] hover:border-gold-dim self-start justify-self-start">Claim remaining area</button>
      </Field>
      <Button kind="danger" className="panel-delete self-start" onClick={() => (confirming ? onDelete(region.id) : setConfirming(true))}>
        {confirming ? "Confirm?" : "Delete region"}
      </Button>
    </div>
  );
}
