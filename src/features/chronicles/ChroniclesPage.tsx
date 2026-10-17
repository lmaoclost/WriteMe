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
    <div className="min-h-screen pb-[72px]">
      <header className="flex justify-between items-center py-3 px-6 bg-night border-b-2 border-night min-h-[62px] max-[660px]:px-4">
        <nav className="flex items-center gap-3.5" aria-label="Site sections">
          <h1 className="text-[0.9rem] font-semibold tracking-[0.04em] text-slate no-underline border border-line rounded-full px-3 py-1 whitespace-nowrap transition-colors hover:text-parchment-strong hover:border-gold-dim max-[660px]:text-[0.8125rem] max-[660px]:px-2 max-[660px]:py-[3px] !text-parchment-strong !border-gold-dim">Chronicles</h1>
          <Link to="/" className="text-[0.9rem] font-semibold tracking-[0.04em] text-slate no-underline border border-line rounded-full px-3 py-1 whitespace-nowrap transition-colors hover:text-parchment-strong hover:border-gold-dim max-[660px]:text-[0.8125rem] max-[660px]:px-2 max-[660px]:py-[3px]">Scriptorium</Link>
          <Link to="/" className="text-[0.9rem] font-semibold tracking-[0.04em] text-slate no-underline border border-line rounded-full px-3 py-1 whitespace-nowrap transition-colors hover:text-parchment-strong hover:border-gold-dim max-[660px]:text-[0.8125rem] max-[660px]:px-2 max-[660px]:py-[3px]">Codex</Link>
        </nav>
        <div>
          {user.username && (
            <Link to="/profile" className="inline-flex items-center gap-2 no-underline border border-line rounded-full pt-[3px] pb-[3px] pl-1 pr-3 text-sm text-parchment-dim transition-colors hover:text-parchment-strong hover:border-gold-dim" title="Open your profile">
              {user.avatarUrl
                ? <img className="block size-[26px] rounded-full object-cover" src={user.avatarUrl} alt="" />
                : <span className="size-[26px] rounded-full inline-grid place-items-center bg-night-2 border border-line text-gold font-display text-[0.8125rem] font-semibold overflow-hidden">{user.username.trim().charAt(0).toUpperCase()}</span>}
              <span className="max-w-[140px] overflow-hidden text-ellipsis whitespace-nowrap">{user.username}</span>
            </Link>
          )}
        </div>
      </header>
      <div className="library-hero flex items-center justify-center gap-4 min-h-[200px] max-[660px]:min-h-[120px]">
        <Seal letter="C" className="max-[660px]:size-11 max-[660px]:text-lg" />
        <span className="library-brand-logo font-display text-[clamp(2rem,4.5vw,2.75rem)] font-semibold tracking-[-0.01em] text-parchment-strong">Chronicles</span>
      </div>
      <main className="w-[calc(100%-48px)] max-w-[1240px] mx-auto pt-7 px-8 pb-14 border-t border-line flex flex-col gap-5 max-[660px]:w-[calc(100%-32px)] max-[660px]:px-4 max-[660px]:pb-10">
        <div className="flex flex-col gap-3 items-center self-center w-full">
          <div className="flex items-center gap-2.5 bg-night border border-line rounded-lg px-4 py-2.5 w-full max-w-[500px] focus-within:border-gold-dim">
            <span className="search-icon text-slate inline-grid place-items-center" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="7" cy="7" r="4.5" /><path d="m11 11 3.2 3.2" strokeLinecap="round" /></svg>
            </span>
            <input
              className="bg-none border-none outline-none text-parchment text-[0.9375rem] w-full p-0 placeholder:text-slate"
              placeholder="Search stories, authors, synopses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-5 items-start max-[660px]:gap-4">
            <div className="flex flex-wrap items-center gap-2 relative">
              <span className="w-full text-xs font-semibold text-slate tracking-[0.1em] -mb-0.5">STATUS</span>
              {STATUS_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  className={"filter-chip bg-transparent text-slate border border-line rounded-full px-3 py-1 text-[0.8125rem] font-medium cursor-pointer transition-colors hover:text-parchment hover:border-gold-dim" + (statusFilter === o.value ? " active bg-[color-mix(in_srgb,var(--accent)_22%,var(--night-2))] text-lilac border-[var(--accent)]" : "")}
                  onClick={() => setStatusFilter(o.value)}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 relative">
              <span className="w-full text-xs font-semibold text-slate tracking-[0.1em] -mb-0.5">GENRES</span>
              <button
                type="button"
                ref={genresTrigger}
                className={"genres-dropdown-trigger inline-flex items-center gap-2 bg-transparent border border-line rounded-full pt-1 pb-1 pl-3.5 pr-2.5 text-[0.8125rem] font-medium cursor-pointer transition-colors hover:text-parchment hover:border-gold-dim" + (selectedGenres.length ? " active text-lilac border-[var(--accent)]" : "")}
                onClick={() => setShowGenres(!showGenres)}
              >
                <span className="genres-trigger-label">{genresButtonLabel}</span>
                {selectedGenres.length > 0 && <span className="genres-count-badge inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-[color-mix(in_srgb,var(--accent)_30%,transparent)] text-lilac text-[0.6875rem] font-semibold">{selectedGenres.length}</span>}
                <span className="text-[0.6875rem]" aria-hidden="true">▾</span>
              </button>
              {showGenres && (
                <div className="genres-menu absolute top-[calc(100%+8px)] left-0 z-30 min-w-[260px] max-h-[320px] overflow-y-auto bg-night border border-line rounded-lg p-2.5 shadow-[0_18px_40px_rgb(16_16_30/0.55)]">
                  <ul className="list-none m-0 p-0">
                    {GENRE_GROUPS.map((group) => (
                      <li key={group.label}>
                        <div className="text-xs font-semibold text-slate tracking-[0.1em] uppercase py-2 px-1.5 pb-1">{group.label}</div>
                        {group.options.map((g) => (
                          <label key={g} className="flex items-center gap-2 py-[5px] px-1.5 rounded-sm cursor-pointer text-[0.85rem] text-parchment-dim hover:bg-night-2 hover:text-parchment [&_input]:accent-[var(--accent)]">
                            <input
                              type="checkbox"
                              checked={selectedGenres.includes(g)}
                              onChange={() => toggleGenre(g)}
                            />
                            <span className="genres-menu-item-label">{g}</span>
                            <span className="ml-auto text-[var(--text-faint)] text-xs [font-variant-numeric:tabular-nums]">{genreCounts.get(g) ?? 0}</span>
                          </label>
                        ))}
                      </li>
                    ))}
                  </ul>
                  {selectedGenres.length > 0 && (
                    <div className="border-t border-line mt-2 pt-2 px-1.5 pb-0.5 text-right">
                      <button type="button" className="genres-clear-btn bg-none border-none text-lilac text-[0.8125rem] cursor-pointer hover:underline" onClick={() => setSelectedGenres([])}>
                        Clear ({selectedGenres.length})
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 relative">
              <span className="w-full text-xs font-semibold text-slate tracking-[0.1em] -mb-0.5">TAGS</span>
              <button
                type="button"
                ref={tagsTrigger}
                className={"genres-dropdown-trigger inline-flex items-center gap-2 bg-transparent border border-line rounded-full pt-1 pb-1 pl-3.5 pr-2.5 text-[0.8125rem] font-medium cursor-pointer transition-colors hover:text-parchment hover:border-gold-dim" + (selectedTags.length ? " active text-lilac border-[var(--accent)]" : "")}
                onClick={() => setShowTags(!showTags)}
              >
                <span className="genres-trigger-label">{tagsButtonLabel}</span>
                {selectedTags.length > 0 && <span className="genres-count-badge inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-[color-mix(in_srgb,var(--accent)_30%,transparent)] text-lilac text-[0.6875rem] font-semibold">{selectedTags.length}</span>}
              </button>
              {showTags && (
                <div className="genres-menu absolute top-[calc(100%+8px)] left-0 z-30 min-w-[260px] max-h-[320px] overflow-y-auto bg-night border border-line rounded-lg p-2.5 shadow-[0_18px_40px_rgb(16_16_30/0.55)]">
                  <ul className="list-none m-0 p-0">
                    {TAG_GROUPS.map((group) => (
                      <li key={group.label}>
                        <div className="text-xs font-semibold text-slate tracking-[0.1em] uppercase py-2 px-1.5 pb-1">{group.label}</div>
                        {group.tags.map((t) => (
                          <label key={t.value} className="flex items-center gap-2 py-[5px] px-1.5 rounded-sm cursor-pointer text-[0.85rem] text-parchment-dim hover:bg-night-2 hover:text-parchment [&_input]:accent-[var(--accent)]">
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
                    <div className="border-t border-line mt-2 pt-2 px-1.5 pb-0.5 text-right">
                      <button type="button" className="genres-clear-btn bg-none border-none text-lilac text-[0.8125rem] cursor-pointer hover:underline" onClick={() => setSelectedTags([])}>
                        Clear ({selectedTags.length})
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 relative">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="warning-filter-chip bg-transparent text-slate border border-line rounded-full px-3 py-1 text-xs tracking-[0.04em] cursor-pointer transition-colors hover:text-parchment hover:border-gold-dim"
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
                      className={"warning-filter-chip bg-transparent text-slate border border-line rounded-full px-3 py-1 text-xs tracking-[0.04em] cursor-pointer transition-colors hover:text-parchment hover:border-gold-dim" + (off ? " off text-parchment-dim bg-night-2 border-line-strong line-through" : "")}
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
        {filtered.length === 0 && <p className="text-slate text-center py-10">No stories match the current filters.</p>}
        <div className="chronicles-grid grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-4">
          {filtered.map((m) => {
            const warnTitle = `Heads up: ${m.contentWarnings.map(warningLabelOf).join(", ")}`;
            return (
              <article key={m.id} className="manuscript-card bg-night border border-line rounded-lg overflow-hidden flex flex-col transition-[border-color] duration-[180ms] hover:border-gold-dim">
                <div className="manuscript-cover relative h-[120px] bg-[radial-gradient(ellipse_120%_90%_at_30%_15%,color-mix(in_srgb,var(--accent)_16%,var(--night-2)),var(--night))] grid place-items-center border-b border-line">
                  <span className="text-[1.375rem] text-gold-dim opacity-85">❖</span>
                  {m.contentWarnings.length > 0 && (
                    <span className="absolute top-2 left-2 min-w-5 h-5 inline-grid place-items-center rounded-full bg-[color-mix(in_srgb,var(--ember)_20%,var(--night))] border border-[var(--ember)] text-rose text-[0.6875rem] font-semibold px-1 py-0 leading-none" title={warnTitle} aria-label={warnTitle}>
                      <span className="leading-none">{m.contentWarnings.length}</span>
                    </span>
                  )}
                  <span className={`manuscript-status-pill absolute bottom-2 right-2 rounded-full px-2 py-0.5 text-[0.68rem] font-semibold tracking-[0.06em] uppercase status-${m.status}${m.status === "ongoing" ? " bg-[color-mix(in_srgb,var(--teal)_20%,var(--night))] text-teal border border-teal" : ""}${m.status === "completed" ? " bg-[color-mix(in_srgb,var(--gold)_18%,var(--night))] text-gold border border-gold-dim" : ""}${m.status === "hiatus" ? " bg-[color-mix(in_srgb,var(--rose)_16%,var(--night))] text-rose border border-rose" : ""}`}>{statusLabel(m.status)}</span>
                </div>
                <div className="px-3.5 py-3.5 flex flex-col gap-[5px]">
                  <h3 className="font-display text-[1.125rem] font-semibold text-parchment-strong m-0 leading-[1.3] [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] overflow-hidden">{m.name}</h3>
                  <p className="text-[0.8125rem] text-slate m-0">by {m.author}</p>
                  {m.avgRating > 0 && (
                    <p className="inline-flex items-center gap-1 text-xs leading-none text-slate m-0">
                      <span className="font-bold text-gold [font-variant-numeric:tabular-nums]">{m.avgRating.toFixed(1)}</span>
                      <span className="text-[var(--text-faint)]">({m.reviewCount})</span>
                    </p>
                  )}
                  {m.genres.length > 0 && (
                    <p className="flex flex-wrap gap-[3px] my-px">
                      {m.genres.map((g) => (
                        <span key={g} className="bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-lilac rounded-sm px-1.5 py-px text-[0.6875rem] whitespace-nowrap">{g}</span>
                      ))}
                    </p>
                  )}
                  {m.synopsis && <p className="text-[0.8125rem] text-parchment-dim mt-[3px] mb-0 leading-[1.5] [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] overflow-hidden">{m.synopsis}</p>}
                  <p className="text-xs text-[var(--text-faint)] mt-1 mb-0">
                    {m.chapterCount} {m.chapterCount === 1 ? "chapter" : "chapters"}
                  </p>
                  {m.releaseSchedule && (
                    <p className="flex items-center gap-1 text-xs text-[var(--text-faint)] mt-0.5 mb-0 whitespace-nowrap overflow-hidden text-ellipsis" title={m.releaseSchedule}>{m.releaseSchedule}</p>
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
