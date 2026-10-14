# Scriptorium Bloodline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bloodline editor — genealogy canvas with persons/houses, drag, parent/partner/sibling connections, tenures, find, notepad, undo — schema v2.

**Architecture:** Types + validator v2 (optional `bloodlines`, migrate 1→2); store actions mirror atlas (per-bloodline ephemeral history); canvas = free plane (pan/zoom ported from Stage, no image); nodes + edges + panels + find/notepad as React components.

**Tech Stack:** Existing stack; no new dependencies.

## Global Constraints

- TypeScript strict; ZERO new deps
- Schema v2: `bloodlines?: Bloodline[]` OPTIONAL — `validateProjectData` validates when present (persons: `{id, x, y, name, additionalTitles: {title}[], tenures: {label, from, to}[], showBadge, badgeText, ...}`; houses `{id, x, y, name, isMainBranch, isMonarch}`); `migrate` v1→v2 injects `bloodlines: []`; persist `version: 2` (STORE_KEY unchanged); OLD persisted docs (v1) auto-migrate on load
- History: same mechanism as atlas — `histories` keyed `bl_<bloodlineId>`, snapshots `{ persons, houses }`, cap 50, ephemeral (partialize)
- Person coords in canvas px (NOT normalized); delete cleans incoming links (connectedTo/partnerId/siblingId pointing at deleted)
- Copy PT-BR; theme vars; a11y; gate = tsc + lint + vitest + build
- Drag: 5px threshold, pushHistory on first move only (PinLayer pattern)
- Reuse: `fileToDataUrl`, toasts, `useDebouncedDraft`, chooser/popover + escape patterns, transform math conventions from Stage (anisotropic NOT needed — square canvas px: pxPerUnit = 1)

---

### Task 1: schema v2 + bloodline store (TDD)

**Files:**
- Modify: `src/domain/types.ts` (+`BloodlinePerson/BloodlineHouse/Bloodline`), `src/data/schema.ts` (validator + serialize version 2 + parseExport accepts v1 AND v2), `src/data/store.ts` (persist version 2 + migrate + actions + histories)
- Test: `src/data/schema-v2.test.ts`, `src/data/store-bloodline.test.ts`

**Interfaces:**
- Produces: `addBloodline(projectId, name = "Linhagem sem título"): Bloodline`; `renameBloodline(id, name)`; `deleteBloodline(id)` (+history cleanup); `addPerson(bloodlineId, patch?: Partial<BloPerson>): Person | null` (position default: center viewport passed by UI — action takes x/y with default 4000); `updatePerson(id, patch)`; `movePerson(id, x, y)` (no push); `deletePerson(id)` (+link cleanup BOTH bloodlines containing references — persons are global per bloodline: links cleaned within same bloodline only); `addHouse(bloodlineId, patch?)` (name "Casa sem nome"); `updateHouse`; `moveHouse(no push)`; `deleteHouse`; `setNotes(bloodline, notes)`; `pushHistory(scope: "bl" + id)` — SAME pushHistory: extend signature `pushHistory(atlasIdOrBlId: string, kind?: "atlas" | "bloodline")` — SIMPLER: separate `pushBLHistory(blId)/undoBL/redoBL + selectBLHistoryFlags`; undo/redo snapshots `{ persons, houses }` clones.

Cases (schema): v1 doc (no bloodlines) validates; v1 → migrate adds `bloodlines: []`; v2 with persons validates; wrong shapes rejected (person without x/y/name; bad houses); parseExport v1 text WORKS (returns with bloodlines: [] after migrate chain) and v2 works; serialize writes version 2.

Cases (store): CRUD persons/houses full; movePerson no history; movePerson push ordering (UI calls pushBLHistory first: test emulates); deletePerson cleans incoming links (connectedTo/siblingId/partnerId — SAME bloodline only); deleteBloodline droplets history key + removes; setNotes; undo/redo restore (persons+houses snapshots deep-cloned — alias check); cap 50; validateProjectData(export) after ops.

Commit `feat(bloodline): schema v2 with bloodline store`

### Task 2: canvas plane + nodes + drag (TDD)

