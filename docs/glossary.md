# Glossary

One name per concept — use it consistently in code, copy, and docs.

| Canonical name | Page/route | Notes |
|---|---|---|
| Library | `/` (LibraryPage) | launcher + worlds list |
| Project (world) | `/p/:id` | one story universe |
| Lore | `/p/:id/entries` (CodexPage) | world entries |
| Atlas | `/p/:id/atlas` | map, regions, pins |
| Chronology | `/p/:id/timeline` | dated entries, one sorted line |
| Timeline | `/p/:id/linewheel` | timeline beads |
| Bloodline | `/p/:id/bloodline` | genealogy canvas |
| Oaths | `/p/:id/oaths` | oath ring |
| Factions | `/p/:id/factions` | faction web |
| Calendar | `/p/:id/calendar` | custom calendars |
| Plot board | `/p/:id/plotboard` | acts/cards/wires |
| Ideas | `/p/:id/wellspring` (WellSpringPage) | idea boards: node/border sketch |
| Language | `/p/:id/conlang` (ConlangPage) | glyphs/alphabet/lexicon |
| Manuscript | `/p/:id/manuscript` | chapters |
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
