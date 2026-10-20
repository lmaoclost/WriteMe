import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import { useScriptorium } from "../../data/store";
import { useDebouncedDraft } from "../../ui/useDebouncedDraft";
import { fileToDataUrl } from "../../data/image";
import type { Bloodline, BloodlineHouse, BloodlinePerson, BloodlineTenure } from "../../domain/types";
import { Field } from "../../ui/Field";
import { Button } from "../../ui/Button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BOARD_PANEL, BOARD_PANEL_HINT, BOARD_PANEL_HEAD, BOARD_PANEL_HEAD_H2 } from "../../ui/board";
import { LinkPicker } from "../atlas/panels/LinkPicker";

const TENURE_LABELS = ["Reigned", "Served", "Tenure", "Ruled", "Governed", "Appointed"];

export function BloodlinePanel({ bloodline, selectedId, onSelect }: {
  bloodline: Bloodline;
  selectedId: string | null;
  onSelect(id: string | null): void;
}) {
  const { t } = useTranslation();
  const person = bloodline.persons.find((p) => p.id === selectedId);
  const house = bloodline.houses.find((h) => h.id === selectedId);
  if (!person && !house) {
    return (
      <aside className={BOARD_PANEL}>
        <p className={BOARD_PANEL_HINT}>{t("bloodline.panel.selectHint")}</p>
      </aside>
    );
  }
  return (
    <aside className={BOARD_PANEL} data-testid="bl-panel">
      {person ? <PersonPanel bloodline={bloodline} person={person} onSelect={onSelect} /> : null}
      {house ? <HousePanel bloodline={bloodline} house={house} onSelect={onSelect} /> : null}
    </aside>
  );
}

function PersonField({ label, value, onCommit, placeholder }: { label: string; value: string; onCommit(v: string): void; placeholder?: string }) {
  const { draft, setDraft, flush } = useDebouncedDraft(value, onCommit);
  useEffect(() => () => flush(), [flush]);
  return (
    <Field label={label}>
      <input value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => flush()} aria-label={label} placeholder={placeholder} />
    </Field>
  );
}

function PersonFieldArea({ label, value, onCommit, placeholder, rows = 3 }: { label: string; value: string; onCommit(v: string): void; placeholder?: string; rows?: number }) {
  const { draft, setDraft, flush } = useDebouncedDraft(value, onCommit);
  useEffect(() => () => flush(), [flush]);
  return (
    <Field label={label}>
      <textarea value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => flush()} aria-label={label} placeholder={placeholder} rows={rows} />
    </Field>
  );
}

function LoosePersonField({ label, value, onCommit, placeholder }: { label: string; value: string; onCommit(v: string): void; placeholder?: string }) {
  const { draft, setDraft, flush } = useDebouncedDraft(value, onCommit);
  useEffect(() => () => flush(), [flush]);
  return (
    <input value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => flush()} aria-label={label} placeholder={placeholder} className="flex-1 min-w-0 bg-ink border border-line rounded-sm text-parchment px-2 py-1.5" />
  );
}

