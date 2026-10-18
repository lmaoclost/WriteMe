import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useScriptorium } from "../data/store";
import { SECTIONS } from "../app/sections";

export const OPEN_PALETTE_EVENT = "scriptorium:open-palette";

interface Item { key: string; label: string; group: string; to: string }

export function CommandPalette() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const projectId = useMemo(() => pathname.match(/^\/p\/([^/]+)/)?.[1], [pathname]);
  const open = useScriptorium((s) => s.paletteOpen);
  const setOpen = useScriptorium((s) => s.setPaletteOpen);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!useScriptorium.getState().paletteOpen);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_PALETTE_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpen);
    };
  }, [setOpen]);

  const currentProject = useScriptorium((s) => (projectId ? s.projects.find((p) => p.id === projectId) : undefined));
  const projects = useScriptorium((s) => s.projects);
  const allEntries = useScriptorium((s) => (currentProject ? s.entries : undefined));
  const manuscripts = useScriptorium((s) => (currentProject ? s.manuscripts : undefined));

  const { entries, chapters } = useMemo(() => {
    const e = allEntries?.filter((x) => x.projectId === projectId) ?? [];
    const c = manuscripts?.filter((m) => m.projectId === projectId)
      .flatMap((m) => m.chapters.map((ch) => ({ id: ch.id, heading: ch.heading, manId: m.id }))) ?? [];
    return { entries: e, chapters: c };
  }, [allEntries, manuscripts, projectId]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    if (currentProject) {
      for (const s of SECTIONS) {
        out.push({ key: `sec-${s.key}`, label: s.label, group: s.group || "Go to", to: `/p/${projectId}/${s.to}`.replace(/\/$/, "") });
      }
      for (const e of entries) out.push({ key: `ent-${e.id}`, label: e.title, group: "Lore", to: `/p/${projectId}/entries?e=${e.id}` });
      for (const c of chapters) out.push({ key: `ch-${c.id}`, label: c.heading, group: "Manuscript", to: `/p/${projectId}/manuscript` });
    } else {
      out.push({ key: "library", label: "My worlds", group: "Go to", to: "/" });
      for (const p of projects) out.push({ key: `prj-${p.id}`, label: p.name, group: "Worlds", to: `/p/${p.id}` });
    }
    return out;
  }, [currentProject, entries, chapters, projects, projectId]);

  const needle = query.trim().toLowerCase();
  const results = needle ? items.filter((i) => i.label.toLowerCase().includes(needle)) : items;
  const safeActive = Math.min(active, Math.max(0, results.length - 1));
  const rows: Array<{ type: "group"; key: string; label: string } | { type: "option"; key: string; item: Item; index: number }> = [];
  results.forEach((item, i) => {
    if (i === 0 || results[i - 1].group !== item.group) rows.push({ type: "group", key: `grp-${item.key}`, label: item.group });
    rows.push({ type: "option", key: item.key, item, index: i });
  });

  const close = () => setOpen(false);
  const choose = (item: Item) => {
    close();
    navigate(item.to);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => setOpen(v)}>
      {open && (
        <DialogContent showCloseButton={false} className="gap-0 top-[14%] rounded-lg bg-card p-0 w-[min(520px,92vw)] sm:max-w-[min(520px,92vw)] translate-y-0" aria-label="Search">
          <DialogTitle className="sr-only">Search</DialogTitle>
          <input
            ref={inputRef}
            aria-label="Search"
            aria-controls="palette-list"
            aria-activedescendant={results[safeActive] ? `palette-opt-${results[safeActive].key}` : undefined}
            placeholder="Jump to anything — sections, entries, chapters…"
            className="w-full bg-transparent border-b border-line px-4 py-3 text-sm text-parchment placeholder:text-slate outline-none"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
              else if (e.key === "Enter" && results[safeActive]) { e.preventDefault(); choose(results[safeActive]); }
            }}
          />
          {results.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate">No matches.</p>
          ) : (
            <ul id="palette-list" className="max-h-[52vh] overflow-y-auto py-1.5 m-0 list-none p-0" role="listbox" aria-label="Search results">
              {rows.map((row) => row.type === "group" ? (
                <li key={row.key} role="presentation" aria-hidden="true" className="px-4 pt-2 pb-1 m-0 text-[9px] uppercase tracking-[0.22em] text-[var(--text-faint)]">{row.label}</li>
              ) : (
                <li
                  key={row.key}
                  id={`palette-opt-${row.key}`}
                  role="option"
                  aria-selected={row.index === safeActive}
                  ref={(el) => {
                    if (el && row.index === safeActive) el.scrollIntoView?.({ block: "nearest" });
                  }}
                  className={
                    "flex w-full cursor-default list-none items-center justify-between gap-3 border-0 bg-none px-4 py-1.5 text-left no-underline text-sm text-parchment " +
                    (row.index === safeActive ? "bg-[color-mix(in_srgb,var(--gold)_10%,transparent)]" : "")
                  }
                  onMouseEnter={() => setActive(row.index)}
                  onClick={() => choose(row.item)}
                >
                  <span className="truncate">{row.item.label}</span>
                  <span className="text-[10px] uppercase tracking-[0.08em] text-slate whitespace-nowrap">{row.item.group}</span>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      )}
    </Dialog>
  );
}