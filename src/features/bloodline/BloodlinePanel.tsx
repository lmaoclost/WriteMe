import { useEffect, useMemo, useState } from "react";
import { useScriptorium } from "../../data/store";
import { useDebouncedDraft } from "../../ui/useDebouncedDraft";
import { fileToDataUrl } from "../../data/image";
import type { Bloodline, BloodlineHouse, BloodlinePerson, BloodlineTenure } from "../../domain/types";
import "./bloodline.css";

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
      <aside className="bl-panel">
        <p className="bl-panel-hint">Selecione uma pessoa ou casa no canvas.</p>
      </aside>
    );
  }
  return (
    <aside className="bl-panel" data-testid="bl-panel">
      {person ? <PersonPanel bloodline={bloodline} person={person} onSelect={onSelect} /> : null}
      {house ? <HousePanel bloodline={bloodline} house={house} onSelect={onSelect} /> : null}
    </aside>
  );
}

function PersonField({ label, value, onCommit, placeholder }: { label: string; value: string; onCommit(v: string): void; placeholder?: string }) {
  const { draft, setDraft, flush } = useDebouncedDraft(value, onCommit);
  useEffect(() => () => flush(), [flush]);
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => flush()} aria-label={label} placeholder={placeholder} />
    </label>
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
    <div className="bl-person-panel">
      <header className="bl-panel-head">
        <h2>{person.name || "Sem nome"}</h2>
        <button type="button" className={armDelete ? "btn-danger" : ""} onClick={removePerson}
          aria-label={armDelete ? "Confirm delete person" : "Delete person"}>
          {armDelete ? "Confirm?" : "Delete"}
        </button>
      </header>
      <div className="field">
        <span className="field-label">Retrato</span>
        <div className="portrait-row">
          {person.portraitKey ? (
            <PortraitThumb personId={person.id} />
          ) : (
            <span className="portrait-none">Sem retrato</span>
          )}
          <label className="upload-label">
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
            <button type="button" aria-label="Remove portrait" onClick={() => {
              const key = person.portraitKey!;
              update({ portraitKey: undefined });
              store().removeImage(key);
            }}>✕</button>
          ) : null}
        </div>
      </div>
      <PersonField label="Name" placeholder="Full name..." value={person.name} onCommit={(v) => { const name = v.trim(); if (name) update({ name }); }} />
      <PersonField label="Suffix" placeholder="Jr, Sr, II, III, IV..." value={person.suffix ?? ""} onCommit={(v) => update({ suffix: v.trim() || undefined })} />
      <div className="field">
        <span className="field-label">House</span>
        <select aria-label="House" value={person.houseId ?? ""} onChange={(e) => update({ houseId: e.target.value || undefined })}>
          <option value="">— without house —</option>
          {bloodline.houses.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
      </div>
      <div className="field">
        <span className="field-label">Title</span>
        <input value={person.title ?? ""} onChange={(e) => update({ title: e.target.value })} aria-label="Title" placeholder="e.g. King, Queen, Lord..." />
      </div>
      <div className="field">
        <span className="field-label">Relationship</span>
        <input value={person.relationship ?? ""} onChange={(e) => update({ relationship: e.target.value })} aria-label="Relationship" placeholder="Child of / Sibling of / Partner of" />
      </div>
      <label className="field">
        <span className="field-label">Bio</span>
        <textarea value={person.bio ?? ""} onChange={(e) => update({ bio: e.target.value })} aria-label="Bio" placeholder="A brief biography of this person..." rows={3} />
      </label>
      <PersonField label="Birth Date" placeholder="e.g. 12th of Joremein, Year 250" value={person.birthDate ?? ""} onCommit={(v) => update({ birthDate: v.trim() || undefined })} />
      <PersonField label="Death Date" placeholder="e.g. 5th of Forun, Year 312" value={person.deathDate ?? ""} onCommit={(v) => update({ deathDate: v.trim() || undefined })} />

      <section className="bl-subsection">
        <h3>Additional titles</h3>
        <ul className="titles-list">
          {person.additionalTitles.map((t, i) => (
            <li key={i}>
              {t.title}
              <button type="button" aria-label={`Remove title ${t.title}`}
                onClick={() => update({ additionalTitles: person.additionalTitles.filter((_, j) => j !== i) })}>✕</button>
            </li>
          ))}
        </ul>
        <div className="titles-add">
          <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} aria-label="New title" placeholder="New title" />
          <button type="button" aria-label="Add title" onClick={() => {
            const t = newTitle.trim();
            if (!t) return;
            update({ additionalTitles: [...person.additionalTitles, { title: t }] });
            setNewTitle("");
          }}>+</button>
        </div>
      </section>

      <section className="bl-subsection">
        <h3>Reinado / mandato</h3>
        <ul className="tenures-list">
          {person.tenures.map((t, i) => (
            <li key={i} className="tenure-row">
              <select
                aria-label="Tenure label"
                value={t.label}
                onChange={(e) => update({ tenures: person.tenures.map((tt, j) => (j === i ? { ...tt, label: e.target.value } : tt)) })}
              >
                {TENURE_LABELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
              <input value={t.from} aria-label="Start" onChange={(e) => update({ tenures: person.tenures.map((tt, j) => (j === i ? { ...tt, from: e.target.value } : tt)) })} placeholder="From" />
              <input value={t.to} aria-label="End" onChange={(e) => update({ tenures: person.tenures.map((tt, j) => (j === i ? { ...tt, to: e.target.value } : tt)) })} placeholder="To" />
              <button type="button" aria-label="Remove tenure" onClick={() => update({ tenures: person.tenures.filter((_, j) => j !== i) })}>✕</button>
            </li>
          ))}
        </ul>
        <button type="button" aria-label="Add tenure" onClick={() => {
          const t: BloodlineTenure = { label: TENURE_LABELS[0], from: "", to: "" };
          update({ tenures: [...person.tenures, t] });
        }}>+ Tenure</button>
      </section>

      <section className="bl-subsection">
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
        <div className="row-2">
          <ConnectionPicker
            label="Sibling / Cousin of"
            persons={candidates.filter((c) => c.id !== person.id)}
            currentId={person.siblingId}
            onPick={(id) => update({ siblingId: id })}
            onClear={() => update({ siblingId: undefined })}
          />
          <label className="field">
            <span className="field-label">Ordem de nascimento</span>
            <input
              type="number"
              aria-label="Ordem de nascimento"
              value={person.birthOrder ?? ""}
              onChange={(e) => update({ birthOrder: e.target.value === "" ? undefined : Number(e.target.value) })}
            />
          </label>
        </div>
        <label className="check-row">
          <input type="checkbox" checked={person.isTwin} onChange={(e) => update({ isTwin: e.target.checked })} />
          <span>Twin</span>
        </label>
      </section>

      <section className="bl-subsection">
        <h3>Badge</h3>
        <label className="check-row">
          <input type="checkbox" checked={person.showBadge} onChange={(e) => update({ showBadge: e.target.checked, ...(e.target.checked ? {} : { badgeText: person.badgeText }) })} />
          <span>Show badge</span>
        </label>
        <input
          value={person.badgeText}
          aria-label="Badge text"
          onChange={(e) => update({ badgeText: e.target.value })}
          placeholder="e.g. King - 3rd House"
        />
      </section>
    </div>
  );
}

