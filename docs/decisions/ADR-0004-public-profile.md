# ADR-0004 — Public profile `/u/:username` born; profile header drops Discord

## Context
The profile page stores three role bios (About_you, Worldbuilder, Author) that render nowhere, and its "View public profile" button links to `/u/:username` — a route that does not exist (dead link). The local app is single-user.

## Decision
1. Build `/u/:username` as the public profile, Archivist identity (first non-hub page on the new visual system):
   - Identity header: avatar (or letter placeholder), display name in Fraunces, role tags (✦ Reader · ✦ Worldbuilder · ✦ Author) showing only roles that have a bio.
   - Bio sections (hairline-ruled, one per role), in the order Reader → Worldbuilder → Author, only when non-empty; missing roles are omitted.
   - "My worlds" section reusing the library card pattern (cover, name, description, Updated stamp) linking to workspaces.
   - Not-found state: unknown username → "No profile named «X»." (single-user truth: anything but the stored username is not found).
2. Profile page header keeps its current layout but without the Discord button. Settings keeps its own header untouched.
3. The three bios stay in Profile Settings (source of truth unchanged, local account store).
4. Save Profile remains disabled when clean (existing behavior).

## Consequences
- ProfilePage.test gains router-dependent coverage for the not-found path.
- First Archivist surface beyond the hub: `profile.css` consumes DESIGN.md tokens; the detector now governs this page.
- Worlds list on /u is the local user's own library — there is no other user in a local-first app.

## Status
Accepted — 2026-10-16, grilling session with Renan.