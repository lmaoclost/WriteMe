# UX Feedback Round — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the feedback from manual testing of the example project: dead entry links, unreachable editor panels ("fundo"), broken canvas interactions (pan/zoom/select), manuscript editor polish + PDF/preview/counter bugs, codex field/image/category UX, conlang alphabet + lexicon spacing, configurable calendar, discoverable notes, 1vh pages.

**Architecture:** Two structural fixes carry most of the weight: (1) canvas pages hide editor panels behind the opaque `.bl-plane` — panels move out of `.bl-canvas` into the `.bl-body` grid's second column (the pattern bloodline/factions/calendar already use); (2) `.workspace-main` has no fixed height and every canvas page declares `height:100vh` inside 80px of padding, so the document scrolls — the shell gets a real height (`100dvh`, `overflow:hidden`) and each page scrolls internally. Everything else is per-feature fixes on top of existing primitives (`Modal`, `bl-panel`, `usePlane`/`useStageTransform`, `LinkPicker`, wiki preview cards).

**Tech Stack:** React + TS, zustand + localStorage, vitest + jsdom, no new deps.

## Global Constraints

- No new dependencies.
- `npm run lint` (0 warnings), `npm test`, `npm run typecheck` all green per task.
- Schema changes: relax, don't break — old localStorage data must still load (validateProjectData tolerant).
- Copy/labels in English (UI language); user data stays PT.
- Canvas interactions tested via `src/test/pointer.ts` (`firePointer`).
- Branch: master, direct commits (established repo workflow).
- Each task: RED → GREEN → commit.

## Investigation notes (from code exploration, 2026-10-17)

