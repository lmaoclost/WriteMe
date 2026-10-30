import { useMemo, useState } from "react";
import type { PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from "react";
import { useWriteme } from "../../data/store";
import { renderWithLinks, resolveWikilink } from "./wikilinks";
import { categoryIcon, categoryLabel } from "./categories";

// last body+entries-signature → html. Any unrelated entry update recreates
// the entries array; without this cache that alone re-ran marked.parse and
// the sanitize pass for the whole rendered document.
let htmlCache: { body: string; sig: string; html: string } | null = null;

export function MarkdownView({ body, onSelectEntry }: { body: string; onSelectEntry?(id: string): void }) {
  const entries = useWriteme((s) => s.entries);
  // only entries fields that wikilink resolution reads affect the html
  const hasLinks = (body ?? "").includes("[[");
  const sig = useMemo(
    () => (hasLinks ? entries.map((e) => `${e.id}:${e.title}:${e.category}`).join("|") : ""),
    [entries, hasLinks],
  );
  const html = useMemo(() => {
    if (!hasLinks) return renderWithLinks(body ?? "", entries);
    if (htmlCache && htmlCache.body === (body ?? "") && htmlCache.sig === sig) return htmlCache.html;
    const out = renderWithLinks(body ?? "", entries);
    htmlCache = { body: body ?? "", sig, html: out };
    return out;
  }, [body, sig, hasLinks, entries]);
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
