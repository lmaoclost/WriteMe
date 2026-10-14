import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import { useScriptorium } from "../../data/store";
import { EntryList } from "./EntryList";
import { EntryView } from "./EntryView";
import "./codex.css";

interface RouteState {
  select?: string;
}

export function CodexPage({ projectId }: { projectId: string }) {
  const entries = useScriptorium(
    useShallow((s) => s.entries.filter((e) => e.projectId === projectId)),
  );
  const location = useLocation();
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
  useEffect(() => {
    if (stateConsumedRef.current) return;
    const select = (location.state as RouteState | null)?.select;
    if (select && entries.some((e) => e.id === select)) {
      stateConsumedRef.current = true;
      setSelectedId(select);
      window.history.replaceState({ ...window.history.state, usr: null }, "");
    }
  }, [location, entries]);

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

  const onEntryDeleted = (id: string) => {
    const remaining = useScriptorium.getState().entries
      .filter((e) => e.projectId === projectId && e.id !== id);
    useScriptorium.getState().deleteEntry(id);
    useScriptorium.getState().pushToast("success", "Entrada excluída.");
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
      />
      <section className="codex-main">
        {selectedEntry
          ? <EntryView entry={selectedEntry} titleRef={titleRef} onDeleted={onEntryDeleted} />
          : null}
      </section>
    </div>
  );
}
