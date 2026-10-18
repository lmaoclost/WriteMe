# Feedback Round 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 6-item follow-up: timeline default filter, timeline dates via custom calendar, board panel header truncation, calendar config popover overflow, bloodline house drag, timeline-canvas offscreen beads.

**Architecture:** Same canvas-board app; changes are presentational + one small date-formatting helper in `domain/dates.ts`. Drag mechanics copied from PersonNode; fit-to-content copied from BloodlineCanvas/FactionWebPage.

**Tech Stack:** unchanged (React 19, zustand, Tailwind v4, vitest).

## Global Constraints

- Same as round 2: EN copy in entry editor, PT copy on boards; per-feature history push before drags; gates `npm run typecheck && npm run lint && npm test -- --run`.
- Worktree: `feedback-round-3`. Baseline: 707 tests green.

---

### Task 1: Timeline list — "Tudo" is the default view

`TimelinePage` defaults `onlyEvents=true`; non-event entries (like the faction "Casa Vellmor") are hidden until "Tudo" is clicked.

**Files:** Modify `src/features/timeline/TimelinePage.tsx:32`; Test `src/features/timeline/TimelinePage.test.tsx`

- [ ] RED: test "non-event dated entries show by default" — entry category "faction" with date renders its timeline-card without clicking anything.
- [ ] GREEN: `useState(true)` → `useState(false)`.
- [ ] Run: `npm test -- --run src/features/timeline/`. Commit: `timeline: default to showing everything`.

### Task 2: Timeline list — dates follow the configured calendar

User ruling: month name by month-index position + era suffix. `"1200-05-10"` + calendar `{ months: [...5th = "Vela"], era: "Contagem do Arco" }` → `10 Vela 1200 · Contagem do Arco`. Partial dates drop parts (`"1200-05"` → `Vela 1200 · …`; `"1200"` → `1200 · …`). No calendar configured → current PT formatting. Project's FIRST calendar is the source (most users configure one).

**Files:**
- Modify: `src/domain/dates.ts` (new `formatDateWithCalendar(clean: string, cal?: { months: { name: string }[]; era?: string }): string`)
- Modify: `src/features/timeline/TimelinePage.tsx` (select project calendar; use the new formatter in the row label + left date column)
- Test: `src/domain/dates.test.ts`, `src/features/timeline/TimelinePage.test.tsx`

