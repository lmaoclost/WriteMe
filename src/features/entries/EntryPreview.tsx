/** Shared preview card for a codex entry (atlas pins, wheel beads, bindery,
 *  wiki links): title + category chip + first-line blurb + "Open in codex". */
export interface EntryPreviewData {
  entryId: string;
  title: string;
  icon: string;
  categoryLabel: string;
  blurb: string;
}

export function EntryPreview({ data, onOpen }: {
  data: EntryPreviewData;
  onOpen(entryId: string): void;
}) {
  return (
    <span
      data-testid="entry-preview"
      className="relative grid gap-1.5 bg-night-2 border border-gold-dim rounded-lg px-3 py-2.5 text-xs text-left shadow-[0_8px_22px_var(--scrim-canvas)]"
    >
      <span className="flex items-center gap-1.5">
        <span aria-hidden="true">{data.icon}</span>
        <strong className="text-parchment">{data.title}</strong>
        <em className="not-italic text-[11px] text-slate">{data.categoryLabel}</em>
      </span>
      {data.blurb ? <span className="leading-[1.45] text-parchment-dim">{data.blurb}</span> : null}
      <button
        type="button"
        onClick={() => onOpen(data.entryId)}
        className="justify-self-start bg-none border border-gold-dim rounded-sm text-gold py-[3px] px-2.5 text-[11px] tracking-[0.04em] cursor-pointer hover:border-gold"
      >
        Open in codex
      </button>
    </span>
  );
}

/** First paragraph/line of an entry, capped for the preview card. */
export function entryBlurb(summary: string | undefined, body: string): string {
  const first = (summary?.trim() || body || "").split(/\n/).map((l) => l.trim()).find((l) => l.length > 0) ?? "";
  return first.length > 140 ? `${first.slice(0, 140)}…` : first;
}