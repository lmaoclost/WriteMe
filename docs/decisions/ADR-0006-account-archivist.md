# ADR-0006 — Account pages migrate to Archivist; product names brand-true

## Context
`account.css` still renders Settings and Profile in the incumbent look (blue back button, 2px-input borders, green save button, purple accents). ADR-0003 recorded detector hits on this file as a visual exemption. The public surfaces (hub, overview, /u, updates, chronicles) are now Archivist.

## Decision
1. Settings and Profile headers switch to the hub lockup: wax seal "S" + "Scriptorium" wordmark, ghost "Back to Feed"; the Settings header drops its Discord icon (the Community section keeps the Join our Discord link).
2. `account.css` retokenized to DESIGN.md: ink/night surfaces, hairline `--line` borders (1px inputs), wax-gold primary buttons (Save/Upgrade/Bindery-buy), ember danger, lilac links, Fraunces for page/section titles; font sizes snapped to the type ramp.
3. In-product names are consistent: the Bindery keeps the "Bindery Scriptorium" name (plan-tier names Free/Mythic unchanged).
4. This resolves the visual exemption noted in ADR-0003 — the detector now governs all account surfaces.

## Consequences
- Settings/Profile tests update: brand expectations, Discord count 2→1, bindery copy strings.
- Visual language of billing toggles/badges changes from purple to Archivist gold/lilac while behavior (upgrade/cancel/buy flows) stays byte-identical.

## Status
Accepted — 2026-10-16, grilling session with Renan.