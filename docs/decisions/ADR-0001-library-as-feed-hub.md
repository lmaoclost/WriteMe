# ADR-0001 — Library as feed hub

## Context
The Library (`/`) was a mixed surface: PT copy, project launcher, and navigation pills from an earlier layout. The hub needed one role: a welcome plus a grid of forge shortcuts for a single active world, with the worlds list below. The handoff task was to make the hub the primary entry point.

## Decision
1. Library is the hub: heading "Welcome" + grid of 7 forges + worlds list below.
2. The forges grid needs a world context: an explicit world selector in the Library header (dropdown). No "last opened" magic.
3. The grid holds 7 cards: Lore/Codex, Atlas, Calendar, Plot board, Bloodline + Oaths (double card), Manuscript, Bindery.
4. Zero worlds: welcome + ghost (disabled) forge cards + create/import CTA + worlds list. One world: selector picks it automatically.
5. No Unlock banner, no survey modal (no monetization).
6. Welcome text fixed ("Welcome"), no name pull.
7. Worlds list gains search-by-name and sort (name/updatedAt) when ≥3 worlds.
8. The whole app's UI strings migrate to English. World data (entries, demo seed content) is user data — stays as authored.

## Consequences
- Library is no longer a bare launcher; it is the hub. Project OverviewPage keeps its own dashboard structure.
- "Bloodline" double card introduces one asymmetry in the grid (8 clickable targets in 7 cards).
- i18n migration touches all feature folders; toasts/modals included.
- The demo-load button only exists in the empty state; with worlds present, demo has no surface (unchanged from today).

## Status
Accepted — 2026-10-16, grilling session with Renan.