**Files:**
- Create: `src/features/bloodline/BloodlineCanvas.tsx`, `src/features/bloodline/usePlane.ts` (pan/zoom/drag-free port: no img — plane size dynamic from store: `useMemo` max+4000 rounded 1e4), `src/features/bloodline/PersonNode.tsx`, `src/features/bloodline/HouseNode.tsx`, `bloodline.css`
- Modify: router (routes bloodline + bloodline/:id), WorkspaceLayout rail (+ "Linhagem"), `src/features/bloodline/BloodlineIndexPage.tsx`
- Test: `src/features/bloodline/BloodlineCanvas.test.tsx`, `BloodlineIndexPage.test.tsx`

**Interfaces:**
- Consumes: Task 1 actions, pattern refs from Stage (transform/move threshold/pinch consts), chooser patterns.
- Produces: `<BloodlineCanvasPage bloodlineId>`: header (inline rename, undo/redo, Add person/House buttons, find ctrl+f, notes toggle) + canvas (`.bl-canvas` testid stage-like) with plane; `<PersonNode person selected onPointerDown>` (64px: portrait OR initial, name below, badge pill, monarch crown marker); `<HouseNode house>` (pill name + subtitle + glow classes main/monarch); edges layer (SVG in plane: child→parent elbow {vertical-from-child-to-parent-y, horizontal}; partner: horizontal double-line; only when both nodes exist).
- IndexPage: cards (name + person/house counts) + create modal + delete two-step + empty "Comece pela linhagem — crie uma."

Cases (canvas): renders persons at x/y with transform (pan/zoom stubbed like Stage tests); wheel zoom anchor; drag person 40px→moved + undo restores; drag threshold no-move = click→select; person delete cleans edges (DOM line gone; store links cleaned); edges render for connected pair; empty state; index page cases (render/create/select/delete).

Commit `feat(bloodline): canvas with persons, houses and edges`

### Task 3: person panel + connections + house panel (TDD)

**Files:**
- Create: `src/features/bloodline/BloodlinePanel.tsx` (person panel + house panel), `src/features/bloodline/bloodlineChoosers.tsx` (parent/partner/sibling pickers — reuse chooser pattern)
- Modify: BloodlineCanvas (panel wiring)
- Test: `src/features/bloodline/BloodlinePanel.test.tsx`

**Interfaces:**
- Consumes: Task 1+2.
- Produces: person panel fields per spec §3 (name/suffix/portrait upload → fileToDataUrl → portraitKey store pattern (images map reuse from store putImage) — RULING: PersonNode reads images[portraitKey]; title/relationship/bio (useDebouncedDraft), birth/death dates (sanitizeDate? NO — dates free text), additionalTitles add/remove, tenures add/remove with 6-label select + from/to, badge checkbox+text, connections 3 pickers + birthOrder number + isTwin checkbox; house panel (name/subtitle/isMainBranch/isMonarch) + delete two-step both).
- Panel edits: clone-safe patches, push history per FIELD commit (not per keystroke — debounced commits only).

Cases: every field commit + undo; portrait upload mock; tenures add/remove/labels; badge toggle shows pill; picker popovers (search, escape); house panel edits + delete; nodes reflect panel updates live.

Commit `feat(bloodline): panels with tenures, connections and portraits`

### Task 4: find + notepad + polish (TDD)

**Files:**
- Create: `src/features/bloodline/FindBar.tsx`, `src/features/bloodline/Notepad.tsx`
- Modify: BloodlineCanvas (ctrl+f, notes toggle)
- Test: `src/features/bloodline/findNotepad.test.tsx`

**Interfaces:** find: ctrl+f opens bar → matches (name/suffix/title/badgeText/additionalTitles, incl. case-insensitive, cap 50) → click result centers plane (pan to x/y keeping zoom; if node outside view); notepad: floating card draggable (pointer pattern; position persisted in bloodline? RULING: notes persist, position EPHEMERAL state) with textarea debounced setNotes; polish: eol, aria.

Cases: ctrl+f open/search/navigate (pan change assert); search empty → hint; notepad drag (position change); notes commit debounced; ctrl+f closes on Escape.

Commit `feat(bloodline): find bar and notepad`

### Task 5: gates + smoke + whole-branch review + merge (controller)

Spec status note; browser smoke (create bloodline → persons → connect → drag → edges → find → notes → undo → reload persistence); review-package BASE=timeline merge commit; reviewer → fix wave → merge.

## Self-review notes

- Spec §1–§7 covered: v2+store (T1), canvas/nodes/edges (T2), panels (T3), find/notes (T4), smoke/tests (T5); out-of-scope items untouched (themes/export/guest).
- Type consistency: Bloodline* names unique; movePerson/updatePerson distinct; history scope separate from atlas (pushBL*).