- **"Editor no fundo" root cause:** `WellSpringPage.tsx:192`, `OathsChartPage.tsx:113`, `PlotBoardPage.tsx:177`, `TimelineCanvasPage.tsx:140` render `<aside className="bl-panel">` inside `.bl-canvas` (static content) while `.bl-plane` is positioned + opaque (`bloodline.css:9,11,47`) → panel paints under the plane, invisible, no hit-test. Bloodline (`BloodlineCanvas.tsx:133`), factions (`FactionWebPage.tsx:235`), calendar (`CalendarPage.tsx:90`) put the panel as a **sibling** in `.bl-body` grid → works.
- **Plotboard no pan:** `pan` ref declared (`PlotBoardPage.tsx:24`) but never assigned; `onPointerDown` on empty canvas **always** creates a card (`:65-71`). Test `PlotBoardPage.test.tsx:32-45` pins that behavior; stray `console.error("DEBUG…")` at `:36-39`.
- **TL wheel:** "Add Event Circle" beads at fixed `x:4000, y:-60` (`TimelineCanvasPage.tsx:52`) — off-viewport with default view (s=0.4, panX=100) → created-but-invisible. Segments `<g data-testid="tl-seg">` (`:112-117`) have no pointer handler; `BeadPanel` segment branch (`:214-227`) is dead code.
- **Factions:** no zoom at all (only drag-pan + initial fit). Atlas pattern to copy: wheel-anchored zoom + −/%/+ buttons (`AtlasEditor.tsx:329-334`, `useStageTransform.ts`).
- **Bloodline:** count text `7 pessoas` = `persons.length` of the *whole* bloodline (demo seed has 6, `seed.ts:199-218`) — label scope ambiguity; live-repro needed for the "empty canvas" claim. Person→house link impossible: `Person` has `connectedTo/partnerId/siblingId` only (`types.ts:123-125`); `HousePanel` has no picker. Panel overflow-x: `.bl-panel{overflow-y:auto}` (`bloodline.css:47`) + `.tenure-row{grid-template-columns:1.2fr 1fr 1fr auto}` (`:59`) without `min-width:0` → horizontal scroll.
- **Manuscript:** rich toolbar classes (`.rich-toolbar`, `.rich-blocks`, `.book-body-rich`, `.chapter-note`, `.scene-marker`, `.toc`) have **no CSS anywhere** — the "botões soltos" look. Word count counts the **raw HTML string** after first commit (`"<p>A</p><p>B</p>"` = 1 word; `ChapterEditor.tsx:140-144`, `ChapterList.tsx:5-11`). PDF blank first page = adjacent forced breaks (`bindery.css:16,23` + book.css print rules) and `height:100vh`/`overflow:auto` ancestors surviving print. Preview "loss" most likely stale-commit unmount path (`ChapterEditor.tsx:90-102`) — live repro required.
- **Codex summary:** `EntryView.tsx:185-204` always renders the literal word "Summary" as a toggle label; hint stays "Add a short blurb..." until filled; **zero CSS** for `.codex-summary-*`. Add field/section buttons (`EntryView.tsx:302-312,407,414-419`) also have **zero CSS** → raw UA buttons. Cover crop is `object-fit:cover` centered, no `object-position` control anywhere. Categories hardcoded (`ENTRY_CATEGORIES` `types.ts:331-336`, `CODEX_CATEGORIES` `categories.ts:12-118`); the page-level dropdown is the category selector (`EntryView.tsx:169-183`).
- **Conlang:** glyph `char` exists + `updateGlyph` accepts `{char}` patches (`store.ts:2467-2479`) but no input in `GlyphEditor` (`ConlangPage.tsx:132-197`). `.bl-body-full` class used (`:43`) but **never defined** → page inherits 2-column grid, ghost 300px column squeezes the lexicon table.
- **Atlas:** no codex-entries list in the editor (`AtlasIndexPage` lists atlases, not entries); pin hover tooltip shows label + entry **title** only (`AtlasEditor.tsx:396-411`); no click-popup. `LinkPicker` caps at 8 matches. Wiki-link `<a class="wiki-link">` has hover preview but **no onClick** (`MarkdownView.tsx:14-40`) — link that goes nowhere.
- **Timeline list:** click → `navigate("../entries", { state: { select } })` (`TimelinePage.tsx:56-58`); `CodexPage.tsx:32-41` consumes once. Works in tests; live repro to confirm user's report (stale data? focus?). Wheel beads have **no entryId** — no way to jump to the written entry.
- **Calendar:** only `setEra/setStartingWeekday(clamped 0..6)/setMonth` exist — no add/remove month, no weekday-name editing, no weekendDays UI (`store.ts:255,1501,1511-1534`). `CustomCalendar` type already has `weekdays/weekendDays` (`types.ts:181-192`).
- **Notes:** 8 hand-rolled notepads, opened only by a plain text button in the header (`.bl-notepad` at `bloodline.css:80-87`); no hotkey, floating button hard to spot.
- **Reference:** chapter toolbar = ghost buttons ~26px, alignment group with solid active fill, "Blocks" dropdown; white paper editor on dark shell; atlas pins copy: "hover for a summary and click through to the full article".

---

### Task 1: Live reproduction sweep (dev server + screenshots)

**Files:** none (read-only investigation + `/tmp/opencode/shots/*.png`)

