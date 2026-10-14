import { useEffect, useState } from "react";
import type { Id, Pin, PinType, WorldEntry } from "../../../domain/types";
import { useScriptorium } from "../../../data/store";
import { ColorSwatches } from "./ColorSwatches";
import { LinkPicker } from "./LinkPicker";
import { PIN_TYPE_META } from "./pinTypes";
import "../atlas.css";

export interface PinPanelProps {
  pin: Pin;
  entries: WorldEntry[];
  onDelete(pinId: Id): void;
}

export function PinPanel({ pin, entries, onDelete }: PinPanelProps) {
  const [label, setLabel] = useState(pin.label);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Key on the id only: resetting on every label change would close the link
  // picker while typing.
  useEffect(() => {
    setLabel(pin.label);
    setPickerOpen(false);
  }, [pin.id]);

  const patch = (p: Partial<Omit<Pin, "id">>) => {
    useScriptorium.getState().updatePin(pin.id, p);
  };

  return (
    <div className="panel pin-panel">
      <div className="panel-title">Pino</div>
      <div className="field">
        <label className="field-label" htmlFor="pin-label-input">Rótulo</label>
        <input
          id="pin-label-input"
          aria-label="Rótulo do pino"
          type="text"
          value={label}
          onChange={(e) => {
            setLabel(e.target.value);
            patch({ label: e.target.value });
          }}
        />
      </div>
      <div className="field">
        <span className="field-label">Tipo</span>
        <div className="seg" role="group" aria-label="Tipo do pino">
          {(Object.keys(PIN_TYPE_META) as PinType[]).map((t) => (
            <button
              type="button"
              key={t}
              aria-pressed={pin.type === t}
              onClick={() => patch({ type: t })}
            >
              <span aria-hidden="true">{PIN_TYPE_META[t].icon}</span>
              {PIN_TYPE_META[t].label}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <span className="field-label">Cor</span>
        <ColorSwatches
          currentColor={pin.color}
          onPickColor={(color) => patch({ color })}
        />
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
            currentEntryId={pin.entryId}
            onPick={(entryId) => {
              patch({ entryId });
              setPickerOpen(false);
            }}
            onClear={() => patch({ entryId: undefined })}
          />
        ) : null}
      </div>
      <button
        type="button"
        className="btn-danger panel-delete"
        aria-label="Excluir pino"
        onClick={() => onDelete(pin.id)}
      >
        Excluir pino
      </button>
    </div>
  );
}