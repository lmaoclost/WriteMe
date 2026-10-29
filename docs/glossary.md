# Glossary

One name per concept — use it consistently in code, copy, and docs.

| Canonical name | Page/route | Notes |
|---|---|---|
| Library | `/` (LibraryPage) | launcher + worlds list |
| Project (world) | `/p/:id` | one story universe |
| Lore | `/p/:id/entries` (CodexPage) | world entries |
| Atlas | `/p/:id/atlas` | map, regions, pins |
| Chronology | `/p/:id/timeline` | dated entries, one sorted line |
| Timeline | `/p/:id/linewheel` | timeline beads + era chain |
| Bloodline | `/p/:id/bloodline` | genealogy canvas |
| Oaths | `/p/:id/oaths` | oath ring |
| Factions | `/p/:id/factions` | faction web |
| Calendar | `/p/:id/calendar` | custom calendars |
| Plot board | `/p/:id/plotboard` | acts/cards/wires |
| Ideas | `/p/:id/wellspring` (WellSpringPage) | idea boards: node/border sketch |
| Language | `/p/:id/conlang` (ConlangPage) | glyphs/alphabet/lexicon |
| Manuscript | `/p/:id/manuscript` | parts → chapters → scenes |
| Publishing | `/p/:id/bindery` (BinderyPage) | book layout + export |
| Chronicles | `/chronicles` | public story hall |
| Updates | `/updates` | changelog page |
| Settings | `/settings` | plan/account |
| Profile | `/profile` | public profile editor |

## UI language

- **Supported:** English (`en`) and Brazilian Portuguese (`pt-BR`). EN is the source catalog and the default.
- **Locale files:** `src/i18n/locales/en.json`, `src/i18n/locales/pt-BR.json`. Both must contain the same keys.
- **Toggle:** one button in the Library header and in the workspace sidebar; it shows the target language.
- **Persistence:** `localStorage["scriptorium.lang"]`. It is not part of the project backup.
- **Scope:** interface strings, aria-labels, placeholders, toasts, and strings generated into print/EPUB/DOCX. World content is user data and is never translated.
- **PT term for Entry:** **Verbete**.

World content is user data (language-free).

## Theme (day/night)

- **Default:** night (Lamplight dark). Day is "Proof & Press", the same language in light — see `DESIGN.md` and ADR-0011.
- **Tokens:** `theme.css` holds both blocks on `:root` and `:root.light`; the aliases resolve on the same element, so only base tokens are restated for day.
- **Module:** `src/ui/theme.ts` — `localStorage["scriptorium.theme"]` (`night` | `day`, junk → default), `light` class on `<html>`, applied at import (no flash). Same pattern as the UI language; not part of the project backup, no persist migration.
- **Toggle:** `src/ui/ThemeToggle.tsx`, beside the language toggle (Library header + workspace rail).

## Pressmark (Bindery)

The hallmark that signs a bound book: a 7px gem on a 120px rule in paper brass, shipped by the
colophon switch (`colophonSection` in `buildBook.ts`; ADR-0012). The app's only mark inside the
book — the paper never takes app styling. In EPUB it degrades to `❖`; DOCX carries no mark
(ADR-0012).

## Manuscript (`/p/:id/manuscript`)

The book plan is a fixed hierarchy the panel prints in the same order the book exports:

- **Part** — optional divider that groups the chapters assigned to it (`chapter.partId`); a book may have zero parts. Ungrouped chapters (or chapters of a deleted part) print before every part.
- **Chapter** — heading + 1+ **Scenes**. The chapter body = its scenes in order; between scenes the print book sets the bindery's scene ornament.
- **Scene** — one markdown-or-HTML body block (`Scene` in `domain/types.ts`); a chapter always keeps at least one (the last cannot be deleted or dragged out).

Reordering is drag-only (dnd-kit handles + keyboard steps, no up/down arrows): parts among parts, chapters within/across parts, scenes within/across chapters. Focus mode (`Ctrl+Shift+F`, `Esc`) renders only the writing surface — chapter heading, toolbar, scene bodies, word count — centered.

PT: **parte**, **capítulo**, **cena**.

## Timeline (`/p/:id/linewheel`)

An **era** is a *boundary*, not an interval: it marks where a new span starts, and it ends exactly
where the next era begins, so eras tile the wire with no gaps (ADR-0010).

- **Origin / Start** — the fixed star bead every timeline gets at `x=0`. Not draggable, not
  deletable, excluded from the event count.
- **Bead** — an event on the wire. It links a tome entry (`entryId`) and may link a calendar event
  (`calendarEvent`).
- **Era** — a start point (`startX`) plus a label and colour. Its span ends at the next era's start;
  the last era closes at `contentEnd`.
- **Boundary** — an era whose start follows a bead (`boundaryBeadId`). One bead is the seam between
  two eras. Deleting the bead keeps the seam; unbinding freezes the last position.

PT: **era**, **evento** (bead), **início** (origin), **fronteira** (boundary).