`formatDateWithCalendar(clean, cal)`:
```ts
export function formatDateWithCalendar(clean: string, cal?: { months: { name: string }[]; era?: string }): string {
  if (!cal) return formatDate(parseParts(clean) as ...); // reuse existing
  const [y, m, d] = parseDateParts(clean);
  const era = cal.era ? ` · ${cal.era}` : "";
  const monthName = m != null ? cal.months[(m - 1) % cal.months.length]?.name ?? null : null;
  return [d != null && monthName ? `${d} ${monthName}` : monthName, `${y}`, era].filter(Boolean).join(" ");
}
```
(Exact shape follows `formatDate`'s internals — read `src/domain/dates.ts` first and reuse its parser; no duplication.)

- [ ] RED: unit tests — full/partial/no-calendar/month-index-wraps-modulo. Component test — seeded calendar + dated entry shows calendar rendering.
- [ ] GREEN + full file run + commit: `timeline: readable dates follow the custom calendar`.

### Task 3: Board chrome — panel headers truncate instead of clipping

`BOARD_PANEL_HEAD_H2` ("Aldric Vellmor" + Delete) has no min-width cap → long titles push the action button out of the panel; `overflow-x-hidden` then clips it.

**Files:** Modify `src/ui/board.ts:9` (H2 gains `min-w-0 truncate`); Test `src/features/bloodline/BloodlinePanel.test.tsx` (selected person with 40-char name: delete button fully inside panel bounds is unassertable in jsdom → assert H2 class + store-driven text unchanged; plus a board-level regression that `aria-label="Delete person"` remains reachable via getByLabelText — meaning it kept its accessible size/position semantics).

Practical RED test: assert `document.querySelector(".bl-panel h2")` (or `BOARD_PANEL_HEAD_H2` consumer) has class `truncate`. Class-presence is the app's own convention for responsive rules (see `max-[720px]` tests).

- [ ] RED → GREEN → `npm test -- --run src/features/bloodline/` → commit `ui: truncate board panel headers`.

### Task 4: Calendar config popover — never wider than the viewport

ConfigPopover (`CalendarPage.tsx:212`): `absolute top-[60px] right-[320px] z-45 w-[280px]` — on stacked/narrow layouts it hangs off-screen and inner `<input>`s (no `w-full`) have ~170px min-content, blowing the 280px row into horizontal scroll.

**Files:** Modify `src/features/calendar/CalendarPage.tsx` (popover root + the two `<ul>` grids + new-month row); Test `src/features/calendar/CalendarPage.test.tsx`

Root:
```tsx
className="absolute top-[60px] right-[320px] z-45 w-[280px] max-w-[calc(100vw-1.5rem)] max-[720px]:inset-x-3 max-[720px]:w-auto max-[720px]:right-3 max-[720px]:top-[52px] max-h-[70vh] overflow-y-auto bg-night-2 border border-line rounded-lg p-3.5 grid gap-2.5"
```
Lists: append `[&_input]:w-full [&_input]:min-w-0` to the weekdays `<ul>` and months `<ul>`; add the same to the `+ Month` row inputs.

- [ ] RED: open config popover, assert `cal-config` classList contains `max-[720px]:inset-x-3` and each month-name input has class `w-full`.
- [ ] GREEN + run + commit `calendar: config popover fits narrow viewports`.

### Task 5: Bloodline — house nodes drag like persons

`moveHouse(id, x, y)` exists in the store (`store.ts:1205`); HouseNode only selects.

**Files:** Modify `src/features/bloodline/NodesLayer.tsx` (HouseNode gains `onDragStart/onDragMove/onDragEnd?` + PersonNode's window-listener drag), `src/features/bloodline/BloodlineCanvas.tsx` (selectNode records dragBase for houses too; wire drag callbacks with `moveHouse`, pushing `pushBLHistory` on drag start — mirror persons); Test `src/features/bloodline/BloodlineCanvas.test.tsx`.

- [ ] RED: `firePointer` house-node down → move on body (window listener) → up → `house.x` changed in store.
- [ ] GREEN + run + commit `bloodline: draggable house nodes`.

### Task 6: Timeline canvas — fit content on mount + zoom controls

View starts `{ s: 0.4, panX: 100, panY: 0 }`; seed beads at `y = −40..40` render ABOVE the visible plane (dot y = 0.4×−40 < 0) → "can't click the event". Wire+content fit on mount fixes visibility/clickability; − % + / Ajustar buttons match other boards.

**Files:** Modify `src/features/timelinecanvas/TimelineCanvasPage.tsx`; Test `src/features/timelinecanvas/TimelineCanvasPage.test.tsx`

- `fitToContentNow()`: bounds over beads (x, y) + segments (fromX, toX, 200) + the wire (y=200), pad 80px; `s = Math.min(1, elW/spanX, elH/spanY)` clamped ≥0.1; `panX = elW/2 − cx*s`, `panY = elH/2 − cy*s`; run in `useEffect` on `[timelineId]` (skip when no beads/segments — keep current default view for empty).
- Header: `−` / `<span data-testid="tlc-zoom">{Math.round(view.current.s*100)}%</span>` / `+` / `Ajustar` — mutate `view.current` via same zoomAt math on `{s:1,panX:elW/2,panY:elH/2}` anchor… reuse the FactionWebPage zoomAt with elW/2, elH/2 anchor and `markDirty()`.
- Keep wheel zoom as-is.

- [ ] RED: seeded-shape timeline (bead y=−40) mounts → parse `tl-plane` transform → every bead screen center inside the 1200×800 viewport; `tlc-zoom` reads 100%.
- [ ] GREEN + run + commit `timeline: fit content on mount so beads are clickable`.

---

### Task 7: Full gate

- [ ] `npm run typecheck && npm run lint && npm test -- --run` — all green.
- [ ] Visual smoke via Playwright at 375px and 1280px (panel widths, popover, beads visible), screenshots for the user.