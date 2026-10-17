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
    <span className="entry-preview-card" data-testid="entry-preview">
      <span className="entry-preview-head">
        <span aria-hidden="true">{data.icon}</span>
        <strong>{data.title}</strong>
        <em>{data.categoryLabel}</em>
      </span>
      {data.blurb ? <span className="entry-preview-blurb">{data.blurb}</span> : null}
      <button type="button" className="entry-preview-open" onClick={() => onOpen(data.entryId)}>
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