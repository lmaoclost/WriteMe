import { useEffect, useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import { useScriptorium } from "../../data/store";
import { EntryList } from "./EntryList";
import { EntryView } from "./EntryView";
import { Modal } from "../../ui/Modal";
import "./codex.css";

interface RouteState {
  select?: string;
}

export function CodexPage({ projectId }: { projectId: string }) {
  const entries = useScriptorium(
    useShallow((s) => s.entries.filter((e) => e.projectId === projectId)),
  );
  const location = useLocation();
  const [searchParams] = useSearchParams();
  // Deep link (?e=<id>): resolve in the state initializer so StrictMode's
  // double effects (state.select consumed once, default selection re-applied)
  // can never override it.
  const urlEntry = searchParams.get("e");
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    if (urlEntry && useScriptorium.getState().entries.some((e) => e.id === urlEntry)) {
      return urlEntry;
    }
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

  // Deep link: if the param arrives/changes while we're mounted, follow it.
  // (StrictMode-safe: idempotent and guarded.)
  useEffect(() => {
    if (!urlEntry || selectedId === urlEntry) return;
    if (useScriptorium.getState().entries.some((e) => e.id === urlEntry)) {
      setSelectedId(urlEntry);
    }
  }, [urlEntry, selectedId]);

  useEffect(() => {
    if (!pendingFocus || pendingFocus !== selectedId) return;
    setPendingFocus(null);
    titleRef.current?.focus();
  }, [pendingFocus, selectedId]);

  const create = () => {
    const entry = useScriptorium.getState().addEntry(projectId);
    setSelectedId(entry.id);
    setPendingFocus(entry.id);
  };

  const [kindOpen, setKindOpen] = useState(false);
  const [kindName, setKindName] = useState("");
  const [kindEmoji, setKindEmoji] = useState("📜");
  const createKind = () => {
    const label = kindName.trim();
    if (!label) return;
    const key = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `kind-${Date.now()}`;
    const s = useScriptorium.getState();
    const project = s.projects.find((p) => p.id === projectId);
    if (!project) return;
    if (project.customCategories?.some((k) => k.key === key)) {
      s.pushToast("error", "A kind with this name already exists.");
      return;
    }
    s.updateProject(projectId, {
      customCategories: [...(project.customCategories ?? []), { key, label, icon: kindEmoji.trim() || "📜" }],
    });
    s.pushToast("success", `Kind "${label}" created.`);
    setKindName("");
    setKindEmoji("📜");
    setKindOpen(false);
  };

  const onEntryDeleted = (id: string) => {
    const remaining = useScriptorium.getState().entries
      .filter((e) => e.projectId === projectId && e.id !== id);
    useScriptorium.getState().deleteEntry(id);
    useScriptorium.getState().pushToast("success", "Entry deleted.");
    setSelectedId(remaining[0]?.id ?? null);
  };

  const selectedEntry = entries.find((e) => e.id === selectedId);

  return (
    <div className="codex">
      <EntryList
        entries={entries}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onCreate={create}
        onCreateKind={() => setKindOpen(true)}
      />
      <section className="codex-main">
        {selectedEntry
          ? <EntryView key={selectedEntry.id} entry={selectedEntry} titleRef={titleRef} onDeleted={onEntryDeleted} onSelectEntry={setSelectedId} />
          : null}
      </section>
      {kindOpen ? (
        <Modal title="New entry kind" onClose={() => setKindOpen(false)}>
          <div className="field">
            <span className="field-label">Kind name</span>
            <input aria-label="Kind name" value={kindName} onChange={(e) => setKindName(e.target.value)} placeholder="Religion, Currency, Season..." autoFocus />
          </div>
          <div className="field">
            <span className="field-label">Kind emoji</span>
            <input aria-label="Kind emoji" value={kindEmoji} onChange={(e) => setKindEmoji(e.target.value)} maxLength={4} />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-primary" onClick={createKind}>Create kind</button>
            <button type="button" className="btn-ghost" onClick={() => setKindOpen(false)}>Cancel</button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
