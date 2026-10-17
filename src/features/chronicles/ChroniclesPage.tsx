import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  GENRE_GROUPS,
  TAG_GROUPS,
  CONTENT_WARNINGS,
  tagLabelOf,
  warningLabelOf,
  SAMPLE_MANUSCRIPTS,
} from "./catalog";
import type { ManuscriptStatus } from "./catalog";
import { useAccount } from "../../data/account";
import { Seal } from "../../ui/Seal";
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
  const user = useAccount();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ManuscriptStatus>("all");
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [excludedWarnings, setExcludedWarnings] = useState<string[]>([]);
  const [showGenres, setShowGenres] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const genresTrigger = useRef<HTMLButtonElement>(null);
  const tagsTrigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!showGenres && !showTags) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (showGenres) { setShowGenres(false); genresTrigger.current?.focus(); }
      if (showTags) { setShowTags(false); tagsTrigger.current?.focus(); }
    };
    const onDown = (e: MouseEvent) => {
      const menus = document.querySelectorAll(".genres-menu");
      const hits = Array.from(menus).some((m) => m.contains(e.target as Node));
      if (hits) return;
      setShowGenres(false);
      setShowTags(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [showGenres, showTags]);

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
        <nav className="chronicles-pills" aria-label="Site sections">
          <h1 className="chronicles-pill active">Chronicles</h1>
          <Link to="/" className="chronicles-pill">Scriptorium</Link>
          <Link to="/" className="chronicles-pill">Codex</Link>
        </nav>
        <div className="header-right">
          {user.username && (
            <Link to="/profile" className="header-user" title="Open your profile">
              {user.avatarUrl
                ? <img className="header-user-avatar" src={user.avatarUrl} alt="" />
                : <span className="header-user-initial">{user.username.trim().charAt(0).toUpperCase()}</span>}
              <span className="header-user-name">{user.username}</span>
            </Link>
          )}
        </div>
      </header>
      <div className="library-hero">
        <Seal letter="C" />
        <span className="library-brand-logo">Chronicles</span>
      </div>
      <main className="library-box">
        <div className="library-toolbar">
          <div className="search-box">
            <span className="search-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="7" cy="7" r="4.5" /><path d="m11 11 3.2 3.2" strokeLinecap="round" /></svg>
            </span>
            <input
              className="search-input"
              placeholder="Search stories, authors, synopses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="filter-row">
            <div className="filter-group filter-group-status">
              <span className="filter-group-label">STATUS</span>
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
              <span className="filter-group-label">GENRES</span>
              <button
                type="button"
                ref={genresTrigger}
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
              <span className="filter-group-label">TAGS</span>
              <button
                type="button"
                ref={tagsTrigger}
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
                  {excludedWarnings.length ? "SHOW WARNINGS" : "HIDE WARNINGS"}
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
        <div className="chronicles-grid">
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
                  {m.genres.length > 0 && (
                    <p className="manuscript-genres">
                      {m.genres.map((g) => (
                        <span key={g} className="manuscript-genre-tag">{g}</span>
                      ))}
                    </p>
                  )}
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
