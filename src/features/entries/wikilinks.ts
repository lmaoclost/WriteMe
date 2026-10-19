import { marked } from "marked";
import { sanitizeFragment } from "./markdown";
import type { WorldEntry } from "../../domain/types";

marked.setOptions({ breaks: true } as never);

const WIKILINK = /\[\[([^\]|]{1,200})\]\]/g;

export function parseWikilinks(text: string): string[] {
  return [...text.matchAll(WIKILINK)].map((m) => m[1].trim()).filter(Boolean);
}

/** Resolve by exact title (case-insensitive), then unique prefix. */
export function resolveWikilink(title: string, entries: WorldEntry[]): WorldEntry | null {
  const needle = title.trim().toLowerCase();
  const exact = entries.find((e) => e.title.toLowerCase() === needle);
  const partial = entries.filter((e) => e.title.toLowerCase().startsWith(needle));
  return exact ?? (partial.length === 1 ? partial[0] : null);
}

/** Render markdown, turning [[Title]] that resolve into internal links.
 *  The output runs through the ALLOWED-tag sanitizer — `body` is user
 *  content and reaches dangerouslySetInnerHTML. */
export function renderWithLinks(body: string, entries: WorldEntry[]): string {
  let html: string;
  try {
    html = marked.parse(body ?? "", { async: false }) as string;
  } catch {
    return escapeHtml(body ?? "");
  }
  // mark.wikilink-style: escape happens in the parser; [[Title]] stays literal
  // text (with &-escapes) — replace occurrences with anchor markup.
  const linked = html.replace(WIKILINK_HTML, (_m, rawTitle: string) => {
    const title = unescapeHtml(rawTitle); // marked may have escaped quotes/ampersands
    const e = resolveWikilink(title, entries);
    if (!e) return escapeHtml(title.trim()); // unresolvable: keep the title as plain text
    return `<a class="wiki-link" data-entry-link="${e.id}" title="${escapeAttr(e.title)}"><span class="wiki-link-icon" aria-hidden="true">${iconFor(e.category)}</span>${escapeHtml(e.title)}</a>`;
  });
  return sanitizeFragment(linked);
}

const AMP = /&amp;/g
  , QUOT = /&quot;/g
  , APOS = /&#39;/g
  , LT = /&lt;/g
  , GT = /&gt;/g
  , WIKILINK_HTML = /\[\[([^\]]{1,200})\]\]/g;

function unescapeHtml(s: string): string {
  return s.replace(AMP, "&").replace(QUOT, '"').replace(APOS, "'").replace(LT, "<").replace(GT, ">");
}

const CODEX_ICONS: Record<string, string> = {
  nation: "🏰", character: "👤", creature: "🐾", location: "🗺", flora: "🌿",
  material: "💎", technology: "⚙", magic: "✨", culture: "🎭", artifact: "🗡",
  language: "📜", event: "📅", faction: "⚔", deity: "☄", lore: "📖",
  person: "👤", place: "🗺", item: "🗡",
};

function iconFor(category: string): string {
  return CODEX_ICONS[category] ?? "📖";
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, "&quot;");
}
