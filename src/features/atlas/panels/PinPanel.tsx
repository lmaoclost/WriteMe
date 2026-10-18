import { useEffect, useState } from "react";
import type { Id, Pin, PinType, WorldEntry } from "../../../domain/types";
import { useScriptorium } from "../../../data/store";
import { ColorSwatches } from "./ColorSwatches";
import { LinkPicker } from "./LinkPicker";
import { PIN_TYPE_META } from "./pinTypes";
import { Field } from "../../../ui/Field";
import { Button } from "../../../ui/Button";

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
    <div className="panel flex flex-col gap-3">
      <div className="panel-title text-xs tracking-[0.08em] uppercase text-slate">Pin</div>
     <Field label="Label">
        <input
          id="pin-label-input"
          aria-label="Pin label"
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => { if (label !== pin.label) patch({ label }); }}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        />
      </Field>
      <Field label="Type">
        <div className="seg grid grid-cols-4 gap-1" role="group" aria-label="Pin type">
          {(Object.keys(PIN_TYPE_META) as PinType[]).map((t) => (
            <button
              type="button"
              key={t}
              aria-pressed={pin.type === t}
              onClick={() => patch({ type: t })}
              className="bg-none border border-line text-parchment rounded-lg py-1 px-0.5 text-xs whitespace-nowrap hover:border-gold-dim aria-pressed:border-gold aria-pressed:text-gold"
            >
              <span aria-hidden="true">{PIN_TYPE_META[t].icon}</span>
              {PIN_TYPE_META[t].label}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Color">
        <ColorSwatches
          currentColor={pin.color}
          onPickColor={(color) => patch({ color })}
        />
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
            currentEntryId={pin.entryId}
            onPick={(entryId) => {
              patch({ entryId });
              setPickerOpen(false);
            }}
            onClear={() => patch({ entryId: undefined })}
          />
        ) : null}
      </Field>
      <Button kind="danger" className="panel-delete self-start" aria-label="Delete pin" onClick={() => onDelete(pin.id)}>
        Excluir pino
      </Button>
    </div>
  );
}
