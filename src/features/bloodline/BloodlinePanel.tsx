import { useEffect, useMemo, useState } from "react";
import { useScriptorium } from "../../data/store";
import { useDebouncedDraft } from "../../ui/useDebouncedDraft";
import { fileToDataUrl } from "../../data/image";
import type { Bloodline, BloodlineHouse, BloodlinePerson, BloodlineTenure } from "../../domain/types";
import { Field } from "../../ui/Field";
import { Button } from "../../ui/Button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BOARD_PANEL, BOARD_PANEL_HINT, BOARD_PANEL_HEAD, BOARD_PANEL_HEAD_H2 } from "../../ui/board";

const TENURE_LABELS = ["Reigned", "Served", "Tenure", "Ruled", "Governed", "Appointed"];

export function BloodlinePanel({ bloodline, selectedId, onSelect }: {
  bloodline: Bloodline;
  selectedId: string | null;
  onSelect(id: string | null): void;
}) {
  const person = bloodline.persons.find((p) => p.id === selectedId);
  const house = bloodline.houses.find((h) => h.id === selectedId);
  if (!person && !house) {
    return (
      <aside className={BOARD_PANEL}>
        <p className={BOARD_PANEL_HINT}>Selecione uma pessoa ou casa no canvas.</p>
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
  const pushToast = useScriptorium((s) => s.pushToast);
  const [armDelete, setArmDelete] = useState(false);
  const [portraitUploading, setPortraitUploading] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const update = (patch: Partial<BloodlinePerson>) => store().updatePerson(person.id, patch);

  const onPortrait = async (file: File) => {
    setPortraitUploading(true);
    try {
      const { dataUrl } = await fileToDataUrl(file);
      const key = store().putImage(dataUrl, "person");
      update({ portraitKey: key });
      pushToast("success", "Retrato atualizado.");
    } catch {
      pushToast("error", "Couldn't load the portrait.");
    } finally {
      setPortraitUploading(false);
    }
  };

  const removePerson = () => {
    if (!armDelete) { setArmDelete(true); return; }
    store().deletePerson(person.id);
    pushToast("success", "Pessoa removida.");
    onSelect(null);
  };

  const candidates = bloodline.persons;

  return (
    <div className="grid gap-3">
      <header className={BOARD_PANEL_HEAD}>
        <h2 className={BOARD_PANEL_HEAD_H2}>{person.name || "Sem nome"}</h2>
        <Button kind={armDelete ? "danger" : "ghost"} className="px-2 py-1 text-xs" onClick={removePerson}
          aria-label={armDelete ? "Confirm delete person" : "Delete person"}>
          {armDelete ? "Confirm?" : "Delete"}
        </Button>
      </header>
      <Field label="Retrato">
        <div className="flex items-center gap-2">
          {person.portraitKey ? (
            <PortraitThumb personId={person.id} />
          ) : (
            <span className="portrait-none text-slate text-[13px]">Sem retrato</span>
          )}
          <label className="upload-label rounded-sm border border-line py-1 px-2.5 text-parchment-dim cursor-pointer hover:text-parchment hover:border-gold-dim">
            {portraitUploading ? "…" : "Carregar"}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              aria-label="Upload portrait"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void onPortrait(f); e.target.value = ""; }}
            />
          </label>
          {person.portraitKey ? (
            <Button kind="ghost" className="px-1.5 py-0.5 text-xs" aria-label="Remove portrait" onClick={() => {
              const key = person.portraitKey!;
              update({ portraitKey: undefined });
              store().removeImage(key);
            }}>✕</Button>
          ) : null}
        </div>
      </Field>
      <PersonField label="Name" placeholder="Full name..." value={person.name} onCommit={(v) => { const name = v.trim(); if (name) update({ name }); }} />
      <PersonField label="Suffix" placeholder="Jr, Sr, II, III, IV..." value={person.suffix ?? ""} onCommit={(v) => update({ suffix: v.trim() || undefined })} />
      <Field label="House">
        <Select value={person.houseId ?? ""} onValueChange={(v) => update({ houseId: v || undefined })}>
          <SelectTrigger aria-label="House" className="w-full justify-between rounded-sm border-line bg-ink px-2 py-1.5 text-xs text-parchment hover:border-gold-dim data-[size=default]:h-auto"><SelectValue placeholder="— without house —" /></SelectTrigger>
          <SelectContent className="border-line bg-night text-parchment">
            {bloodline.houses.map((h) => <SelectItem key={h.id} value={h.id} className="text-xs focus:bg-[#24233f] focus:text-parchment" data-testid="house-option">{h.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <PersonField label="Title" placeholder="e.g. King, Queen, Lord..." value={person.title ?? ""} onCommit={(v) => update({ title: v })} />
      <PersonField label="Relationship" placeholder="Child of / Sibling of / Partner of" value={person.relationship ?? ""} onCommit={(v) => update({ relationship: v })} />
      <PersonFieldArea label="Bio" placeholder="A brief biography of this person..." rows={3} value={person.bio ?? ""} onCommit={(v) => update({ bio: v })} />
      <PersonField label="Birth Date" placeholder="e.g. 12th of Joremein, Year 250" value={person.birthDate ?? ""} onCommit={(v) => update({ birthDate: v.trim() || undefined })} />
      <PersonField label="Death Date" placeholder="e.g. 5th of Forun, Year 312" value={person.deathDate ?? ""} onCommit={(v) => update({ deathDate: v.trim() || undefined })} />

      <section className="border-t border-line mt-3.5 pt-2.5 grid gap-2">
        <h3>Additional titles</h3>
        <ul className="titles-list list-none m-0 p-0 grid gap-1 [&_li]:flex [&_li]:justify-between [&_li]:items-center [&_li]:gap-2 [&_li]:text-[13px] [&_li]:text-parchment-dim [&_button]:bg-none [&_button]:border-0 [&_button]:text-slate [&_button]:text-xs">
          {person.additionalTitles.map((t, i) => (
            <li key={i}>
              {t.title}
              <button type="button" aria-label={`Remove title ${t.title}`}
                onClick={() => update({ additionalTitles: person.additionalTitles.filter((_, j) => j !== i) })}>✕</button>
            </li>
          ))}
        </ul>
        <div className="flex gap-1.5">
          <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} aria-label="New title" placeholder="New title" className="flex-1 min-w-0 bg-ink border border-line rounded-sm text-parchment px-2 py-1.5" />
          <Button kind="ghost" className="px-2 py-1 text-xs" aria-label="Add title" onClick={() => {
            const t = newTitle.trim();
            if (!t) return;
            update({ additionalTitles: [...person.additionalTitles, { title: t }] });
            setNewTitle("");
          }}>+</Button>
        </div>
      </section>

      <section className="border-t border-line mt-3.5 pt-2.5 grid gap-2">
        <h3>Reinado / mandato</h3>
        <ul className="list-none m-0 p-0 grid gap-1.5">
          {person.tenures.map((t, i) => (
            <li key={i} className="tenure-row grid grid-cols-[1.2fr_1fr_1fr_auto] gap-1.5 items-center [&>*]:min-w-0 [&_button]:text-slate [&_button]:text-xs [&_input]:bg-ink [&_input]:border [&_input]:border-line [&_input]:rounded-sm [&_input]:text-parchment [&_input]:px-1.5 [&_input]:py-1 [&_input]:text-xs [&_input]:w-full">
              <Select value={t.label} onValueChange={(v) => update({ tenures: person.tenures.map((tt, j) => (j === i ? { ...tt, label: v } : tt)) })}>
                <SelectTrigger aria-label="Tenure label" className="w-full justify-between rounded-sm border-line bg-ink px-1.5 py-1 text-xs text-parchment hover:border-gold-dim data-[size=default]:h-auto"><SelectValue /></SelectTrigger>
                <SelectContent className="border-line bg-night text-parchment">
                  {TENURE_LABELS.map((l) => <SelectItem key={l} value={l} className="text-xs focus:bg-[#24233f] focus:text-parchment">{l}</SelectItem>)}
                </SelectContent>
              </Select>
              <LoosePersonField label="Start" value={t.from} placeholder="From" onCommit={(v) => update({ tenures: person.tenures.map((tt, j) => (j === i ? { ...tt, from: v } : tt)) })} />
              <LoosePersonField label="End" value={t.to} placeholder="To" onCommit={(v) => update({ tenures: person.tenures.map((tt, j) => (j === i ? { ...tt, to: v } : tt)) })} />
              <button type="button" aria-label="Remove tenure" onClick={() => update({ tenures: person.tenures.filter((_, j) => j !== i) })} className="bg-none border-0 text-slate text-xs">✕</button>
            </li>
          ))}
        </ul>
        <Button kind="ghost" className="justify-self-start px-2 py-1 text-xs" aria-label="Add tenure" onClick={() => {
          const t: BloodlineTenure = { label: TENURE_LABELS[0], from: "", to: "" };
          update({ tenures: [...person.tenures, t] });
        }}>+ Tenure</Button>
      </section>

      <section className="border-t border-line mt-3.5 pt-2.5 grid gap-2">
        <h3>Blood bonds</h3>
        <ConnectionPicker
          label="Blood bond (parent)"
          persons={candidates.filter((c) => c.id !== person.id)}
          currentId={person.connectedTo}
          onPick={(id) => update({ connectedTo: id })}
          onClear={() => update({ connectedTo: undefined })}
        />
        <ConnectionPicker
          label="Parceiro"
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
            label="Sibling / Cousin of"
            persons={candidates.filter((c) => c.id !== person.id)}
            currentId={person.siblingId}
            onPick={(id) => update({ siblingId: id })}
            onClear={() => update({ siblingId: undefined })}
          />
          <Field label="Ordem de nascimento">
            <input
              type="number"
              aria-label="Ordem de nascimento"
              value={person.birthOrder ?? ""}
              onChange={(e) => update({ birthOrder: e.target.value === "" ? undefined : Number(e.target.value) })}
          />
          </Field>
        </div>
        <label className="flex gap-2 items-center text-[13px] text-parchment-dim">
          <input type="checkbox" checked={person.isTwin} onChange={(e) => update({ isTwin: e.target.checked })} />
          <span>Twin</span>
        </label>
      </section>

      <section className="border-t border-line mt-3.5 pt-2.5 grid gap-2">
        <h3>Badge</h3>
        <label className="flex gap-2 items-center text-[13px] text-parchment-dim">
          <input type="checkbox" checked={person.showBadge} onChange={(e) => update({ showBadge: e.target.checked, ...(e.target.checked ? {} : { badgeText: person.badgeText }) })} />
          <span>Show badge</span>
        </label>
        <PersonField label="Badge text" value={person.badgeText ?? ""} onCommit={(v) => update({ badgeText: v })} placeholder="e.g. King - 3rd House" />
      </section>
    </div>
  );
}

function PortraitThumb({ personId }: { personId: string }) {
  const images = useScriptorium((s) => s.images);
  const person = useScriptorium((s) => s.bloodlines.flatMap((b) => b.persons).find((p) => p.id === personId));
  const src = person?.portraitKey ? images[person.portraitKey] : undefined;
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
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onClick = () => setOpen(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick, { capture: true });
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick, { capture: true });
    };
  }, [open]);
  const current = useMemo(() => persons.find((p) => p.id === currentId), [persons, currentId]);
  const q = query.trim().toLowerCase();
  const matches = persons.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 8);
  return (
    <div className="flex flex-col gap-1.5 connection-picker">
      <span className="field-label text-xs font-semibold uppercase tracking-[0.08em] text-slate">{label}</span>
      <div className="flex items-center gap-2">
        {current ? (
          <span className="connection-name text-[13px] text-parchment">{current.name}</span>
        ) : (
          <span className="connection-name text-slate text-[13px]">—</span>
        )}
        <button type="button" aria-label={`Escolher ${label}`} onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }} className="bg-ink border border-line text-slate rounded-sm px-2 py-0.5 text-xs">v</button>
        {current ? <button type="button" aria-label={`Remover ${label}`} onClick={onClear} className="bg-ink border border-line text-slate rounded-sm px-1.5 py-0.5 text-xs">✕</button> : null}
      </div>
      {open ? (
        <div className="connection-pop absolute mt-1 z-30 bg-night-2 border border-line rounded-lg p-2 w-60" onClick={(e) => e.stopPropagation()}>
          <input value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search persons" placeholder="Type to search persons..." className="w-full bg-ink border border-line text-parchment rounded-sm px-2 py-1 mb-1.5" />
          <ul className="link-list list-none m-0 p-0 grid gap-0.5 [&_button]:block [&_button]:w-full [&_button]:text-left [&_button]:bg-none [&_button]:border-0 [&_button]:text-parchment-dim [&_button]:text-[13px] [&_button]:py-1 [&_button]:px-1.5 [&_button]:rounded-sm hover:[&_button]:bg-accent">
            {matches.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => { onPick(p.id); setOpen(false); }}>{p.name}</button>
              </li>
            ))}
            {matches.length === 0 ? <li><span className="text-slate">No matches.</span></li> : null}
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
  const pushToast = useScriptorium((s) => s.pushToast);
  const [armDelete, setArmDelete] = useState(false);
  const update = (patch: Partial<BloodlineHouse>) => store().updateHouse(house.id, patch);
  const removeHouse = () => {
    if (!armDelete) { setArmDelete(true); return; }
    store().deleteHouse(house.id);
    pushToast("success", "Casa removida.");
    onSelect(null);
  };
  const members = bloodline.persons.filter((p) => p.houseId === house.id);
  return (
    <div className="grid gap-3">
      <header className={BOARD_PANEL_HEAD}>
        <h2 className={BOARD_PANEL_HEAD_H2}>{house.name}</h2>
        <Button kind={armDelete ? "danger" : "ghost"} className="px-2 py-1 text-xs" onClick={removeHouse}
          aria-label={armDelete ? "Confirm delete house" : "Delete house"}>
          {armDelete ? "Confirm?" : "Delete"}
        </Button>
      </header>
      <Field label="Name">
        <input value={house.name} onChange={(e) => update({ name: e.target.value })} aria-label="House Name" />
      </Field>
      <PersonField label="Subtitle" value={house.subtitle ?? ""} onCommit={(v) => update({ subtitle: v.trim() || undefined })} />
      <label className="flex gap-2 items-center text-[13px] text-parchment-dim">
        <input type="checkbox" checked={house.isMainBranch} onChange={(e) => update({ isMainBranch: e.target.checked })} />
        <span>Ramo principal</span>
      </label>
      <label className="flex gap-2 items-center text-[13px] text-parchment-dim">
        <input type="checkbox" checked={house.isMonarch} onChange={(e) => update({ isMonarch: e.target.checked })} />
        <span>Monarch House</span>
      </label>
      <section className="border-t border-line mt-3.5 pt-2.5 grid gap-2">
        <h3>Membros da casa</h3>
        {members.length === 0 ? <p className="text-slate text-[13px] italic">Nenhum membro.</p> : null}
        <ul className="titles-list list-none m-0 p-0 grid gap-1 [&_li]:flex [&_li]:items-center [&_li]:gap-2 [&_li]:text-[13px]">
          {members.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="bg-none border-0 text-parchment-dim text-[13px] py-0.5 cursor-pointer hover:text-gold"
                onClick={() => onSelect(p.id)}
              >{p.name || "Sem nome"}</button>
            </li>
          ))}
        </ul>
      </section>
      <p className="text-slate text-xs" aria-hidden="true">
        {bloodline.persons.length} {bloodline.persons.length === 1 ? "pessoa" : "pessoas"} · {bloodline.houses.length} {bloodline.houses.length === 1 ? "casa" : "casas"}
      </p>
    </div>
  );
}
