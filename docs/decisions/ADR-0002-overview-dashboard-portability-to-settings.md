# ADR-0002 — Overview as world dashboard; portability moves to Settings

## Context
With ADR-0001 the Library absorbed the launcher/hub role. The Overview (`/p/:id`) was a mixed PT/EN surface with three data-portability buttons, a demo-recreate button, 4 stats and 3 forge links — role undefined between "dashboard" and "about".

## Decision
1. Overview becomes the world dashboard: cover-banner hero + name/description + a forge ledger (11 rows with live counters, archivist style).
2. Export/Import move to Settings (a "Backup" section) together with the local-first note. Demo seed's only surface remains the Library empty state — "Recriar exemplo" is removed from Overview.
3. Overview copy is fully English; world data stays as authored.
4. Counters extend to the seven post-ADR-0001 subsystems (bloodline persons, oath members, factions, calendar events, plot cards, timeline beads, wellspring nodes, conlang words) alongside codex entries, chapters and atlas.
5. No recent-activity list (decided against).

## Consequences
- Settings gains a data section; the account/plan layout must absorb it without breaking the existing visual work there.
- selectCounts in the store gains per-subsystem counters for the workspace.
- The hub's forge grid still handles navigation; Overview ledger complements it with context (counts) rather than duplicating the 7-card topology.

## Status
Accepted — 2026-10-16, grilling session with Renan.