function PersonPanel({ bloodline, person, onSelect }: {
  bloodline: Bloodline;
  person: BloodlinePerson;
  onSelect(id: string | null): void;
}) {
  const store = useScriptorium.getState;
  const { t } = useTranslation();
  const pushToast = useScriptorium((s) => s.pushToast);
  const [armDelete, setArmDelete] = useState(false);
  const [portraitUploading, setPortraitUploading] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [entryPickerOpen, setEntryPickerOpen] = useState(false);
  const update = (patch: Partial<BloodlinePerson>) => store().updatePerson(person.id, patch);
  const projectEntries = useScriptorium(
    useShallow((s) => s.entries.filter((e) => e.projectId === bloodline.projectId)),
  );
  const linkedEntry = person.entryId ? projectEntries.find((e) => e.id === person.entryId) : undefined;
  const linkedImageKey = linkedEntry?.imageKey;

  const onPortrait = async (file: File) => {
    setPortraitUploading(true);
    try {
      const { dataUrl } = await fileToDataUrl(file);
      const key = store().putImage(dataUrl, "person");
      update({ portraitKey: key });
      pushToast("success", t("bloodline.panel.portraitUpdated"));
    } catch {
      pushToast("error", t("bloodline.panel.portraitError"));
    } finally {
      setPortraitUploading(false);
    }
  };

  const removePerson = () => {
    if (!armDelete) { setArmDelete(true); return; }
    store().deletePerson(person.id);
    pushToast("success", t("bloodline.panel.personRemoved"));
    onSelect(null);
  };

  const candidates = bloodline.persons;

  return (
    <div className="grid grid-cols-1 gap-3">
      <header className={BOARD_PANEL_HEAD}>
        <h2 className={BOARD_PANEL_HEAD_H2}>{person.name || t("bloodline.panel.unnamed")}</h2>
        <Button kind={armDelete ? "danger" : "ghost"} className="px-2 py-1 text-xs whitespace-nowrap" onClick={removePerson}
          aria-label={armDelete ? t("bloodline.panel.confirmDeletePerson") : t("bloodline.panel.deletePerson")}>
          {armDelete ? t("common.confirm") : t("common.delete")}
        </Button>
      </header>
      <Field label={t("bloodline.panel.portrait")}>
        <div className="flex items-center gap-2">
          {person.portraitKey || linkedImageKey ? (
            <PortraitThumb personId={person.id} fallbackKey={linkedImageKey} />
          ) : (
            <span className="portrait-none text-slate text-[13px]">{t("bloodline.panel.noPortrait")}</span>
          )}
          <label className="upload-label rounded-sm border border-line py-1 px-2.5 text-parchment-dim cursor-pointer hover:text-parchment hover:border-gold-dim">
            {portraitUploading ? "…" : t("bloodline.panel.upload")}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              aria-label={t("bloodline.panel.uploadPortrait")}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void onPortrait(f); e.target.value = ""; }}
            />
          </label>
          {person.portraitKey ? (
            <Button kind="ghost" className="px-1.5 py-0.5 text-xs" aria-label={t("bloodline.panel.removePortrait")} onClick={() => {
              const key = person.portraitKey!;
              update({ portraitKey: undefined });
              store().removeImage(key);
            }}>✕</Button>
          ) : null}
        </div>
      </Field>
      <Field label={t("bloodline.panel.acervoEntry")}>
        <div className="grid gap-1.5">
          {linkedEntry ? (
            <div className="flex items-center gap-2 min-w-0">
              <span className="min-w-0 flex-1 truncate text-[13px] text-parchment">{linkedEntry.title}</span>
              <button
                type="button"
                className="shrink-0 bg-none border-0 text-xs text-slate hover:text-[var(--ember)]"
                aria-label={t("bloodline.panel.unlinkEntry", { title: linkedEntry.title })}
                onClick={() => update({ entryId: undefined })}
              >✕</button>
            </div>
          ) : null}
          <button
            type="button"
            aria-pressed={entryPickerOpen}
            className="justify-self-start bg-none border border-line text-parchment rounded-lg px-2.5 py-1.5 text-[13px] hover:border-gold-dim aria-pressed:border-gold aria-pressed:text-gold"
            onClick={() => setEntryPickerOpen((open) => !open)}
          >
            {linkedEntry ? t("bloodline.panel.changeEntry") : t("bloodline.panel.linkEntry")}
          </button>
          {entryPickerOpen ? (
            <LinkPicker
              entries={projectEntries}
              currentEntryId={person.entryId}
              onPick={(entryId) => {
                update({ entryId });
                setEntryPickerOpen(false);
              }}
              onClear={() => {
                update({ entryId: undefined });
                setEntryPickerOpen(false);
              }}
            />
          ) : null}
        </div>
      </Field>
      <PersonField label={t("bloodline.panel.name")} placeholder={t("bloodline.panel.namePlaceholder")} value={person.name} onCommit={(v) => { const name = v.trim(); if (name) update({ name }); }} />
      <PersonField label={t("bloodline.panel.suffix")} placeholder={t("bloodline.panel.suffixPlaceholder")} value={person.suffix ?? ""} onCommit={(v) => update({ suffix: v.trim() || undefined })} />
      <Field label={t("bloodline.panel.house")}>
        <Select value={person.houseId ?? ""} onValueChange={(v) => update({ houseId: v || undefined })}>
          <SelectTrigger aria-label={t("bloodline.panel.house")} className="w-full justify-between rounded-sm border-line bg-ink px-2 py-1.5 text-xs text-parchment hover:border-gold-dim data-[size=default]:h-auto"><SelectValue placeholder={t("bloodline.panel.withoutHouse")} /></SelectTrigger>
          <SelectContent className="border-line bg-night text-parchment">
            {bloodline.houses.map((h) => <SelectItem key={h.id} value={h.id} className="text-xs focus:bg-[#24233f] focus:text-parchment" data-testid="house-option">{h.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <PersonField label={t("bloodline.panel.title")} placeholder={t("bloodline.panel.titlePlaceholder")} value={person.title ?? ""} onCommit={(v) => update({ title: v })} />
      <PersonField label={t("bloodline.panel.relationship")} placeholder={t("bloodline.panel.relationshipPlaceholder")} value={person.relationship ?? ""} onCommit={(v) => update({ relationship: v })} />
      <PersonFieldArea label={t("bloodline.panel.bio")} placeholder={t("bloodline.panel.bioPlaceholder")} rows={3} value={person.bio ?? ""} onCommit={(v) => update({ bio: v })} />
      <PersonField label={t("bloodline.panel.birthDate")} placeholder={t("bloodline.panel.birthDatePlaceholder")} value={person.birthDate ?? ""} onCommit={(v) => update({ birthDate: v.trim() || undefined })} />
      <PersonField label={t("bloodline.panel.deathDate")} placeholder={t("bloodline.panel.deathDatePlaceholder")} value={person.deathDate ?? ""} onCommit={(v) => update({ deathDate: v.trim() || undefined })} />

      <section className="border-t border-line mt-3.5 pt-2.5 grid grid-cols-1 gap-2">
        <h3>{t("bloodline.panel.additionalTitles")}</h3>
        <ul className="titles-list list-none m-0 p-0 grid gap-1 [&_li]:flex [&_li]:justify-between [&_li]:items-center [&_li]:gap-2 [&_li]:text-[13px] [&_li]:text-parchment-dim [&_button]:bg-none [&_button]:border-0 [&_button]:text-slate [&_button]:text-xs">
          {person.additionalTitles.map((t2, i) => (
            <li key={i}>
              {t2.title}
              <button type="button" aria-label={t("bloodline.panel.removeTitle", { title: t2.title })}
                onClick={() => update({ additionalTitles: person.additionalTitles.filter((_, j) => j !== i) })}>✕</button>
            </li>
          ))}
        </ul>
        <div className="flex gap-1.5">
          <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} aria-label={t("bloodline.panel.newTitle")} placeholder={t("bloodline.panel.newTitle")} className="flex-1 min-w-0 bg-ink border border-line rounded-sm text-parchment px-2 py-1.5" />
          <Button kind="ghost" className="shrink-0 px-2 py-1 text-xs" aria-label={t("bloodline.panel.addTitle")} onClick={() => {
            const next = newTitle.trim();
            if (!next) return;
            update({ additionalTitles: [...person.additionalTitles, { title: next }] });
            setNewTitle("");
          }}>+</Button>
        </div>
      </section>

      <section className="border-t border-line mt-3.5 pt-2.5 grid grid-cols-1 gap-2">
        <h3>{t("bloodline.panel.tenures")}</h3>
        <ul className="list-none m-0 p-0 grid gap-1.5">
          {person.tenures.map((tenure, i) => (
            <li key={i} className="tenure-row grid grid-cols-[1.2fr_1fr_1fr_auto] gap-1.5 items-center [&>*]:min-w-0 [&_button]:text-slate [&_button]:text-xs [&_input]:bg-ink [&_input]:border [&_input]:border-line [&_input]:rounded-sm [&_input]:text-parchment [&_input]:px-1.5 [&_input]:py-1 [&_input]:text-xs [&_input]:w-full">
              <Select value={tenure.label} onValueChange={(v) => update({ tenures: person.tenures.map((tt, j) => (j === i ? { ...tt, label: v } : tt)) })}>
                <SelectTrigger aria-label={t("bloodline.panel.tenureLabel")} className="w-full justify-between rounded-sm border-line bg-ink px-1.5 py-1 text-xs text-parchment hover:border-gold-dim data-[size=default]:h-auto"><SelectValue /></SelectTrigger>
                <SelectContent className="border-line bg-night text-parchment">
                  {TENURE_LABELS.map((l) => <SelectItem key={l} value={l} className="text-xs focus:bg-[#24233f] focus:text-parchment">{l}</SelectItem>)}
                </SelectContent>
              </Select>
              <LoosePersonField label={t("bloodline.panel.start")} value={tenure.from} placeholder={t("bloodline.panel.from")} onCommit={(v) => update({ tenures: person.tenures.map((tt, j) => (j === i ? { ...tt, from: v } : tt)) })} />
              <LoosePersonField label={t("bloodline.panel.end")} value={tenure.to} placeholder={t("bloodline.panel.to")} onCommit={(v) => update({ tenures: person.tenures.map((tt, j) => (j === i ? { ...tt, to: v } : tt)) })} />
              <button type="button" aria-label={t("bloodline.panel.removeTenure")} onClick={() => update({ tenures: person.tenures.filter((_, j) => j !== i) })} className="bg-none border-0 text-slate text-xs">✕</button>
            </li>
          ))}
        </ul>
        <Button kind="ghost" className="justify-self-start px-2 py-1 text-xs" aria-label={t("bloodline.panel.addTenure")} onClick={() => {
          const tenure: BloodlineTenure = { label: TENURE_LABELS[0], from: "", to: "" };
          update({ tenures: [...person.tenures, tenure] });
        }}>+ {t("bloodline.panel.addTenure")}</Button>
      </section>

      <section className="border-t border-line mt-3.5 pt-2.5 grid grid-cols-1 gap-2">
        <h3>{t("bloodline.panel.bloodBonds")}</h3>
        <ConnectionPicker
          label={t("bloodline.panel.bloodBondParent")}
          persons={candidates.filter((c) => c.id !== person.id)}
          currentId={person.connectedTo}
          onPick={(id) => update({ connectedTo: id })}
          onClear={() => update({ connectedTo: undefined })}
        />
        <ConnectionPicker
          label={t("bloodline.panel.partner")}
          persons={candidates.filter((c) => c.id !== person.id)}
          currentId={person.partnerId}
          onPick={(id) => {
            update({ partnerId: id });
            const partner = candidates.find((c) => c.id === id);
            if (partner?.partnerId && partner.partnerId !== person.id) {
              store().updatePerson(partner.id, { partnerId: person.id });
            }
          }}
          onClear={() => {
            if (person.partnerId) {
              const partner = candidates.find((c) => c.id === person.partnerId);
              if (partner && partner.partnerId === person.id) {
                store().updatePerson(partner.id, { partnerId: undefined });
              }
            }
            update({ partnerId: undefined });
          }}
        />
        <div className="grid grid-cols-2 gap-2 [&>*]:min-w-0">
          <ConnectionPicker
            label={t("bloodline.panel.siblingCousin")}
            persons={candidates.filter((c) => c.id !== person.id)}
            currentId={person.siblingId}
            onPick={(id) => update({ siblingId: id })}
            onClear={() => update({ siblingId: undefined })}
          />
          <Field label={t("bloodline.panel.birthOrder")}>
            <input
              type="number"
              aria-label={t("bloodline.panel.birthOrder")}
              value={person.birthOrder ?? ""}
              onChange={(e) => update({ birthOrder: e.target.value === "" ? undefined : Number(e.target.value) })}
          />
          </Field>
        </div>
      </section>

      <section className="border-t border-line mt-3.5 pt-2.5 grid grid-cols-1 gap-2">
        <h3>{t("bloodline.panel.badge")}</h3>
        <label className="flex gap-2 items-center text-[13px] text-parchment-dim">
          <input type="checkbox" checked={person.showBadge} onChange={(e) => update({ showBadge: e.target.checked, ...(e.target.checked ? {} : { badgeText: person.badgeText }) })} />
          <span>{t("bloodline.panel.showBadge")}</span>
        </label>
        <PersonField label={t("bloodline.panel.badgeText")} value={person.badgeText ?? ""} onCommit={(v) => update({ badgeText: v })} placeholder={t("bloodline.panel.badgeTextPlaceholder")} />
      </section>
    </div>
  );
}