function PortraitThumb({ personId }: { personId: string }) {
  const images = useScriptorium((s) => s.images);
  const person = useScriptorium((s) => s.bloodlines.flatMap((b) => b.persons).find((p) => p.id === personId));
  const src = person?.portraitKey ? images[person.portraitKey] : undefined;
  if (!src) return null;
  return <img className="portrait-thumb" src={src} alt="" />;
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
    <div className="field connection-picker">
      <span className="field-label">{label}</span>
      <div className="connection-current">
        {current ? (
          <span className="connection-name">{current.name}</span>
        ) : (
          <span className="connection-name dim">—</span>
        )}
        <button type="button" aria-label={`Escolher ${label}`} onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}>v</button>
        {current ? <button type="button" aria-label={`Remover ${label}`} onClick={onClear}>✕</button> : null}
      </div>
      {open ? (
        <div className="connection-pop" onClick={(e) => e.stopPropagation()}>
          <input value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search persons" placeholder="Type to search persons..." />
          <ul className="link-list">
            {matches.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => { onPick(p.id); setOpen(false); }}>{p.name}</button>
              </li>
            ))}
            {matches.length === 0 ? <li><span className="dim">No matches.</span></li> : null}
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
  return (
    <div className="bl-house-panel">
      <header className="bl-panel-head">
        <h2>{house.name}</h2>
        <button type="button" className={armDelete ? "btn-danger" : ""} onClick={removeHouse}
          aria-label={armDelete ? "Confirm delete house" : "Delete house"}>
          {armDelete ? "Confirm?" : "Delete"}
        </button>
      </header>
      <div className="field">
        <span className="field-label">Name</span>
        <input value={house.name} onChange={(e) => update({ name: e.target.value })} aria-label="House Name" />
      </div>
      <PersonField label="Subtitle" value={house.subtitle ?? ""} onCommit={(v) => update({ subtitle: v.trim() || undefined })} />
      <label className="check-row">
        <input type="checkbox" checked={house.isMainBranch} onChange={(e) => update({ isMainBranch: e.target.checked })} />
        <span>Ramo principal</span>
      </label>
      <label className="check-row">
        <input type="checkbox" checked={house.isMonarch} onChange={(e) => update({ isMonarch: e.target.checked })} />
        <span>Monarch House</span>
      </label>
      <p className="bl-panel-note" aria-hidden="true">
        {bloodline.persons.length} {bloodline.persons.length === 1 ? "pessoa" : "pessoas"} · {bloodline.houses.length} {bloodline.houses.length === 1 ? "casa" : "casas"}
      </p>
    </div>
  );
}
