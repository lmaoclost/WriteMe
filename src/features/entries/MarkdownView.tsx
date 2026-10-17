import { useMemo, useState } from "react";
import type { PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from "react";
import { useScriptorium } from "../../data/store";
import { renderWithLinks, resolveWikilink } from "./wikilinks";
import { categoryIcon, categoryLabel } from "./categories";
import "./codex-wiki.css";

export function MarkdownView({ body, onSelectEntry }: { body: string; onSelectEntry?(id: string): void }) {
  const entries = useScriptorium((s) => s.entries);
  const html = useMemo(() => renderWithLinks(body ?? "", entries), [body, entries]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  const onOver = (e: ReactPointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const link = target.closest?.("a[data-entry-link]") as HTMLElement | null;
    if (link) {
      const rect = link.getBoundingClientRect();
      const wrap = link.closest(".md-view")?.getBoundingClientRect();
      setHoveredId(link.dataset.entryLink ?? null);
      setPos({
        left: wrap ? rect.left - wrap.left : rect.left,
        top: wrap ? rect.bottom - (wrap?.top ?? 0) + 6 : rect.bottom,
      });
      return;
    }
    setHoveredId(null);
  };

  // A dead-link fix: the anchors were styled like links but had no target.
  const onClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (!onSelectEntry) return;
    const link = (e.target as HTMLElement).closest?.("a[data-entry-link]") as HTMLElement | null;
    const id = link?.dataset.entryLink;
    if (id) {
      e.preventDefault();
      onSelectEntry(id);
    }
  };

  const preview = useMemo(() => {
    if (!hoveredId) return null;
    const e = resolveWikilink(hoveredId, entries) ?? entries.find((x) => x.id === hoveredId);
    if (!e) return null;
    return {
      title: e.title,
      icon: categoryIcon(e.category),
      category: categoryLabel(e.category),
      blurb: (e.summary ?? e.body).split(/\n/)[0]?.slice(0, 140) ?? "",
    };
  }, [hoveredId, entries]);

  return (
    <div className="md-view md-view-links" onPointerOver={onOver} onPointerLeave={() => setHoveredId(null)} onClick={onClick}>
      <div dangerouslySetInnerHTML={{ __html: html }} />
      {preview && pos ? (
        <span
          className="wiki-preview-card"
          data-testid="wiki-preview"
          style={{ left: pos.left, top: pos.top }}
        >
          <span className="wiki-preview-head">
            <span aria-hidden="true">{preview.icon}</span>
            <strong>{preview.title}</strong>
            <em>{preview.category}</em>
          </span>
          {preview.blurb ? <span className="wiki-preview-blurb">{preview.blurb}</span> : null}
        </span>
      ) : null}
    </div>
  );
}