- [ ] **Step 1:** `npm run dev` (background, port from vite output).
- [ ] **Step 2:** Playwright: load Library → open example project → reproduce each reported bug: bindery "A coroa e o rio" click, timeline card click, manuscript (counter on load, write→preview→text, editor look, PDF via print dialog can't run — check print CSS with `EmulateMediaType('print')` instead), wheel add-event + segment click, plotboard click/pan, factions zoom, bloodline count/empty canvas/link person-house/panel overflow, codex summary + add-field + image, conlang alphabet + lexicon search spacing, notes affordance, page scroll heights. Screenshot each to /tmp/opencode/shots/.
- [ ] **Step 3:** Vision subagent reads the shots; confirm/deny hypotheses above; record corrections in this plan file before coding.

### Task 2: Shell height + canvas panels move to the right column

**Files:** Modify `src/features/workspace/workspace.css`, `src/features/wellspring/WellSpringPage.tsx`, `src/features/oaths/OathsChartPage.tsx`, `src/features/plotboard/PlotBoardPage.tsx`, `src/features/timelinecanvas/TimelineCanvasPage.tsx` + their css.

**Interfaces:** Panels become siblings of `.bl-canvas` in `.bl-body` (grid col 2). Canvas pages: `.bl-canvas` fills `100%` height, no overflow; window never scrolls.

- [ ] **Step 1 (RED):** update per-page tests: selecting a well node/oath member/plot card renders the editor in an `<aside>` **outside** `.bl-canvas` element (assert `panel.closest('[data-testid="bl-canvas"]')` is null); page root has no document scroll (`document.body` overflow stays, `.workspace-main` `height: 100dvh` style assert is brittle — instead assert class hook `data-shell="fixed"` on workspace-main and page fills it).
- [ ] **Step 2 (RED):** run `npx vitest run src/features/wellspring src/features/oaths src/features/plotboard src/features/timelinecanvas` → fail.
- [ ] **Step 3 (GREEN):**
  - workspace.css: `.workspace-main { height: 100dvh; min-height: 0; overflow: hidden; padding: 24px 28px; }` — then check codex/overview/settings/chronicles/manuscript pages in browser; add `overflow-y: auto` per page where content grows (codex `.codex` already `height:100%`).
  - Each affected page: move the `<aside class="bl-panel ...">` JSX out of `.bl-canvas` into `{selected && <aside .../>}` right after the canvas element; canvas css gets `.page .bl-body { grid-template-columns: 1fr 300px; }` already present — just stop putting the panel inside the canvas; `.bl-canvas { overflow: hidden }` keeps, add `min-height: 0`.
- [ ] **Step 4 (GREEN):** tests pass; screenshot pass in browser (panels visible at right side, window doesn't scroll).
- [ ] **Step 5:** commit `fix(panels): editores de canvas na coluna direita + página sem scroll de janela`.

### Task 3: Canvas interactions — plotboard pan/create, wheel add/select, factions zoom

**Files:** Modify `src/features/plotboard/PlotBoardPage.tsx` + test, `src/features/timelinecanvas/TimelineCanvasPage.tsx` + test, `src/features/factions/FactionWebPage.tsx` + test.

- [ ] **Plotboard (RED):** rewrite `PlotBoardPage.test.tsx` around new behavior: (a) pointerdown on empty canvas + move > 5px → pan ref updated (assert `--plane` transform changed), NO card created; (b) click without move → nothing created; (c) header "+ Add scene" button → `addCard` at view center; (d) selecting a card opens panel (sibling aside). Delete the old click-creates test + stray `console.error` lines.
- [ ] **Plotboard (GREEN):** set `pan.current = { sx, sy }` on pointerdown-empty; pointermove drains it into view translate; remove auto-create from empty pointerdown; add header button; remove dead code.
- [ ] **Wheel (RED):** tests for TimelineCanvasPage: (a) click "Add event circle" (renamed "Add event") → a bead exists AND is the selected bead (`BeadPanel` visible); bead spawned at current-view center (store x between 0 and 8000 given default view) ; (b) `firePointer` on a `tl-seg` → segment editor branch renders (rename to `seg-panel`); (c) existing segment edit fields work.
- [ ] **Wheel (GREEN):** compute spawn point from current view state + canvas size (need `viewToCanvas(center)` — reuse `fromClient` math already in page); auto-select new bead; wire `onPointerDown` on segments → `setSelected({kind:"segment", id})`; panel keys off discriminated selection; drop the double `moveBead` call + `void d.sxCanvas`.
- [ ] **Factions (RED):** test: wheel zoom changes node scale (or `zoomBy` button changes transform); new buttons −/%/+ present.
- [ ] **Factions (GREEN):** add `onWheel` handler (passive:false via ref effect, copy atlas pattern) + header zoom −/%/+ controls with existing `scale` state (clamp 0.1–8, anchor at cursor or center for buttons).
- [ ] **Commit:** `fix(canvas): pan na plotboard, criação por botão, wheel segmentos clicáveis, zoom em factions`.

### Task 4: Bloodline fixes

**Files:** Modify `src/domain/types.ts`, `src/data/schema.ts`, `src/data/seed.ts` (houseId links), `src/data/store.ts` (optional `setPersonHouses`/pass houseId in addPerson), `src/features/bloodline/BloodlinePanel.tsx`, `NodesLayer.tsx`, `bloodline.css` + tests.

- [ ] **(RED):** (a) label test: HousePanel header shows `N pessoas · M casas` of this bloodline; (b) seed: every demo person has `houseId` of a seeded house; `validateProjectData` accepts `houseId` referencing that bloodline's house; (c) PersonPanel shows a "House" `<select>` listing the bloodline's houses + "—/none" and commits `houseId`; person card shows house name; (d) CSS: `.bl-panel { overflow-x: hidden } .tenure-row > * { min-width: 0 }` — assert in a class-existence smoke test is weak; assert computed no horizontal overflow via a JSDOM proxy? Skip brittle: assert inputs get `w100` class (`width:100%`) that CSS sets.
- [ ] **(GREEN):** implement; live-repro the "empty canvas with 7 people" claim during Task 15 sweep; if reproduction shows a render/fit bug, fix + new test.
- [ ] **Commit:** `feat(bloodline): pessoa↔casa, contadores claros, overflow do painel`.

### Task 5: Manuscript editor redesign + prologue/epilogue + counter

**Files:** Modify `src/features/manuscript/ChapterEditor.tsx`, `ChapterList.tsx`, `ManuscriptPage.test.tsx`, `ChapterEditor.test.tsx`, `book.css`, new util `src/features/manuscript/words.ts`.

- [ ] **(RED):** (a) `words.ts`: `countWords(html)` strips tags + entities (e.g. `"<p>A</p><p>B</p>"` → 2; `"Quero-café"` → 1? decide: split on whitespace, same as list). ChapterList + footer use it. Test list rows count from tag-stripped content after a rich commit; (b) label test: note inputs' labels say `Prologue` / `Epilogue` (aria-label), they are rich contenteditable divs (data-testid `rich-note-top` / `rich-note-end`), typing commits html to `noteTop/noteEnd`; empty → field optional (no required markers).
- [ ] **(GREEN):** create `words.ts` (regex strip: `<[^>]*>` → " ", decode `&nbsp;` `&amp;` basic entities, collapse spaces); swap counters; convert the two note fields to contenteditable reusing `RichToolbar` (extract toolbar into editor-local prop-driven component; execCommand same path).
- [ ] **Editor look (CSS, no unit test — verified by screenshot + class presence smoke tests):** paper surface: `.book-body-rich { background:#fbf9f4; color:#241f17; border:1px solid var(--line); border-radius:8px; padding:32px 44px; max-width:none; line-height:1.7; font-family: Georgia, serif; min-height: 420px; box-shadow: inset 0 0 0 1px #00000010 }`, heading input styled as paper header; toolbar: `.rich-toolbar { position: sticky; top: 0; display:flex; gap:2px; background: var(--night); border:1px solid var(--line); border-radius:8px 8px 0 0; padding:4px 8px; z-index: 2 }`, `.rich-toolbar > button { width:28px; height:26px; border:0; border-radius:4px; background:transparent; color:#aaa; cursor:pointer }` hover/active fills (`:hover{background:#ffffff14;color:#fff}`, `.active / :focus` purple fill `rgb(124,92,191)`), groups separated with 1px divider spans, `.rich-blocks { width:auto; padding:0 10px; font-size:12px }`, `.rich-blocks-pop { position:absolute; background:var(--night-2); border:1px solid var(--line); border-radius:6px; padding:4px; z-index:10 }`. ChapterList rows + footer styled minor. Keep `.book-body` (old textarea class) for the preview mode? Preview is `.book-body`? Verify current mode markup; restyle preview as paper too.
- [ ] **Commit:** `feat(manuscript): papel-editor claro, prólogo/epílogo rico, contador de palavras honesto`.

### Task 6: Manuscript PDF first-page + preview-loss robustness

**Files:** Modify `src/features/manuscript/book.css` (print rules), `buildBook.ts` (break classes), `ChapterEditor.tsx` (commit-on-mode-switch + beforeunload), `export.test.tsx`, `ChapterEditor.test.tsx`.

- [ ] **(RED):** (a) export.test: rendered `print-book` output contains NO adjacent siblings pair where first has class `front-matter` (with break-after) and second `.chapter` (break-before) when title page + toc enabled — assert via DOM traversal of `doc.querySelector('.print-book').children`; (b) ChapterEditor test: typing (execCommand-free `element.dispatchEvent(markInput)`) then clicking Preview button → store `chapter.content` updated **synchronously** at click time (act + immediate assert, no timers).
- [ ] **(GREEN):** book.css print: replace stacked `break-after/before` with single-side breaks (`title-page: break-after: page; .toc: break-after: page; .chapter + .chapter: break-before: page; .chapter:first-of-type: break-before: page only if front matter present`); buildBook drops duplicate breaks; ensure `@media print { .print-book { display:block } }` also on export path. ChapterEditor: `setMode(false)` calls `commitRichNow()` directly from the live `bodyRef.current` (not stored closures) before rendering preview; add `beforeunload` flush.
- [ ] **Live check:** browser print emulation screenshot of first page has content.
- [ ] **Commit:** `fix(manuscript): PDF sem página em branco + commit determinístico antes do preview`.

### Task 7: Entry deep links (?e=) + click-through everywhere

**Files:** Modify `src/features/entries/CodexPage.tsx` (+ test), `src/features/timeline/TimelinePage.tsx` (+ test), `src/features/entries/MarkdownView.tsx` (+ test if exists), `src/features/manuscript/buildBook.ts` + `BinderyPage.tsx` (glossary rows clickable), `src/features/bloodline/wheel? no — wheel in Task 8`.

**Interfaces:** `CodexPage` accepts `?e=<entryId>` (`useSearchParams`), sets selection on mount/param change; all link surfaces navigate to `../entries?e=${id}`.
- [ ] **(RED):** (a) test: render `/p/p1/entries?e=<e2id>` → e2 selected; (b) wiki-link click navigates to `entries?e=target` (test via MemoryRouter history assert); (c) bindery DOM: glossary tr render `<a class="gloss-row" href="../entries?e=…">`.
- [ ] **(GREEN):** implement; TimelinePage switches `navigate("../entries?e=" + id)` (keep state for back-compat? drop state, one path).
- [ ] **Live repro note:** re-verify the bindery/"A coroa e o rio" click from Task 1 report against actual root cause; if stale-data was the cause, ALSO add a guard (BinderyPage toast already exists — ensure no dead page: render a "Manuscript not found" fallback + link back instead of `return null`).
- [ ] **Commit:** `feat(links): deep-links de entries (?e=) e click-through em wiki/termos/timeline`.

### Task 8: Timeline wheel bead → entry link

**Files:** Modify `src/domain/types.ts` (TimelineBead: `entryId?: string`), `src/data/schema.ts`, `src/data/seed.ts` (guerra bead → guerra entry), `src/features/timelinecanvas/TimelineCanvasPage.tsx` (BeadPanel LinkPicker + preview), + tests.

- [ ] **(RED):** schema accepts bead with `entryId` referencing an entry of the same project; seed guerra bead gets `entryId: eWar`; BeadPanel shows "Tome entry"`LinkPicker` (reuse `atlas/panels/LinkPicker` — it's generic already: props?; if coupled to atlas, generalize signature or duplicate minimal picker inside timelinecanvas file — decision at implementation, ≤40 lines) + "Open in codex" button navigating `../entries?e=`; bead click already selects — after link set, bead label click ALSO opens the preview popup with blurb + open button (same popup component as Task 9 — shared file `src/ui/EntryPreview.tsx` produced THERE; this task consumes it; implement Task 9's component first if needed, or inline the component here and Task 9 dedupes).
- [ ] **(GREEN):** implement + store `updateBead` accepts entryId (add patch merge).
- [ ] **Commit:** `feat(wheel): bead ligado a entry + abrir no codex`.

### Task 9: Atlas — entry list + pin/region preview popup

**Files:** Create `src/ui/EntryPreview.tsx` (+ css in ui.css or own file); Modify `src/features/atlas/panels/LinkPicker.tsx`, `PinPanel.tsx`, `RegionPanel.tsx`, `AtlasEditor.tsx`, `atlas.css` + `pins.test.tsx`/`indexAndPickers.test.tsx`.

**Interfaces:** `EntryPreview({ entryId, projectId, onOpen })` → card (title, category chip, 140-char blurb from summary||body, "Open in codex"); consumed by Atlas pin/region popup + wheel bead (Task 8).
- [ ] **(RED):** (a) LinkPicker renders FULL entry list (count assert: all entries visible without searching, scrollable container instead of 8-cap); (b) clicking a pin (no drag) shows popup with the linked entry's title + blurb text + "Open in codex" link; (c) region same; clicking "Open in codex" navigates to `../entries?e=`.
- [ ] **(GREEN):** implement; popup positioned near pointer/pin inside counter-transformed DOM overlay; Esc/outside click closes.
- [ ] **Commit:** `feat(atlas): lista de entries no LinkPicker + popup de preview em pin/região`.

### Task 10: Codex — summary block, add field/section css, category icons, image focal, custom categories

**Files:** Modify `src/features/entries/EntryView.tsx`, `codex.css`, `categories.ts`, `src/domain/types.ts`, `schema.ts`, `store.ts`, `EntryList.tsx`, seed (unchanged) + `CodexPage.test.tsx`.

- [ ] **(RED):** (a) summary: filled entry renders excerpt (`.codex-summary-hint` shows the text, NOT `Add a short blurb...`); CSS classes exist in codex.css (grep test: file contains `.codex-summary-hint` rule — use a tiny `readFileSync` assertion? Prefer behavior test only: filled → excerpt; empty → prompt); (b) add-field/section: buttons carry `data-variant="ghost"` and a `.codex-section` block has border class — behavior test: section add creates visible section `article` with name input focused; (c) category selector options show `${icon} ${label}` (assert first option text starts with emoji); (d) focal: cover `img` at entry with `focal=[0.2, 0.6]` has inline `object-position: 20% 60%`; drag-on-cover (firePointer down+move) sets focal (store entry.focal updated); schema accepts it; (e) custom category: `updateProject(p, { customCategories: [...existing, { key: "religion", label: "Religion", icon: "🕯️" }] })` → EntryView select shows "🕯️ Religion"; selecting it on an entry persists `entry.category: "religion"` (schema relaxed: category string matches known or custom list); "New kind" modal (name + emoji + color) adds it; EntryList chip shows custom kinds.
- [ ] **(GREEN):** implement in order e ← d ← c ← b ← a; categoryDef resolver: `def(category) → CODEX_CATEGORIES.match ?? project.customCategories.match ?? generic fallback` (label fallback to raw key, icon default "📜", color default var(--gold)).
- [ ] **Commit split:** `feat(codex): resumo honesto` / `feat(codex): seções e botões alinhados ao tema` / `feat(codex): categorias customizadas + enquadramento de imagem`.

### Task 11: Conlang — letter editing + lexicon spacing

**Files:** Modify `src/features/conlang/ConlangPage.tsx`, `conlang.css`, `ConlangPage.test.tsx`.

- [ ] **(RED):** (a) GlyphEditor has `aria-label="Represents letter"` input; typing `K` commits `updateGlyph(g, {char:"K"})`; duplicate char rejected with toast (reuse store validation `addGlyph`'s); (b) lexicon page has `bl-body-full` class → define `.conlang-page .bl-body { display: block }` in conlang.css — test via live page screenshot (jsdom can't); behavior test instead: render page, assert `document.querySelector(".conlang-table")` fills width (assert class on ancestor `.bl-body-full` present in CSS: read conlang.css and assert it contains `.bl-body-full` rule — cheap but brittle; prefer browser visual + a class hook `data-full="true"`).
- [ ] **(GREEN):** add input with duplicate check; define `.bl-body-full` + `.conlang-page { height: 100%; }`; verify search-row spacing live (Task 1 repro decides exact culprit).
- [ ] **Commit:** `feat(conlang): letra editável no glifo + lexicon sem coluna fantasma`.

### Task 12: Configurable calendar

**Files:** Modify `src/features/calendar/CalendarPage.tsx` (ConfigPopover), `src/data/store.ts`, `calendar.css`, `CalendarPage.test.tsx`.

- [ ] **(RED):** store tests: `setWeekdays(calId, ["First","Second","Third"])`, `setWeekendDays(calId, [0,2])`, `addMonth(calId, "Month", 25)`, `removeMonth(calId, i)` — removeMonth deletes events whose month key ≥ index? NO — invalid events (month key out of range) must be pruned (validateProjectData would flag): removeMonth prunes `events` keys with that month. Tests assert prune.
- [ ] **(GREEN):** implement 4 store actions + ConfigPopover UI (weeks row inputs, weekend checkboxes, months list with ✕, "+ month" row name+days).
- [ ] **Commit:** `feat(calendar): calendário configurável (meses, weekdays, weekend)`.

### Task 13: Notes discoverability

**Files:** Modify the 8 notepad buttons (`WellSpringPage`, `OathsChartPage`, `PlotBoardPage`, `TimelineCanvasPage`, `CalendarPage`, `FactionWebPage`, `ConlangPage`, `BloodlineCanvas`) + `bloodline.css` (`.bl-notepad` styles).

- [ ] **Change:** header button becomes labeled icon-button `Notepad` with state styling (`aria-pressed`, subtle border, shows `•` when notes non-empty? NO — keep simple: text "Notes ✎", pressed = filled); keydown `n` toggles (page-level keydown listener while page mounted, ignore when typing in inputs/contenteditable). Uniform `.bl-notepad { top: 56px; right: 16px; max-width: 320px; max-height: 40vh }` so it never clips top.
- [ ] **Commit:** `fix(notes): affordance visível para notas de quadro`.

### Task 14: 1vh sweep verification (case by case)

**Files:** css touch-ups only after Task 2's structural change.

- [ ] Playwright each page (overview, codex, entry view, atlas editor, timeline, bloodline, factions, calendar, plotboard, linewheel, oaths, wellspring, conlang, manuscript, bindery, chronicles/settings/profile/updates from Library): `document.scrollingElement.scrollTop === 0` after load and after opening panels; internal scroll areas behave. Fix page-specific `height` declarations (`100vh` → `100%`/`calc(100dvh - X)` per page where the shell change left gaps).
- [ ] Commit: `fix(shell): alturas de página alinhadas ao viewport`.

### Task 15: Final verification + report

- [ ] Full `npm run lint && npm test && npm run typecheck`.
- [ ] Browser sweep with screenshots of every fixed surface; vision subagent double-checks visual regressions.
- [ ] Final commit + summary to user (PT), mapping each feedback line → resolution.