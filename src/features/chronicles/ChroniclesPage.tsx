import { useMemo, useState } from "react";
import {
  GENRE_GROUPS,
  TAG_GROUPS,
  CONTENT_WARNINGS,
  tagLabelOf,
  warningLabelOf,
  SAMPLE_MANUSCRIPTS,
} from "./catalog";
import type { ManuscriptStatus } from "./catalog";
import "./chronicles.css";

const STATUS_OPTIONS: { value: "all" | ManuscriptStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "ongoing", label: "Ongoing" },
  { value: "completed", label: "Completed" },
  { value: "hiatus", label: "Hiatus" },
];

function statusLabel(s: string): string {
  return s === "completed" ? "Completed" : s === "hiatus" ? "Hiatus" : "Ongoing";
}

export function ChroniclesPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ManuscriptStatus>("all");
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [excludedWarnings, setExcludedWarnings] = useState<string[]>([]);
  const [showGenres, setShowGenres] = useState(false);
  const [showTags, setShowTags] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return SAMPLE_MANUSCRIPTS.filter((m) => {
      if (statusFilter !== "all" && m.status !== statusFilter) return false;
      if (excludedWarnings.some((w) => m.contentWarnings.includes(w))) return false;
      if (selectedGenres.length && !selectedGenres.every((g) => m.genres.includes(g))) return false;
      if (selectedTags.length && !selectedTags.every((t) => m.tags.includes(t))) return false;
      if (q && ![m.name, m.author, m.synopsis ?? ""].some((f) => f.toLowerCase().includes(q))) {
        return false;
      }
      return true;
    });
  }, [search, statusFilter, selectedGenres, selectedTags, excludedWarnings]);

  const genreCounts = useMemo(() => {
    const c = new Map<string, number>();
    for (const m of SAMPLE_MANUSCRIPTS) for (const g of m.genres) c.set(g, (c.get(g) ?? 0) + 1);
    return c;
  }, []);

  const genresButtonLabel =
    selectedGenres.length === 0
      ? "All genres"
      : selectedGenres.length === 1
        ? selectedGenres[0]
        : `${selectedGenres.length} genres`;
  const tagsButtonLabel =
    selectedTags.length === 0
      ? "All tags"
      : selectedTags.length === 1
        ? tagLabelOf(selectedTags[0])
        : `${selectedTags.length} tags`;

  const toggleGenre = (g: string) =>
    setSelectedGenres((s) => (s.includes(g) ? s.filter((x) => x !== g) : [...s, g]));
  const toggleTag = (v: string) =>
    setSelectedTags((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]));
  const toggleWarning = (v: string) =>
    setExcludedWarnings((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]));

  return (
    <div className="chronicles-library">
      <header className="library-header">
        <h1 className="library-brand"><span className="library-brand-logo">Chronicles</span></h1>
        <div className="header-right">
          <input
            className="search-input"
            placeholder="Search stories, authors, synopses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </header>
      <main className="library-box">
        <div className="library-toolbar">
          <div className="filter-row">
            <div className="filter-group">
              {STATUS_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  className={`filter-chip${statusFilter === o.value ? " active" : ""}`}
                  onClick={() => setStatusFilter(o.value)}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <div className="filter-group filter-group-genres">
              <button
                type="button"
                className="genres-dropdown-trigger"
                onClick={() => setShowGenres(!showGenres)}
              >
                <span className="genres-trigger-label">{genresButtonLabel}</span>
                {selectedGenres.length > 0 && <span className="genres-count-badge">{selectedGenres.length}</span>}
                <span className="genres-trigger-caret" aria-hidden="true">▾</span>
              </button>
              {showGenres && (
                <div className="genres-menu">
                  <ul className="genres-menu-list">
                    {GENRE_GROUPS.map((group) => (
                      <li key={group.label}>
                        <div className="genres-menu-group-label">{group.label}</div>
                        {group.options.map((g) => (
                          <label key={g} className="genres-menu-item">
                            <input
                              type="checkbox"
                              checked={selectedGenres.includes(g)}
                              onChange={() => toggleGenre(g)}
                            />
                            <span className="genres-menu-item-label">{g}</span>
                            <span className="genres-menu-item-count">{genreCounts.get(g) ?? 0}</span>
                          </label>
                        ))}
                      </li>
                    ))}
                  </ul>
                  {selectedGenres.length > 0 && (
                    <div className="genres-menu-footer">
                      <button type="button" className="genres-clear-btn" onClick={() => setSelectedGenres([])}>
                        Clear ({selectedGenres.length})
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="filter-group filter-group-tags">
              <button
                type="button"
                className="genres-dropdown-trigger"
                onClick={() => setShowTags(!showTags)}
              >
                <span className="genres-trigger-label">{tagsButtonLabel}</span>
                {selectedTags.length > 0 && <span className="genres-count-badge">{selectedTags.length}</span>}
              </button>
              {showTags && (
                <div className="genres-menu">
                  <ul className="genres-menu-list">
                    {TAG_GROUPS.map((group) => (
                      <li key={group.label}>
                        <div className="genres-menu-group-label">{group.label}</div>
                        {group.tags.map((t) => (
                          <label key={t.value} className="genres-menu-item">
                            <input
                              type="checkbox"
                              checked={selectedTags.includes(t.value)}
                              onChange={() => toggleTag(t.value)}
                            />
                            <span className="genres-menu-item-label">{t.label}</span>
                          </label>
                        ))}
                      </li>
                    ))}
                  </ul>
                  {selectedTags.length > 0 && (
                    <div className="genres-menu-footer">
                      <button type="button" className="genres-clear-btn" onClick={() => setSelectedTags([])}>
                        Clear ({selectedTags.length})
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="filter-group filter-group-warnings">
              <div className="warning-filter-chips">
                <button
                  type="button"
                  className="warning-filter-chip"
                  onClick={() =>
                    setExcludedWarnings(excludedWarnings.length ? [] : CONTENT_WARNINGS.map((w) => w.value))
                  }
                >
                  {excludedWarnings.length ? "Show warnings" : "Hide warnings"}
                </button>
                {CONTENT_WARNINGS.map((w) => {
                  const off = excludedWarnings.includes(w.value);
                  return (
                    <button
                      key={w.value}
                      type="button"
                      className={`warning-filter-chip${off ? " off" : ""}`}
                      title={off ? `Click to show stories with ${w.label}` : `Click to hide stories with ${w.label}`}
                      onClick={() => toggleWarning(w.value)}
                    >
                      {w.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        {filtered.length === 0 && <p className="library-empty">No stories match the current filters.</p>}
        <div className="library-grid">
          {filtered.map((m) => {
            const warnTitle = `Heads up: ${m.contentWarnings.map(warningLabelOf).join(", ")}`;
            return (
              <article key={m.id} className="manuscript-card">
                <div className="manuscript-cover">
                  <span className="cover-placeholder">❖</span>
                  {m.contentWarnings.length > 0 && (
                    <span className="manuscript-warning-badge" title={warnTitle} aria-label={warnTitle}>
                      <span className="manuscript-warning-count">{m.contentWarnings.length}</span>
                    </span>
                  )}
                  <span className={`manuscript-status-pill status-${m.status}`}>{statusLabel(m.status)}</span>
                </div>
                <div className="manuscript-info">
                  <h3 className="manuscript-name">{m.name}</h3>
                  <p className="manuscript-author">by {m.author}</p>
                  {m.avgRating > 0 && (
                    <p className="manuscript-rating-row">
                      <span className="manuscript-rating-num">{m.avgRating.toFixed(1)}</span>
                      <span className="manuscript-rating-count">({m.reviewCount})</span>
                    </p>
                  )}
                  {m.genres.length > 0 && <p className="manuscript-genres">{m.genres.join(" · ")}</p>}
                  {m.synopsis && <p className="manuscript-synopsis">{m.synopsis}</p>}
                  <p className="manuscript-chapter-count">
                    {m.chapterCount} {m.chapterCount === 1 ? "chapter" : "chapters"}
                  </p>
                  {m.releaseSchedule && (
                    <p className="manuscript-release-schedule" title={m.releaseSchedule}>{m.releaseSchedule}</p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </main>
    </div>
  );
}
