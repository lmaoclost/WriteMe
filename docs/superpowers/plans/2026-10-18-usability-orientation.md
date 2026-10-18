# Usability — Orientation & Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the workspace self-explanatory: which world you're in, what each section does, how to back it up, find anything, and undo a delete.

**Architecture:** Pure UI/store work on an existing React 18 + zustand SPA. Seven independent tasks against the shared rail (`WorkspaceLayout`), Overview ledger, index pages, store (`/src/data/store.ts`) and toast system (`/src/ui/Toasts.tsx`). No new dependencies except none — lucide-react is already in package.json.

**Tech Stack:** React 18, TypeScript, zustand + persist, vite, vitest + @testing-library/react, Tailwind v4.

## Global Constraints

- UI copy in English (PRODUCT.md: "App UI language: English").
- Section names follow `docs/decisions/naming-semantic-clean.md` — never rename code identifiers (`CodexPage`, `WellSpringPage`, `bindery`, `linewheel`…).
- Verification per task: `npm run test && npm run typecheck && npm run lint`.
- Existing test helpers: see `src/features/workspace/WorkspaceLayout` usage in `src/App.test.tsx`; store seeding via `useScriptorium.getState()` actions or `seedDemo()`.
- No monetization surfaces, no new routes.
- localStorage persist: new store fields must survive rehydration (zustand merges persisted partial state over initial state — versioned migrations only if shape conflicts).

---

### Task 1: World name in the rail

**Files:**
- Modify: `src/features/workspace/WorkspaceLayout.tsx`
- Test: `src/features/workspace/WorkspaceLayout.test.tsx` (new)

**Interfaces:**
- Consumes: `selectProject(projectId)` from `../../data/store`; `project.coverImageKey`, `s.images[...]` (pattern copied from `OverviewPage.tsx:43`).
- Produces: rail block `data-testid="rail-world"` containing the world name, linking to `/p/${projectId}`. Nothing downstream consumes this.

- [ ] **Step 1: Write the failing test** — render `<WorkspaceLayout />` inside a MemoryRouter with a seeded project; assert the world name appears in the nav and links to the overview.

- [ ] **Step 2: Run** `npm test -- WorkspaceLayout`. Expected: FAIL (name not rendered).

- [ ] **Step 3: Implement** — in the nav, between the Seal and the "← My worlds" link: a Link block with the world name (`font-display text-sm text-parchment`), clickable to `/p/${projectId}`, plus the cover thumbnail when present.

- [ ] **Step 4: Run** `npm test -- WorkspaceLayout`. Expected: PASS.

- [ ] **Step 5: Commit** `feat(rail): show current world name in workspace rail`

### Task 2: Icons, groups and tooltips in the rail

**Files:**
- Modify: `src/features/workspace/WorkspaceLayout.tsx`
- Modify: `src/features/workspace/WorkspaceLayout.test.tsx`

**Interfaces:**
- Produces: `SECTIONS` entries gain `icon` (lucide-react component) and `group` ("Reference" | "Relations" | "Worldbuilding" | "Writing"). Group order fixed: Reference (Lore, Atlas, Chronology), Relations (Bloodline, Factions, Oaths), Worldbuilding (Calendar, Plot board, Timeline), Writing (Ideas, Language, Manuscript, Publishing). Task 6 consumes this grouping.

- [ ] **Step 1: Failing test** — assert group labels render above their sections and each link contains an `aria-hidden` svg icon; original labels still present.

- [ ] **Step 2: Run** — Expected: FAIL.

- [ ] **Step 3: Implement** — add `icon` + `group` to `SECTIONS`, render group header rows, icon 14px before label, `title` tooltip with a one-line purpose per section. On ≤720px hide group headers.

- [ ] **Step 4: Run** — Expected: PASS (existing label assertions unaffected).

- [ ] **Step 5: Commit** `feat(rail): icons, grouping and tooltips`

### Task 3: Ledger descriptions + empty-state CTA (Overview)

**Files:**
- Modify: `src/features/workspace/OverviewPage.tsx`
- Modify/extend: its existing test file.

**Interfaces:**
- Produces: `LEDGER` entries gain `desc: string`. Empty counter (`"—"`) replaced by an action phrase — same link target as the name. Nothing downstream consumes.

- [ ] **Step 1: Failing test** — with an empty project, each ledger row shows its `desc` and an action phrase (not "—"); with seeded counts, the count renders as before.

- [ ] **Step 2: Run** — Expected: FAIL.

- [ ] **Step 3: Implement** — `desc` per row; when `read(counts)` is empty, render phrase (e.g. Lore → "No entries yet — start your codex").

- [ ] **Step 4: Run** — Expected: PASS.

- [ ] **Step 5: Commit** `feat(overview): ledger descriptions and empty-state calls`

### Task 4: Purpose line on all index pages

**Files:**
- Modify: each `src/features/*/​*IndexPage.tsx` missing a one-line `<p>` under its `<h1>` (WellSpring already has one — pattern reference).

