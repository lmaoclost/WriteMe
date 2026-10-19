# Scriptorium — Product Context

**What it is:** local-first worldbuilding + writing studio (React SPA, zustand + localStorage). Single-user, offline-first, no backend, no upsell.

**User:** Renan (solo writer/worldbuilder); EN-speaking audience for UI copy. App UI language: English or Brazilian Portuguese, chosen with one toggle in the Library header and the workspace sidebar (default EN, no browser detection; see `docs/decisions/ADR-0009-i18n-en-ptbr.md`). World content (entries, demo seed) is user data and may stay PT.

**Product truth:**
- Multi-project: the Library is the launcher (welcome + worlds list). Users pick a world from the cards; feature access happens inside the workspace.
- Section names are semantic (Lore, Chronology, Timeline, Ideas, Language, Publishing…) per `docs/decisions/naming-semantic-clean.md`. Routes and component names keep the historical vocabulary (entries, linewheel, wellspring, conlang, bindery).
- Project workspace = forge pages: Codex, Atlas, Bloodline, Factions, Calendar, Plot board, Timeline (wheel), Oaths, Wellspring, Conlang, Manuscript (Bindery).
- No monetization surfaces: no Unlock banner, no survey modal.
- Data stays in localStorage, with JSON export/import for backup and migration.