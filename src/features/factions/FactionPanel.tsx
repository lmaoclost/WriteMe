import { useEffect, useState } from "react";
import { useScriptorium } from "../../data/store";
import { useDebouncedDraft } from "../../ui/useDebouncedDraft";
import { FACTION_PRESET_COLORS } from "./connectionStyles";
import type { Faction, FactionWeb } from "../../domain/types";
import "./factions.css";

export function FactionPanel({ web, selectedId, selectedConnectionId, onSelect }: {
  web: FactionWeb;
  selectedId: string | null;
  selectedConnectionId?: string | null;
  onSelect(id: string | null): void;
}) {
  const faction = web.factions.find((f) => f.id === selectedId);
  if (!faction && !selectedConnectionId) {
    return (
      <aside className="bl-panel" data-testid="fac-panel">
        <p className="bl-panel-hint">Selecione uma fração ou relação no canvas.</p>
      </aside>
    );
  }
  return (
    <aside className="bl-panel" data-testid="fac-panel">
      {faction ? <FactionForm web={web} faction={faction} onSelect={onSelect} /> : null}
      {selectedConnectionId ? <ConnectionForm connectionId={selectedConnectionId} web={web} onSelect={onSelect} /> : null}
    </aside>
  );
}

export function FactionForm({ web, faction, onSelect }: {
  web: FactionWeb;
  faction: Faction;
  onSelect(id: string | null): void;
}) {
  const store = useScriptorium.getState;
  const pushToast = useScriptorium((s) => s.pushToast);
  const [armDelete, setArmDelete] = useState(false);
  const update = (patch: Partial<Faction>) => store().updateFaction(faction.id, patch);
  const nameDraft = useNameDraft(faction, update);

  const remove = () => {
    if (!armDelete) { setArmDelete(true); return; }
    store().deleteFaction(faction.id);
    pushToast("success", "Fração removida.");
    onSelect(null);
  };

  return (
    <div className="bl-house-panel" data-testid="faction-form">
      <header className="bl-panel-head">
        <h2>{faction.name}</h2>
        <button type="button" className={armDelete ? "btn-danger" : ""} onClick={remove}
          aria-label={armDelete ? "Confirmar exclusão da fração" : "Excluir fração"}>
          {armDelete ? "Confirmar?" : "Excluir"}
        </button>
      </header>
      <div className="field">
        <span className="field-label">Nome</span>
        <input aria-label="Nome" value={nameDraft.draft} onChange={(e) => nameDraft.setDraft(e.target.value)} onBlur={() => nameDraft.flush()} />
      </div>
      <TextDebounced label="Líder" value={faction.leader ?? ""} onCommit={(v) => update({ leader: v.trim() || undefined })} />
      <TextDebounced label="Território" value={faction.territory ?? ""} onCommit={(v) => update({ territory: v.trim() || undefined })} />
      <TextDebounced label="Objetivos" value={faction.goals ?? ""} onCommit={(v) => update({ goals: v.trim() || undefined })} />
      <label className="field">
        <span className="field-label">Descrição</span>
        <textarea aria-label="Descrição" rows={4} value={faction.description ?? ""} onChange={(e) => update({ description: e.target.value })} />
      </label>
      <div className="field">
        <span className="field-label">Cor</span>
        <div className="color-row" role="listbox" aria-label="Cor da fração">
          {FACTION_PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="option"
              aria-selected={faction.color === c}
              className={`color-swatch${faction.color === c ? " current" : ""}`}
              style={{ background: c }}
              onClick={() => update({ color: c })}
              data-color={c}
            />
          ))}
        </div>
      </div>
      <p className="bl-panel-note">{web.factions.length} frações · {web.connections.length} relações</p>
    </div>
  );
}

function useNameDraft(faction: Faction, update: (patch: Partial<Faction>) => void) {
  return useNameDraftImpl(faction.name, (v) => { const name = v.trim(); if (name) update({ name }); });
}
function useNameDraftImpl(value: string, onCommit: (v: string) => void) {
  const hook = useDebouncedDraft(value, onCommit, 300);
  return { draft: hook.draft, setDraft: hook.setDraft, flush: hook.flush };
}

function TextDebounced({ label, value, onCommit }: { label: string; value: string; onCommit(v: string): void }) {
  const { draft, setDraft, flush } = useDebouncedDraft(value, onCommit, 300);
  useEffect(() => () => flush(), [flush]);
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input aria-label={label} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => flush()} />
    </label>
  );
}

function ConnectionForm({ connectionId, web, onSelect }: {
  connectionId: string;
  web: FactionWeb;
  onSelect(id: string | null): void;
}) {
  const store = useScriptorium.getState;
  const conn = web.connections.find((c) => c.id === connectionId);
  useEffect(() => {
    if (!conn) onSelect(null);
  }, [conn, onSelect]);
  if (!conn) return null;
  const a = web.factions.find((f) => f.id === conn.fromId);
  const b = web.factions.find((f) => f.id === conn.toId);
  return (
    <div className="bl-house-panel" data-testid="connection-form">
      <header className="bl-panel-head">
        <h2>Relação</h2>
        <button type="button" className="btn-danger" aria-label="Remover relação"
          onClick={() => { store().removeConnection(conn.id); onSelect(null); }}>Excluir</button>
      </header>
      <p className="bl-panel-note">{a?.name} ⇄ {b?.name}</p>
      <p className="bl-panel-note">Tipo atual: {conn.type}</p>
    </div>
  );
}