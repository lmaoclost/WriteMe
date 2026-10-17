# Phase 2 — Feature CSS → Tailwind Conversion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Convert all `src/features/**/*.css` (~2.950 lines) to Tailwind utilities, adopt `<Button>`/`<Field>`, replace native `<select>` with shadcn `Select`, delete `ui.css` — with zero visual drift.

**Architecture:** Batch-by-batch (A shell → B small → C codex → D manuscript → E atlas+chronicles). Each batch: port CSS rules to utilities in the TSX, delete the CSS file(s), adapt jsdom tests only if they query classes/DOM of selects, run gates, commit, screenshot spot-check.

**Tech Stack:** Tailwind v4 tokens (phase 1), shadcn Select (radix scoped, React 18-safe), Playwright for spot-checks.

**Spec:** `docs/superpowers/specs/2026-10-17-phase2-tailwind-conversion-design.md`

## Global Constraints

- Hex/typography/spacing EXACT (tokens from `theme.css`; arbitrary values allowed for non-token sizes).
- Feature tests stay green except where they assert CSS class strings or native-select DOM (then adapt to the new structure; behavior coverage kept).
- `@media print` rules move to `src/app/print.css` (imported by `theme.css`); `.toasts` hide kept there.
- Commit per feature (or small cluster). Batch ends with gates + commit + screenshot.

## Tasks

### Task A — Shell batch (projects, workspace+overview, updates, account)

Files: `src/features/projects/{LibraryPage.tsx,projects.css}`, `src/features/workspace/{WorkspaceLayout.tsx,OverviewPage.tsx,workspace.css,overview.css}`, `src/features/updates/*`, `src/features/account/*`

- [ ] Convert per feature; adopt `Seal className` for `.hub-brand .seal` sizes; kill `select` native in projects (CreateBook/LibraryPage).
- [ ] Gates + commit `refactor(projects|workspace|updates|account)`.
- [ ] Screenshots: hub, overview, account.

### Task B — Small features batch (calendar, factions, conlang, oaths, plotboard, wellspring, timelinecanvas, bloodline, timeline)

Files: respective feature dirs (31 tsx, ~430 css lines)

- [ ] Convert per feature; `<select>` → `Select` in bloodline, calendar, conlang, oaths, plotboard, wellspring (and any others found by grep); raw `.btn-*` → `<Button>`.
- [ ] Gates + commits per small feature; screenshots: timeline, bloodline.

### Task C — Codex batch (entries)

Files: `src/features/entries/*.tsx`, `codex.css` (495), `codex-wiki.css`

- [ ] Convert; `<Button>`/`<Field>` adoption; markdown-view styles stay as `.md-view` descendant classes — port to a small `@apply`-free tokenized block? NO: descendant selectors for generated markdown survive as Tailwind classes on the wrapper (`md-view` via arbitrary children selectors is unreadable) — move `.md-view` rules into `theme.css` `@layer components` as the ONE tokenized descendant stylesheet (documented exception).
- [ ] Gates + commit; screenshots: codex list + entry view.

### Task D — Manuscript/Bindery batch

Files: `src/features/manuscript/*.tsx`, `book.css` (352), `bindery.css`

- [ ] Convert editor chrome to utilities; `.paper` page styles remain as tokenized component rules in `theme.css` if descendant-heavy (same exception); `@media print` → `src/app/print.css`.
- [ ] Gates + commit; screenshots: manuscript editor + bindery preview.

### Task E — Atlas + Chronicles batch (largest)

Files: `src/features/atlas/**` (atlas.css 451, stage layers, panels), `src/features/chronicles/**` (chronicles.css 308)

- [ ] Convert SVG-canvas overlays (Stage/PinLayer/RegionLayer/DrawLayer); panel chrome → utilities; chronicles filters/menus → utilities + `Select` where applicable.
- [ ] Gates + commit; screenshots: atlas editor, chronicles.
- [ ] Final: delete `ui.css` (Button/Field inline now), grep zero `btn-*`/`field-label`/`form-stack`/`.toast`/`.seal` class names in src outside tests; delete plan workspace; update DESIGN.md stack note; final gates.

## Verification (every task)

```bash
npm run lint && npm run typecheck && npm run test && npm run build
```

Screenshots via Playwright dev server; compare against pre-batch screenshot.