function PortraitThumb({ personId, fallbackKey }: { personId: string; fallbackKey?: string }) {
  const images = useScriptorium((s) => s.images);
  const person = useScriptorium((s) => s.bloodlines.flatMap((b) => b.persons).find((p) => p.id === personId));
  const key = person?.portraitKey ?? fallbackKey;
  const src = key ? images[key] : undefined;
  if (!src) return null;
  return <img className="portrait-thumb size-10 rounded-full object-cover" src={src} alt="" />;
}

function ConnectionPicker({ label, persons, currentId, onPick, onClear }: {
  label: string;
  persons: BloodlinePerson[];
  currentId?: string;
  onPick(id: string): void;
  onClear(): void;
}) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const boxRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onPointerDown = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown, { capture: true });
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown, { capture: true });
    };
  }, [open]);
  const current = useMemo(() => persons.find((p) => p.id === currentId), [persons, currentId]);
  const q = query.trim().toLocaleLowerCase(i18n.language);
  const matches = persons.filter((p) => p.name.toLocaleLowerCase(i18n.language).includes(q)).slice(0, 8);
  return (
    <div ref={boxRef} className="relative flex flex-col gap-1.5 connection-picker">
      <span className="field-label text-xs font-semibold uppercase tracking-[0.08em] text-slate">{label}</span>
      <div className="flex items-center gap-2">
        {current ? (
          <span className="connection-name min-w-0 truncate text-[13px] text-parchment">{current.name}</span>
        ) : (
          <span className="connection-name text-slate text-[13px]">—</span>
        )}
        <button type="button" aria-label={t("bloodline.connection.pick", { label })} onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }} className="shrink-0 bg-ink border border-line text-slate rounded-sm px-2 py-0.5 text-xs">v</button>
        {current ? <button type="button" aria-label={t("bloodline.connection.remove", { label })} onClick={onClear} className="shrink-0 bg-ink border border-line text-slate rounded-sm px-1.5 py-0.5 text-xs">✕</button> : null}
      </div>
      {open ? (
        <div className="connection-pop absolute top-full left-0 mt-1 z-50 max-h-[240px] overflow-y-auto bg-night-2 border border-line rounded-lg p-2 w-60" onClick={(e) => e.stopPropagation()}>
          <input value={query} onChange={(e) => setQuery(e.target.value)} aria-label={t("bloodline.connection.searchPersons")} placeholder={t("bloodline.connection.searchPlaceholder")} className="w-full bg-ink border border-line text-parchment rounded-sm px-2 py-1 mb-1.5" />
          <ul className="link-list list-none m-0 p-0 grid gap-0.5 [&_button]:block [&_button]:w-full [&_button]:text-left [&_button]:bg-none [&_button]:border-0 [&_button]:text-parchment-dim [&_button]:text-[13px] [&_button]:py-1 [&_button]:px-1.5 [&_button]:rounded-sm hover:[&_button]:bg-accent">
            {matches.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => { onPick(p.id); setOpen(false); }}>{p.name}</button>
              </li>
            ))}
            {matches.length === 0 ? <li><span className="text-slate">{t("bloodline.connection.noMatches")}</span></li> : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function HousePanel({ bloodline, house, onSelect }: {
  bloodline: Bloodline;
  house: BloodlineHouse;
  onSelect(id: string | null): void;
}) {
  const store = useScriptorium.getState;
  const { t } = useTranslation();
  const pushToast = useScriptorium((s) => s.pushToast);
  const [armDelete, setArmDelete] = useState(false);
  const update = (patch: Partial<BloodlineHouse>) => store().updateHouse(house.id, patch);
  const removeHouse = () => {
    if (!armDelete) { setArmDelete(true); return; }
    store().deleteHouse(house.id);
    pushToast("success", t("bloodline.panel.houseRemoved"));
    onSelect(null);
  };
  const members = bloodline.persons.filter((p) => p.houseId === house.id);
  return (
    <div className="grid grid-cols-1 gap-3">
      <header className={BOARD_PANEL_HEAD}>
        <h2 className={BOARD_PANEL_HEAD_H2}>{house.name}</h2>
        <Button kind={armDelete ? "danger" : "ghost"} className="px-2 py-1 text-xs" onClick={removeHouse}
          aria-label={armDelete ? t("bloodline.panel.confirmDeleteHouse") : t("bloodline.panel.deleteHouse")}>
          {armDelete ? t("common.confirm") : t("common.delete")}
        </Button>
      </header>
      <Field label={t("bloodline.panel.name")}>
        <input value={house.name} onChange={(e) => update({ name: e.target.value })} aria-label={t("bloodline.panel.houseName")} />
      </Field>
      <PersonField label={t("bloodline.panel.subtitle")} value={house.subtitle ?? ""} onCommit={(v) => update({ subtitle: v.trim() || undefined })} />
      <label className="flex gap-2 items-center text-[13px] text-parchment-dim">
        <input type="checkbox" checked={house.isMainBranch} onChange={(e) => update({ isMainBranch: e.target.checked })} />
        <span>{t("bloodline.panel.mainBranch")}</span>
      </label>
      <label className="flex gap-2 items-center text-[13px] text-parchment-dim">
        <input type="checkbox" checked={house.isMonarch} onChange={(e) => update({ isMonarch: e.target.checked })} />
        <span>{t("bloodline.panel.monarchHouse")}</span>
      </label>
      <section className="border-t border-line mt-3.5 pt-2.5 grid grid-cols-1 gap-2">
        <h3>{t("bloodline.panel.houseMembers")}</h3>
        {members.length === 0 ? <p className="text-slate text-[13px] italic">{t("bloodline.panel.noMembers")}</p> : null}
        <ul className="titles-list list-none m-0 p-0 grid gap-1 [&_li]:flex [&_li]:items-center [&_li]:gap-2 [&_li]:text-[13px]">
          {members.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="bg-none border-0 text-parchment-dim text-[13px] py-0.5 cursor-pointer hover:text-gold"
                onClick={() => onSelect(p.id)}
              >{p.name || t("bloodline.panel.unnamed")}</button>
            </li>
          ))}
        </ul>
      </section>
      <p className="text-slate text-xs" aria-hidden="true">
        {t("bloodline.index.counts", {
          persons: t("bloodline.index.personCount", { count: bloodline.persons.length }),
          houses: t("bloodline.index.houseCount", { count: bloodline.houses.length }),
        })}
      </p>
    </div>
  );
}
