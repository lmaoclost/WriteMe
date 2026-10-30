import { useEffect, useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import { useWriteme } from "../../data/store";
import { EntryList } from "./EntryList";
import { EntryView } from "./EntryView";
import { Modal } from "../../ui/Modal";
import { Field } from "../../ui/Field";
import { Button } from "../../ui/Button";
import { CATEGORY_CANONICAL, CODEX_CATEGORIES } from "./categories";

interface RouteState {
  select?: string;
}

export function CodexPage({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const entries = useWriteme(
    useShallow((s) => s.entries.filter((e) => e.projectId === projectId)),
  );
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  // Deep link (?e=<id>): resolve in the state initializer (StrictMode-safe:
  // the initializer has no double-run effects to fight), then consume once.
  const urlEntry = searchParams.get("e");
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const wanted = searchParams.get("e");
    if (wanted && useWriteme.getState().entries.some((e) => e.id === wanted)) return wanted;
    return null;
  });
  const [pendingFocus, setPendingFocus] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement | null>(null);
  const stateConsumedRef = useRef(false);

  // Keep the selection pointing at a live entry; default to the first one.
  useEffect(() => {
    if (selectedId === null) {
      if (entries.length > 0) setSelectedId(entries[0].id);
      return;
    }
    if (!entries.some((e) => e.id === selectedId)) setSelectedId(null);
  }, [entries, selectedId]);

  // location.state?.select: consume once, then clear the history state.
  // (Legacy path — new links use ?e=. ?e= wins when both are present.)
  useEffect(() => {
    if (selectedId === urlEntry) return;
    if (stateConsumedRef.current) return;
    const select = (location.state as RouteState | null)?.select;
    if (select && entries.some((e) => e.id === select)) {
      stateConsumedRef.current = true;
      setSelectedId(select);
      window.history.replaceState({ ...window.history.state, usr: null }, "");
    }
  }, [location, entries, selectedId]);

  // Deep link (?e=<id>): consumed ONCE, then stripped from the URL so the
  // selection stays free afterwards. lastAppliedRef keeps StrictMode's rerun
  // idempotent; validation is project-scoped (no cross-project loops).
  const lastAppliedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!urlEntry || lastAppliedRef.current === urlEntry) return;
    lastAppliedRef.current = urlEntry;
    if (!entries.some((e) => e.id === urlEntry)) return; // stale/foreign: ignore
    setSelectedId(urlEntry);
    const next = new URLSearchParams(searchParams);
    next.delete("e");
    setSearchParams(next, { replace: true });
  }, [urlEntry, searchParams, setSearchParams, entries]);

  useEffect(() => {
    if (!pendingFocus || pendingFocus !== selectedId) return;
    setPendingFocus(null);
    titleRef.current?.focus();
  }, [pendingFocus, selectedId]);

  const create = () => {
    const entry = useWriteme.getState().addEntry(projectId);
    setSelectedId(entry.id);
    setPendingFocus(entry.id);
  };

  const [kindOpen, setKindOpen] = useState(false);
  const [kindName, setKindName] = useState("");
  const [kindEmoji, setKindEmoji] = useState("📜");
  const [armKindDelete, setArmKindDelete] = useState<string | null>(null);
  const customKinds = useWriteme(
    useShallow((s) => s.projects.find((p) => p.id === projectId)?.customCategories ?? []),
  );
  const createKind = () => {
    const label = kindName.trim();
    if (!label) return;
    const key = label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `kind-${Date.now()}`;
    const s = useWriteme.getState();
    const project = s.projects.find((p) => p.id === projectId);
    if (!project) return;
    const reserved = CODEX_CATEGORIES.some((c) => c.key === key) || key in CATEGORY_CANONICAL;
    if (reserved || project.customCategories?.some((k) => k.key === key)) {
      s.pushToast("error", t("entries.codex.kindExists"));
      return;
    }
    s.updateProject(projectId, {
      customCategories: [...(project.customCategories ?? []), { key, label, icon: kindEmoji.trim() || "📜" }],
    });
    s.pushToast("success", t("entries.codex.kindCreated", { label }));
    setKindName("");
    setKindEmoji("📜");
    setKindOpen(false);
  };

  const deleteKind = (key: string, label: string) => {
    const s = useWriteme.getState();
    const project = s.projects.find((p) => p.id === projectId);
    if (!project) return;
    const affected = s.entries.filter((e) => e.projectId === projectId && e.category === key);
    s.updateProject(projectId, {
      customCategories: (project.customCategories ?? []).filter((k) => k.key !== key),
    });
    for (const entry of affected) s.updateEntry(entry.id, { category: "lore" });
    s.pushToast("success", t("entries.codex.kindDeleted", { label, count: affected.length }));
    setArmKindDelete(null);
  };

  const onEntryDeleted = (id: string) => {
    const remaining = useWriteme.getState().entries
      .filter((e) => e.projectId === projectId && e.id !== id);
    useWriteme.getState().deleteEntry(id);
    useWriteme.getState().pushToast("success", t("entries.codex.entryDeleted"));
    setSelectedId(remaining[0]?.id ?? null);
  };

  const selectedEntry = entries.find((e) => e.id === selectedId);

  return (
    <div className="grid grid-cols-[300px_1fr] h-full min-h-0 max-[720px]:grid-cols-1 max-[720px]:grid-rows-[auto_1fr]">
      <EntryList
        entries={entries}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onCreate={create}
        onCreateKind={() => setKindOpen(true)}
      />
      <section className="min-h-0 overflow-y-auto px-6 py-[18px]">
        {selectedEntry
          ? <EntryView key={selectedEntry.id} entry={selectedEntry} titleRef={titleRef} onDeleted={onEntryDeleted} onSelectEntry={setSelectedId} />
          : null}
      </section>
      {kindOpen ? (
        <Modal title={t("entries.codex.newKind")} onClose={() => setKindOpen(false)}>
          <div className="grid gap-3">
            <Field label={t("entries.codex.kindName")}>
              <input aria-label={t("entries.codex.kindName")} value={kindName} onChange={(e) => setKindName(e.target.value)} placeholder={t("entries.codex.kindNamePlaceholder")} autoFocus />
            </Field>
            <Field label={t("entries.codex.kindEmoji")}>
              <input aria-label={t("entries.codex.kindEmoji")} value={kindEmoji} onChange={(e) => setKindEmoji(e.target.value)} maxLength={4} />
            </Field>
            {customKinds.length > 0 ? (
              <div className="grid gap-1.5">
                <p className="m-0 text-[10px] uppercase tracking-[0.12em] text-slate">{t("entries.codex.customKinds")}</p>
                <ul className="m-0 grid list-none gap-1 p-0">
                  {customKinds.map((kind) => (
                    <li key={kind.key} className="flex items-center gap-2 rounded-md border border-line px-2 py-1.5">
                      <span className="min-w-0 flex-1 truncate text-xs text-parchment">{kind.icon} {kind.label}</span>
                      {armKindDelete === kind.key ? (
                        <Button kind="ghost" onClick={() => deleteKind(kind.key, kind.label)} aria-label={t("entries.codex.confirmDeleteKind", { label: kind.label })}>
                          {t("entries.codex.confirmDelete")}
                        </Button>
                      ) : (
                        <button
                          type="button"
                          className="shrink-0 cursor-pointer border-0 bg-none px-1.5 py-0.5 text-xs text-slate hover:text-[var(--ember)]"
                          aria-label={t("entries.codex.deleteKind", { label: kind.label })}
                          onClick={() => setArmKindDelete(kind.key)}
                        >✕</button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="mt-3 flex gap-2">
              <Button onClick={createKind}>{t("entries.codex.createKind")}</Button>
              <Button kind="ghost" onClick={() => setKindOpen(false)}>{t("common.cancel")}</Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
