# Naming, semantic clean pass (2026-10-18)

## Context
Rail (WorkspaceLayout), Overview ledger and page `<h1>`s carried three vocabularies at once: legacy product names, theme names (Codex, Bindery, Wellspring, Conlang) and literal names (Timeline canvas, Timeline wheel). Same feature wore 2–4 labels depending on the surface; `/timeline` had no ledger row at all. Renan asked for semantic section names.

## Decision
One human-facing name per surface, aligned to function. Routes, keys, folder and component names stay as-is (code identifiers are not user facing).

| Route | Old labels (rail / ledger / h1) | New canonical |
|---|---|---|
| `/p/:id/entries` | Codex (all) | Lore |
| `/p/:id/timeline` | Timeline / *missing* / — | Chronology |
| `/p/:id/linewheel` | Timeline canvas / Timeline wheel / — | Timeline |
| `/p/:id/wellspring` | Wellspring / Wellspring / The Wellspring | Ideas (entity: "idea board") |
| `/p/:id/conlang` | Conlang (all) | Language |
| `/p/:id/bindery` | Bindery (all) | Publishing |
| `/p/:id/atlas` | Atlas / Atlas / — | Atlas |
| `/p/:id/bloodline` | Bloodline / Bloodline / — | Bloodline |
| `/p/:id/plotboard` | Plot board / Plot board / — | Plot board |
| `/p/:id/factions` | Factions / Factions / Faction Webs | Factions |
| `/p/:id/calendar` | Calendar / Calendar / — | Calendar |
| `/p/:id/oaths` | Oaths / Oaths / Oaths Hierarchy | Oaths (entity: "oath chart") |

- Modal confirm "Forge" → "Create"; "Forge New X" → "New X".
- PT copy sweep same day: toasts, aria labels, tool labels (Neighbor/Fit), placeholders and block menu went full EN across ui, atlas, bloodline, entries, manuscript, oaths, timelinecanvas and the store. Test data and comments keep PT (data is user content; comments are dev-facing).
- New ledger row "Chronology" (counter: entries with a valid date) — the row was missing while the rail had the page.
- UI copy is plain English; section names follow this glossary.

## Consequences
- Tests asserting old labels/counters updated (Overview, TimelinePage, ConlangPage, index modals across features).
- Glossary is the only source of section names; PRODUCT.md mapping updated to the new canonical column.
- File/component names (CodexPage, BinderyPage, WellSpringPage…) untouched on purpose — renaming identifiers now would churn the diff with no user-visible gain.
