import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Id, Pin, PinType, Region, WorldEntry } from "../../../domain/types";
import { useWriteme } from "../../../data/store";
import { ColorSwatches } from "./ColorSwatches";
import { LinkPicker } from "./LinkPicker";
import { PIN_TYPE_META } from "./pinTypes";
import { Field } from "../../../ui/Field";
import { Button } from "../../../ui/Button";

export interface PinPanelProps {
  pin: Pin;
  entries: WorldEntry[];
  /** Region under the pin, when there is one — lets the user reach it. */
  containingRegion?: Region | null;
  onSelectContainingRegion?(): void;
  onDelete(pinId: Id): void;
}

export function PinPanel({ pin, entries, containingRegion, onSelectContainingRegion, onDelete }: PinPanelProps) {
  const { t } = useTranslation();
  const [label, setLabel] = useState(pin.label);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Key on the id only: resetting on every label change would close the link
  // picker while typing.
  useEffect(() => {
    setLabel(pin.label);
    setPickerOpen(false);
  }, [pin.id]);

  const patch = (p: Partial<Omit<Pin, "id">>) => {
    useWriteme.getState().updatePin(pin.id, p);
  };

  return (
    <div className="panel flex flex-col gap-3">
      <div className="panel-title text-xs tracking-[0.08em] uppercase text-slate">{t("atlas.pin.title")}</div>
     <Field label={t("atlas.pin.label")}>
        <input
          id="pin-label-input"
          aria-label={t("atlas.pin.pinLabel")}
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => { if (label !== pin.label) patch({ label }); }}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        />
      </Field>
      <Field label={t("atlas.pin.type")}>
        <div className="seg grid grid-cols-4 gap-1" role="group" aria-label={t("atlas.pin.pinType")}>
          {(Object.keys(PIN_TYPE_META) as PinType[]).map((type) => (
            <button
              type="button"
              key={type}
              aria-pressed={pin.type === type}
              onClick={() => patch({ type })}
              className="bg-none border border-line text-parchment rounded-lg py-1 px-0.5 text-xs whitespace-nowrap hover:border-gold-dim aria-pressed:border-gold aria-pressed:text-gold"
            >
              <span aria-hidden="true">{PIN_TYPE_META[type].icon}</span>
              {t(PIN_TYPE_META[type].labelKey)}
            </button>
          ))}
        </div>
      </Field>
      <Field label={t("atlas.pin.color")}>
        <ColorSwatches
          currentColor={pin.color}
          onPickColor={(color) => patch({ color })}
        />
      </Field>
      <Field label={t("atlas.pin.tomeEntry")}>
        <button
          type="button"
          aria-pressed={pickerOpen}
          onClick={() => setPickerOpen((open) => !open)}
          className="bg-none border border-line text-parchment rounded-lg px-2.5 py-1.5 text-[13px] hover:border-gold-dim aria-pressed:border-gold aria-pressed:text-gold"
        >
          {t("atlas.pin.linkEntry")}
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
      {containingRegion && onSelectContainingRegion ? (
        <div className="grid gap-1">
          <button
            type="button"
            className="bg-none border border-line text-parchment rounded-lg px-2.5 py-1.5 text-[13px] hover:border-gold-dim"
            onClick={onSelectContainingRegion}
          >
            {t("atlas.pin.selectRegion")}
          </button>
          <span className="text-[11px] text-parchment-dim truncate">{containingRegion.label}</span>
        </div>
      ) : null}
      <Button kind="danger" className="panel-delete self-start" aria-label={t("atlas.pin.delete")} onClick={() => onDelete(pin.id)}>
        {t("atlas.pin.delete")}
      </Button>
    </div>
  );
}