**Interfaces:**
- Produces: copy table filled during implementation:
  Atlas "Map regions and drop pins for places", Lore "Characters, places, creatures and things", Chronology "Dated events in world order", Bloodline "Family trees across generations", Factions "Who fights whom, who backs whom", Calendar "Your world's own year and months", Plot board "Story arcs as cards on a board", Timeline "Beads strung on a wheel", Oaths "Chains of loyalty between groups", Ideas "Loose ideas, before they have a home", Language "Words and phonetics for your tongue", Publishing "Trim the manuscript for export".

- [ ] **Step 1: Failing test** — one test file sweeping all index pages asserting the purpose line text is present under the `h1`.

- [ ] **Step 2: Run** — Expected: FAIL on pages lacking the line.

- [ ] **Step 3: Implement** — add the `<p className="text-slate text-sm">` line to each header.

- [ ] **Step 4: Run** — Expected: PASS.

- [ ] **Step 5: Commit** `feat(index): consistent purpose line on all index pages`

### Task 5: World backup export/import (Overview)

**Files:**
- Modify: `src/data/store.ts` (actions only, no persisted-shape change)
- Modify: `src/features/workspace/OverviewPage.tsx`
- Test: `src/data/store.backup.test.ts` (new), extend overview test
- Modify: `README.md` (point "Export/import" at Overview → Data)

**Interfaces:**
- Produces: `exportProjectJson(projectId: string): string` — `{ version: 1, kind: "scriptorium.world", project, entities }` where `entities` holds every collection filtered to `projectId` plus referenced images; `importProjectJson(raw: string): string` (throws `Error("Invalid backup")` on parse/shape failure) — rehydrates with fresh IDs, returns the new project id, and navigates via the caller.

- [ ] **Step 1: Failing store test** — round-trip: seed project with children, export, wipe, import, assert child counts and names match; invalid JSON throws.

- [ ] **Step 2: Run** — Expected: FAIL (actions don't exist).

- [ ] **Step 3: Implement store actions.**

- [ ] **Step 4: Run** — Expected: PASS.

- [ ] **Step 5: Failing UI test** — Overview renders a "Data" section with Download backup / Restore from file; restore feeds a file into `importProjectJson` and navigates.

- [ ] **Step 6: Run** — Expected: FAIL then implement then PASS.

- [ ] **Step 7: README one-line fix; Commit** `feat(overview): world backup export and import`

### Task 6: Command palette (Ctrl+K)

**Files:**
- Create: `src/ui/CommandPalette.tsx`
- Modify: `src/App.tsx` or `main.tsx` (global key listener), `src/features/workspace/WorkspaceLayout.tsx` (rail hint "⌘K")
- Test: `src/ui/CommandPalette.test.tsx`

**Interfaces:**
- Consumes: Task 2 grouped `SECTIONS`; store collections for entries/chapters/pins.
- Produces: nothing consumed downstream.

- [ ] **Step 1: Failing test** — Ctrl+K opens dialog, typing "lore" narrows to the Lore section + entry titles, Enter navigates and closes.

- [ ] **Step 2: Run** — Expected: FAIL.

- [ ] **Step 3: Implement** — radix Dialog; results scored by `toLowerCase().includes`; groups: Go to (sections), Lore, Manuscript, Atlas. Listener on `keydown` with `ctrlKey||metaKey` + `k`, `preventDefault`.

- [ ] **Step 4: Run** — Expected: PASS.

- [ ] **Step 5: Commit** `feat(search): command palette for sections, entries and chapters`

### Task 7: Undo on index-level deletes

**Files:**
- Modify: `src/data/store.ts`, `src/ui/Toasts.tsx`
- Modify: each index page's delete handler (`useScriptorium.getState()` calls) to snapshot → delete → toast with Undo action.
- Test: extend store test file; extend `src/ui/ui.test.tsx`.

**Interfaces:**
- Consumes: `pushToast(kind, message)` — gains optional third arg `action?: { label: string; run: () => void }`.
- Produces: `snapshotProjectState(id)` / `restoreSnapshot(snap)` helpers (store-internal); scope = index-level board/chart/well/web/atlas/manuscript deletes only. World delete keeps its confirm modal; canvas-internal deletes untouched.

- [ ] **Step 1: Failing store test** — delete an idea board → `restoreLastDelete()` reinjects same-id board; second delete without undo clears the snapshot.

- [ ] **Step 2: Run** — Expected: FAIL.

- [ ] **Step 3: Implement store snapshot/restore + toast action plumbing (8s expiry when action present).**

- [ ] **Step 4: Run** — Expected: PASS.

- [ ] **Step 5: Failing UI test** — toast renders Undo button; clicking restores.

- [ ] **Step 6: Run** — Expected: FAIL→implement→PASS.

- [ ] **Step 7: Wire all index pages; Commit** `feat(delete): undo window on index-level deletes`