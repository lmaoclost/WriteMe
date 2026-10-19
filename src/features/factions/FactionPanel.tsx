import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useScriptorium } from "../../data/store";
import { useDebouncedDraft } from "../../ui/useDebouncedDraft";
import { FACTION_CONNECTION_STYLES, FACTION_PRESET_COLORS } from "./connectionStyles";
import { Field } from "../../ui/Field";
import { Button } from "../../ui/Button";
import { BOARD_PANEL, BOARD_PANEL_HINT, BOARD_PANEL_HEAD, BOARD_PANEL_HEAD_H2 } from "../../ui/board";
import { withCurrentColor } from "../../ui/colors";
import type { Faction, FactionWeb } from "../../domain/types";

export function FactionPanel({ web, selectedId, selectedConnectionId, onSelect }: {
  web: FactionWeb;
  selectedId: string | null;
  selectedConnectionId?: string | null;
  onSelect(id: string | null): void;
}) {
  const { t } = useTranslation();
  const faction = web.factions.find((f) => f.id === selectedId);
  if (!faction && !selectedConnectionId) {
    return (
      <aside className={BOARD_PANEL} data-testid="fac-panel">
        <p className={BOARD_PANEL_HINT}>{t("factions.panel.selectHint")}</p>
      </aside>
    );
  }
  return (
    <aside className={BOARD_PANEL} data-testid="fac-panel">
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
  const { t } = useTranslation();
  const pushToast = useScriptorium((s) => s.pushToast);
  const [armDelete, setArmDelete] = useState(false);
  const update = (patch: Partial<Faction>) => store().updateFaction(faction.id, patch);
  const nameDraft = useNameDraft(faction, update);

  const remove = () => {
    if (!armDelete) { setArmDelete(true); return; }
    store().deleteFaction(faction.id);
    pushToast("success", t("factions.panel.factionRemoved"));
    onSelect(null);
  };

  return (
    <div className="grid gap-3" data-testid="faction-form">
      <header className={BOARD_PANEL_HEAD}>
        <h2 className={BOARD_PANEL_HEAD_H2}>{faction.name}</h2>
        <Button kind={armDelete ? "danger" : "ghost"} className="px-2 py-1 text-xs" onClick={remove}
          aria-label={armDelete ? t("factions.panel.confirmDeleteFaction") : t("common.delete")}>
          {armDelete ? t("common.confirm") : t("common.delete")}
        </Button>
      </header>
      <Field label={t("factions.panel.name")}>
        <input aria-label={t("factions.panel.name")} placeholder={t("factions.panel.namePlaceholder")} value={nameDraft.draft} onChange={(e) => nameDraft.setDraft(e.target.value)} onBlur={() => nameDraft.flush()} />
      </Field>
      <TextDebounced label={t("factions.panel.leader")} value={faction.leader ?? ""} onCommit={(v) => update({ leader: v.trim() || undefined })} />
      <TextDebounced label={t("factions.panel.territory")} value={faction.territory ?? ""} onCommit={(v) => update({ territory: v.trim() || undefined })} />
      <TextDebounced label={t("factions.panel.goals")} value={faction.goals ?? ""} onCommit={(v) => update({ goals: v.trim() || undefined })} />
      <TextDebouncedArea label={t("factions.panel.description")} value={faction.description ?? ""} onCommit={(v) => update({ description: v })} />
      <Field label={t("factions.panel.color")}>
        <div className="flex flex-wrap gap-1.5" role="listbox" aria-label={t("factions.panel.colorGroup")}>
          {withCurrentColor(FACTION_PRESET_COLORS, faction.color).map((c) => (
            <button
              key={c}
              type="button"
              role="option"
              aria-selected={faction.color === c}
              className={`color-swatch size-5 rounded-full border border-transparent cursor-pointer${faction.color === c ? " outline outline-2 outline-parchment" : ""}`}
              style={{ background: c }}
              onClick={() => update({ color: c })}
              data-color={c}
            />
          ))}
        </div>
      </Field>
      <p className="text-slate text-xs">
        {t("factions.index.counts", {
          factions: t("factions.index.factionCount", { count: web.factions.length }),
          connections: t("factions.index.connectionCount", { count: web.connections.length }),
        })}
      </p>
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
    <Field label={label}>
      <input aria-label={label} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => flush()} />
    </Field>
  );
}

function TextDebouncedArea({ label, value, onCommit, rows = 4, placeholder }: {
  label: string; value: string; onCommit(v: string): void; rows?: number; placeholder?: string;
}) {
  const { draft, setDraft, flush } = useDebouncedDraft(value, onCommit, 300);
  useEffect(() => () => flush(), [flush]);
  return (
    <Field label={label}>
      <textarea aria-label={label} placeholder={placeholder} rows={rows} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => flush()} />
    </Field>
  );
}

function ConnectionForm({ connectionId, web, onSelect }: {
  connectionId: string;
  web: FactionWeb;
  onSelect(id: string | null): void;
}) {
  const store = useScriptorium.getState;
  const { t } = useTranslation();
  const conn = web.connections.find((c) => c.id === connectionId);
  useEffect(() => {
    if (!conn) onSelect(null);
  }, [conn, onSelect]);
  if (!conn) return null;
  const a = web.factions.find((f) => f.id === conn.fromId);
  const b = web.factions.find((f) => f.id === conn.toId);
  const style = FACTION_CONNECTION_STYLES[conn.type];
  return (
    <div className="grid gap-3" data-testid="connection-form">
      <header className={BOARD_PANEL_HEAD}>
        <h2 className={BOARD_PANEL_HEAD_H2}>{t("factions.web.relationship")}</h2>
        <Button kind="danger" className="px-2 py-1 text-xs" aria-label={t("factions.web.removeConnection")}
          onClick={() => { store().removeConnection(conn.id); onSelect(null); }}>{t("common.delete")}</Button>
      </header>
      <p className="text-slate text-xs">{a?.name} ⇄ {b?.name}</p>
      <p className="text-slate text-xs">{t("factions.web.currentType", { type: style ? t(style.labelKey) : conn.type })}</p>
    </div>
  );
}
