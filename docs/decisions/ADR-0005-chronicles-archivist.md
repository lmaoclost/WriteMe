# ADR-0005 — Chronicles migrates to Archivist

## Context
Chronicles is the only page still rendering the light-lilac sub-brand (`#ede7f6` body, white cards, near-black text). The app's identity decision (ADR-0001 consequences) rolled to every page; hub, overview, public profile and updates are already Archivist. A prior visual audit on `/chronicles` also left 3 known micro-gaps (filter small-caps labels, warning toggle case, leading search icon).

## Decision
1. Full Archivist migration: ink background, night-2 manuscript cards with hairline borders, Archivist chips/pills/tokens, status pills colored from the existing status palette (validated ≥3:1 on panel), warnings as tokens.
2. Hero: large wax seal ("C") + "Chronicles" wordmark in Fraunces (replacing the plain-text hero).
3. Header gains a right-side user cluster — avatar/initial + username linking to `/profile` — only when a username exists.
4. Visual micro-fixes land with the migration: small-caps group labels (STATUS / GENRES / TAGS) in the filter row, "HIDE WARNINGS" uppercase, leading magnifier in the search input.
5. Functional behavior (search, status filter, genre/tag dropdowns with counts, warning toggle chips) unchanged.

## Consequences
- `chronicles.css` rewritten under DESIGN.md tokens (second page to do so after the hub); detector governs it from now on.
- Catalog data untouched — the sample library stays as authored content.

## Status
Accepted — 2026-10-16, grilling session with Renan.