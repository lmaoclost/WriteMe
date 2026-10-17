# Surface brief — Project Overview (`/p/:id`)

**Status:** approved by Renan, 2026-10-16 (shape; follows grill + ADR-0002).

- **Job/audience:** writer inside a world checking its shape and jumping into a forge. Mode: Operate. Success = read the world's size in one glance, reach any forge in one click.
- **Composition hero:** full-width cover banner (project cover, ~220px tall) with discreet overlapping "Change cover" control; below it the world name in Fraunces display + description. This is the tome-cover moment.
- **Forge ledger:** 11 rows (one per workspace page), archivist ledger style, two columns on desktop: seal + forge name (EN per glossary) + live counter right-aligned + open affordance; hairline rules between rows; no cards.
  - Counters: Codex entries, Atlas regions+pins, Bloodline persons, Oaths members, Factions factions, Calendar events, Plot board cards, Timeline beads, Wellspring nodes, Conlang words, Manuscript chapters.
- **States:** zero counters → "—"; missing cover → placeholder panel with change prompt; deleted world mid-view → redirect (existing behavior).
- **Out of scope here:** Export/Import copy ("Backup" in Settings per ADR-0002), demo seed (Library empty state only), recents (decided no).
- **Copy:** full EN. Error/ success toasts for cover change in EN.
- **Craft floor notes:** no eyebrow labels on hero; name heading carries weight; rows are lists, not cards; no nested panels.