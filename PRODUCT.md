# Scriptorium — Product Context

**What it is:** local-first worldbuilding + writing studio (React SPA, zustand + localStorage). Runs offline. Single-user, no backend, no upsell.

**User:** Renan (solo writer/worldbuilder); EN-speaking audience for UI copy. App UI language: English. World content (entries, demo seed) is user data and may stay PT.

**Product truth:**
- Multi-project: the Library is the launcher and now mirrors Scriptorium's logged-in `/feed` (welcome + forges grid + worlds list below). Scriptorium has no multi-project launcher — this is a deliberate extension.
- Project workspace = forge pages: Codex, Atlas, Bloodline, Factions, Calendar, Plot board, Timeline (wheel), Oaths, Wellspring, Conlang, Manuscript (Bindery).
- Forge name mapping (legacy name → canonical page): Codex → Codex; Atlas → Atlas; Calendar → Calendar; Plot board → Plot board; Bloodline → Bloodline + Oaths (double card); Manuscript → Manuscript; Bindery Scriptorium → Bindery/export.
- No monetization surfaces: no Unlock banner, no survey modal.
- Data lives in localStorage, with JSON export/import.