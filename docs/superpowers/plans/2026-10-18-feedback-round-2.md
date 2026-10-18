# Feedback Round 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 8 usability feedback items from the user's app test round: codex date label, quick-fact rename, bloodline house roster, bloodline responsive layout, calendar arbitrary week length, preset-color mismatch, timeline bead → codex click-through, oaths canvas malleability.

**Architecture:** All changes live in `src/features/*` (React pages/panels) plus three tiny touch points in `src/domain/types.ts`, `src/data/store.ts` (one new action) and one new UI helper `src/ui/colors.ts`. Existing canvas patterns are reused as-is: drag from `NodesLayer.tsx` (bloodline), zoom/pan/fit + connection handle from `FactionWebPage.tsx` (factions). No new dependencies.

**Tech Stack:** Vite + React 19 + TS + zustand + Tailwind v4 (arbitrary utilities) + vitest + @testing-library/react.

## Global Constraints

- UI copy: app body is mixed EN/PT — entry editor labels are EN ("Summary", "Title"); board panels are PT ("Membros", "Casa removida."). Follow the local convention of each file you touch.
- Every store mutation that alters undo-able content goes through the feature's `pushXHistory` (component pushes before drag starts, mirroring `movePerson` in bloodline).
- Tests run with `npm test -- --run <path>`; full gate is `npm run typecheck && npm run lint && npm test -- --run`.
- Worktree: `/home/renan/.local/share/opencode/worktree/2cebc6/feedback-round-2`, branch `feedback-round-2`.
- Baseline: 59 files / 689 tests green before any change.

---

### Task 1: Codex — visible "Date" label on the date field

The field under Summary edits `entry.date` (accepts `1200` / `1200-05` / `1200-05-10`) but has no visible label — only an aria-label and the placeholder. Add a visible label styled like the Summary toggle label.

**Files:**
- Modify: `src/features/entries/EntryView.tsx:242-253`
- Test: `src/features/entries/EntryView.test.tsx`

**Interfaces:**
- Produces: nothing consumed by other tasks. Pure presentational change; `aria-label="Date"` stays.

- [ ] **Step 1: Write the failing test**

Open `src/features/entries/EntryView.test.tsx`, copy the entry-creation setup from its first test (the way it builds a `WorldEntry` and renders `<EntryView ... />`), and append:

```tsx
it("shows a visible Date label next to the date input", () => {
  render(/* same wrapper/setup as the first test, entry with title "Casa" */);
  expect(screen.getByText("Date")).toBeInTheDocument();
  expect(screen.getByLabelText("Date")).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/features/entries/EntryView.test.tsx`
Expected: FAIL — `getByText("Date")` throws (no visible label exists).

- [ ] **Step 3: Implement**

In `EntryView.tsx`, the row at lines 242-253 becomes:

```tsx
<div className="flex items-center gap-2.5 flex-wrap">
  <span className="codex-date-label text-[10px] tracking-[0.12em] uppercase text-slate">Date</span>
  <input
    type="text"
    className="codex-date-input font-mono text-[13px] text-parchment bg-ink border border-line rounded-lg px-2.5 py-1.5 outline-none focus:border-gold placeholder:text-slate"
    aria-label="Date"
    title="Year · Year-Month · Year-Month-Day, e.g. 1200 · 1200-05 · 1200-05-10"
    placeholder="1200 · 1200-05 · 1200-05-10"
    value={dateDraft.draft}
    onChange={(e) => dateDraft.setDraft(e.target.value)}
    onBlur={dateDraft.flush}
  />
  {dateInvalid ? <p className="text-[var(--ember)] text-xs m-0">Invalid date.</p> : null}
</div>
```

Only the `<span>` line and the `title` attr are new.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/features/entries/EntryView.test.tsx`
Expected: PASS (all tests in file).

- [ ] **Step 5: Commit**

```bash
git add src/features/entries/EntryView.tsx src/features/entries/EntryView.test.tsx
git commit -m "codex: visible Date label on date field"
```

---

### Task 2: Codex — editable quick-fact field labels

Quick-fact labels are a fixed `<span>`; "+ field" hardcodes `{ label: "New Field", content: "" }`. Make labels editable inputs so a user can write "Terreno" etc.

**Files:**
- Modify: `src/features/entries/EntryView.tsx:320-325, 427-462`
- Test: `src/features/entries/EntryView.test.tsx`

**Interfaces:**
- Produces: new `SectionBlock` prop `onRenameField(fi: number, label: string): void` (same commit-through-`updateEntry` style as `onField`).

- [ ] **Step 1: Write the failing test**

```tsx
it("lets the user rename a quick-fact field label", () => {
  // setup: entry whose sections = [{ name: "Quick Facts", fields: [{ label: "Clima", content: "arido" }] }]
  // render same wrapper as the first test
  const input = screen.getByLabelText("Field label Clima") as HTMLInputElement;
  fireEvent.change(input, { target: { value: "Terreno" } });
  const stored = useScriptorium.getState().entries.find((e) => e.id === entryId)!;
  expect(stored.sections![0].fields[0].label).toBe("Terreno");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/features/entries/EntryView.test.tsx`
Expected: FAIL — `getByLabelText("Field label Clima")` finds nothing (label is a span).

- [ ] **Step 3: Implement**

In `EntryView.tsx`:

1. `onAddField` (line ~322): `{ label: "New Field", content: "" }` → `{ label: "New field", content: "" }`.

2. Pass the new handler where `SectionBlock` is rendered (after `onField`):

```tsx
onRenameField={(fi, label) => {
  const sections = (entry.sections ?? []).map((s, j) => j === si
    ? { ...s, fields: s.fields.map((f, k) => (k === fi ? { ...f, label } : f)) }
    : s);
  useScriptorium.getState().updateEntry(entry.id, { sections });
}}
```

3. `SectionBlock` signature gains `onRenameField` in the props type block, and the label cell (line ~448-449) becomes:

```tsx
<div className="codex-field-label-row min-w-0 pt-[3px]">
  <input
    className="codex-field-label bg-none border border-transparent rounded-md text-[11px] uppercase tracking-[0.08em] text-slate px-0.5 min-w-0 hover:border-line focus:border-gold-dim outline-none"
    aria-label={`Field label ${f.label}`}
    placeholder="Label"
    value={f.label}
    onChange={(e) => onRenameField(fi, e.target.value)}
  />
  <button ... existing remove button unchanged ... />
</div>
```

(`min-w-0` + `bg-none border-transparent` keep the 130px grid column and the existing visual.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/features/entries/EntryView.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/entries/EntryView.tsx src/features/entries/EntryView.test.tsx
git commit -m "codex: editable quick-fact field labels"
```

---

### Task 3: Bloodline — house roster in panel + member count on node

`person.houseId` exists but the house side is blind: HousePanel shows only global counts and HouseNode shows nothing. Persons of a house must be visible, and clicking a roster entry must select that person on the canvas.

**Files:**
- Modify: `src/features/bloodline/BloodlinePanel.tsx:313-354` (HousePanel)
- Modify: `src/features/bloodline/NodesLayer.tsx:67-87` (HouseNode)
- Modify: `src/features/bloodline/BloodlineCanvas.tsx:121-124` (pass count)
- Test: `src/features/bloodline/BloodlinePanel.test.tsx`, `src/features/bloodline/BloodlineCanvas.test.tsx`

**Interfaces:**
- Produces: `HouseNode` gains required prop `memberCount: number` (existing callers updated in same task).

- [ ] **Step 1: Write the failing tests**

In `BloodlinePanel.test.tsx` (reuse its existing setup that renders a bloodline with a house and selects it):

```tsx
it("house panel lists the persons belonging to the house and focuses them", () => {
  // existing setup + two persons, both houseId = house.id, names "Aurane" and "Kelve"
  fireEvent.click(screen.getByTestId("house-node")); // or however the first test selects the house
  const panel = document.querySelector("[data-testid=bl-panel]")!;
  expect(panel.textContent).toContain("Membros da casa");
  expect(screen.getByRole("button", { name: /aurane/i })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /kelve/i }));
  expect(document.querySelector("[data-selected-id]")?.getAttribute("data-selected-id")).toBe(kelveId);
});
```

In `BloodlineCanvas.test.tsx`:

```tsx
it("house node shows its member count", () => {
  // house with 2 attached persons
  const node = screen.getByTestId("house-node");
  expect(node.textContent).toContain("2 membros");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run src/features/bloodline/`
Expected: FAIL — no "Membros da casa" text, no "2 membros".

- [ ] **Step 3: Implement**

`NodesLayer.tsx` — HouseNode signature and body:

```tsx
export function HouseNode({ house, selected, memberCount, onSelect }: {
  house: BloodlineHouse;
  selected: boolean;
  memberCount: number;
  onSelect(): void;
}) {
  return (
    <div ... existing attrs ... >
      <span className="house-name text-sm font-semibold text-parchment">{house.name}</span>
      {house.subtitle ? <span className="house-subtitle text-[11px] text-slate">{house.subtitle}</span> : null}
      <span className="house-count text-[10px] text-slate" data-testid="house-member-count">
        {memberCount} {memberCount === 1 ? "membro" : "membros"}
      </span>
      {house.isMonarch ? <span className="house-crown absolute -top-4 right-1.5 text-gold" aria-hidden="true">♛</span> : null}
    </div>
  );
}
```

`BloodlineCanvas.tsx` line ~121-123:

```tsx
<HouseNode key={h.id} house={h} selected={h.id === selectedId}
  memberCount={bloodline.persons.filter((p) => p.houseId === h.id).length}
  onSelect={() => selectNode(h.id)} />
```

`BloodlinePanel.tsx` HousePanel — inside the component, before `return`, add:

```tsx
const members = bloodline.persons.filter((p) => p.houseId === house.id);
```

and after the two checkboxes (before the global counts `<p>`):

```tsx
<section className="border-t border-line mt-3.5 pt-2.5 grid gap-2">
  <h3>Membros da casa</h3>
  {members.length === 0 ? <p className="text-slate text-[13px] italic">Nenhum membro.</p> : null}
  <ul className="titles-list list-none m-0 p-0 grid gap-1 [&_li]:flex [&_li]:justify-between [&_li]:items-center [&_li]:gap-2 [&_li]:text-[13px] [&_li]:text-parchment-dim">
    {members.map((p) => (
      <li key={p.id}>
        <button
          type="button"
          className="bg-none border-0 text-parchment-dim text-[13px] py-0.5 cursor-pointer hover:text-gold"
          onClick={() => onSelect(p.id)}
        >{p.name || "Sem nome"}</button>
      </li>
    ))}
  </ul>
</section>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run src/features/bloodline/`
Expected: PASS (whole folder green; `memberCount` prop is required so TS forces the caller update).

- [ ] **Step 5: Commit**

```bash
git add src/features/bloodline/
git commit -m "bloodline: house roster panel + member count on house node"
```

---

### Task 4: Bloodline — responsive stacking of canvas + panel

The editor wrapper is `grid grid-cols-[1fr_300px]` with no narrow-screen override, so the 300px panel column survives on small viewports and dense inputs clip (overflow-x-hidden). Mirror the Codex pattern.

**Files:**
- Modify: `src/features/bloodline/BloodlineCanvas.tsx:104`
- Test: `src/features/bloodline/BloodlineCanvas.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it("stacks canvas and panel below 720px", () => {
  // render existing test setup (any bloodline)
  const wrapper = document.querySelector("[data-testid=bloodline-page] > div:last-of-type") as HTMLElement;
  expect(wrapper.className).toContain("max-[720px]:grid-cols-1");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/features/bloodline/BloodlineCanvas.test.tsx`
Expected: FAIL — class not present.

- [ ] **Step 3: Implement**

Line 104 becomes:

```tsx
<div className="grid grid-cols-[1fr_300px] min-h-0 overflow-hidden max-[720px]:grid-cols-1 max-[720px]:grid-rows-[45vh_minmax(0,1fr)]">
```

Effect: below 720px it stacks — canvas takes fixed 45vh on top, panel fills the rest and scrolls (`BOARD_PANEL` already has `overflow-y-auto`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run src/features/bloodline/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/bloodline/BloodlineCanvas.tsx src/features/bloodline/BloodlineCanvas.test.tsx
git commit -m "bloodline: stack canvas and panel on narrow screens"
```

---

### Task 5: Calendar — week width derived from weekdays (N-day weeks)

Header and day grids are hardwired `grid-cols-7`; with a custom list of e.g. 5 weekdays the layout breaks (header squeezed, days misaligned). Derive columns from `cal.weekdays.length` and pad the month grid with leading/trailing blanks so every date falls under its weekday header.

**Files:**
- Modify: `src/features/calendar/CalendarPage.tsx:34-35, 61-94`
- Test: `src/features/calendar/CalendarPage.test.tsx`

**Interfaces:**
- Consumes: existing `CustomCalendar { weekdays: string[], startingWeekday: number }`.
- Produces: `<span data-testid="cal-blank">` filler cells (test hook only).

- [ ] **Step 1: Write the failing test**

In `CalendarPage.test.tsx`, reuse its calendar-creation helper; build a calendar with 5 weekdays and `startingWeekday = 2`, months `[{ name: "Alvor", days: 9 }]` (check the helper's shape in the first test; the store API is `addCalendar(projectId, name, {...})` — match what the file already does):

```tsx
it("sizes week rows by the weekday count and pads month starts", () => {
  // calendar with 5 weekdays, startingWeekday 2, one month with 9 days
  const grid = document.querySelector("[data-testid=cal-month] .grid.gap-0\\.5:nth-of-type(2)") as HTMLElement;
  expect(grid.style.gridTemplateColumns).toBe("repeat(5, minmax(0, 1fr))");
  const blanks = screen.getAllByTestId("cal-blank");
  expect(blanks).toHaveLength(2 + (5 - ((2 + 9) % 5)) % 5); // leading 2, trailing 3, across 1 month
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/features/calendar/CalendarPage.test.tsx`
Expected: FAIL — `gridTemplateColumns` is empty and no blank cells exist.

- [ ] **Step 3: Implement**

In `CalendarPage.tsx`:

1. After `firstWeekday` (line 35), add `const n = cal.weekdays.length;`

2. Header grid (line 64):

```tsx
<div className="grid gap-0.5 mb-1" aria-hidden="true" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
```

3. Days grid (line 69) — same inline style, plus padding cells:

```tsx
<div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
  {Array.from({ length: firstWeekday }, (_, i) => (
    <span key={`pad-s-${i}`} data-testid="cal-blank" aria-hidden="true" className="cal-blank aspect-square rounded-sm" />
  ))}
  {/* existing days Array.from unchanged */}
  {Array.from({ length: (n - ((firstWeekday + m.days) % n)) % n }, (_, i) => (
    <span key={`pad-e-${i}`} data-testid="cal-blank" aria-hidden="true" className="cal-blank aspect-square rounded-sm" />
  ))}
</div>
```

Note on semantics: the current `wd = (firstWeekday + di) % n` restarts every month (each month begins on `startingWeekday` shifted by elapsed year-days) — the blank cells make the grid columns AGREE with that formula, they don't change it. Weekend shading keeps working because it goes through the same `wd`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run src/features/calendar/CalendarPage.test.tsx`
Expected: PASS — also verify the old 7-day tests stay green (no regression: with 7 weekdays and startingWeekday 0, `firstWeekday=0` → zero leading blanks, identical output).

- [ ] **Step 5: Commit**

```bash
git add src/features/calendar/CalendarPage.tsx src/features/calendar/CalendarPage.test.tsx
git commit -m "calendar: week rows follow weekday count, align month starts"
```

---

### Task 6: Colors — always show the current color as a selectable swatch

Cards/members/events seeded (or created with defaults) use colors outside the preset arrays, so NO swatch shows `aria-selected`. Fix once with a helper, apply everywhere a swatch list renders, and add the missing faction default to its preset list.

**Files:**
- Create: `src/ui/colors.ts`, `src/ui/colors.test.ts`
- Modify: `src/features/plotboard/PlotBoardPanel.tsx:76-83`, `src/features/calendar/CalendarPage.tsx:161-165` (DayPanel), `src/features/timelinecanvas/TimelineCanvasPage.tsx:245-253` (BeadPanel), `src/features/oaths/OathsChartPage.tsx:195-203` (MemberForm), `src/features/factions/FactionPanel.tsx:68-80`, `src/features/factions/connectionStyles.ts:12-15`
- Test: `src/ui/colors.test.ts`, `src/features/plotboard/PlotBoardPage.test.tsx`

**Interfaces:**
- Produces: `withCurrentColor(presets: readonly string[], current: string | undefined): string[]` — presets in order, with `current` appended when missing/undefined-safe.

- [ ] **Step 1: Write the failing tests**

`src/ui/colors.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { withCurrentColor } from "./colors";

describe("withCurrentColor", () => {
  it("returns presets untouched when current is included", () => {
    expect(withCurrentColor(["#aaa", "#bbb"], "#aaa")).toEqual(["#aaa", "#bbb"]);
  });
  it("appends the current color when it is not a preset", () => {
    expect(withCurrentColor(["#aaa"], "#c9a227")).toEqual(["#aaa", "#c9a227"]);
  });
  it("handles undefined current", () => {
    expect(withCurrentColor(["#aaa"], undefined)).toEqual(["#aaa"]);
  });
});
```

`PlotBoardPage.test.tsx` addition:

```tsx
it("highlights the current swatch even for non-preset colors", () => {
  // seed board card color "#4d6f8f" (not in BOARD_PRESET_COLORS); select the card
  const selected = document.querySelector('[role="option"][aria-selected="true"]');
  expect(selected).toBeTruthy();
  expect((selected as HTMLElement).dataset.color).toBe("#4d6f8f");
});
```

Note: the plotboard swatch buttons already carry `data-color={c}` — keep that attribute in the modified map.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run src/ui/colors.test.ts src/features/plotboard/`
Expected: FAIL — module `./colors` does not exist; plotboard has no selected swatch.

- [ ] **Step 3: Implement**

`src/ui/colors.ts`:

```ts
/** Swatch list that never hides the current value: presets first, current
 *  appended when it is not one of them. Used by every color swatch row. */
export function withCurrentColor(presets: readonly string[], current: string | undefined): string[] {
  if (!current || presets.includes(current)) return [...presets];
  return [...presets, current];
}
```

Apply the same shape in all five swatch rows — wrap the `.map` source:

- `PlotBoardPanel.tsx`: `{withCurrentColor(BOARD_PRESET_COLORS, card.color).map((c) => ...`
- `CalendarPage.tsx` DayPanel: `{withCurrentColor(EVENT_PRESET_COLORS, e.color).map((c) => ...` + import from `../../ui/colors`
- `TimelineCanvasPage.tsx` BeadPanel: `{withCurrentColor(BEAD_PRESET_COLORS, bead.color).map(...`
- `OathsChartPage.tsx` MemberForm: hoist the inline array to a module const `const OATH_MEMBER_COLORS = [...]` (the 12 hexes currently inline at line 197) and use `{withCurrentColor(OATH_MEMBER_COLORS, member.color).map(...`
- `FactionPanel.tsx`: `{withCurrentColor(FACTION_PRESET_COLORS, faction.color).map(...`

`connectionStyles.ts` — add the new-faction default to the presets:

```ts
export const FACTION_PRESET_COLORS = [
  "#c0392b", "#e74c3c", "#e67e22", "#f1c40f", "#27ae60", "#2ecc71",
  "#2980b9", "#3498db", "#7c5cbf", "#8e44ad", "#2c3e50", "#34495e", "#7a7a99",
];
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run src/ui/colors.test.ts src/features/plotboard/ src/features/calendar/ src/features/timelinecanvas/ src/features/oaths/ src/features/factions/`
Expected: PASS (factions/oaths/timeline keep their existing behavior since fixture colors are mostly presets; any test asserting swatch counts gets updated to `+1` where it broke).

- [ ] **Step 5: Commit**

```bash
git add src/ui/colors.ts src/ui/colors.test.ts src/features/plotboard/PlotBoardPanel.tsx src/features/calendar/CalendarPage.tsx src/features/timelinecanvas/TimelineCanvasPage.tsx src/features/oaths/OathsChartPage.tsx src/features/factions/FactionPanel.tsx src/features/factions/connectionStyles.ts src/features/plotboard/PlotBoardPage.test.tsx
git commit -m "ui: current color always highlighted in swatch lists"
```

---

### Task 7: Timeline canvas — double-click bead opens its codex entry

Beads already store `entryId` and the side panel shows an EntryPreview with "Open in codex", but nothing on the canvas itself navigates. Add double-click on the bead → `/p/:projectId/entries?e={entryId}` (single click keeps selecting + dragging).

**Files:**
- Modify: `src/features/timelinecanvas/TimelineCanvasPage.tsx:21-45, 128-144`
- Test: `src/features/timelinecanvas/TimelineCanvasPage.test.tsx`

**Interfaces:**
- Produces: optional page prop `onOpenEntry?: (entryId: string) => void` — used by the test spy; default = `useNavigate()`.

- [ ] **Step 1: Write the failing test**

```tsx
it("double-clicking a linked bead opens the codex entry", () => {
  // setup: timeline with one bead, bead.entryId = "ent_1"
  const onOpenEntry = vi.fn();
  render(<MemoryRouter><TimelineCanvasPage timelineId={tl.id} onOpenEntry={onOpenEntry} /></MemoryRouter>);
  const bead = screen.getByTestId("tl-bead");
  fireEvent.doubleClick(bead);
  expect(onOpenEntry).toHaveBeenCalledWith("ent_1");
});

it("double-clicking an unlinked bead does nothing", () => {
  // same setup, bead without entryId
  const onOpenEntry = vi.fn();
  render(<MemoryRouter><TimelineCanvasPage timelineId={tl.id} onOpenEntry={onOpenEntry} /></MemoryRouter>);
  fireEvent.doubleClick(screen.getByTestId("tl-bead"));
  expect(onOpenEntry).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/features/timelinecanvas/TimelineCanvasPage.test.tsx`
Expected: FAIL — unknown prop `onOpenEntry` (TS) / spy never called.

- [ ] **Step 3: Implement**

1. Page signature:

```tsx
export function TimelineCanvasPage({ timelineId, onOpenEntry }: { timelineId: string; onOpenEntry?: (entryId: string) => void }) {
  const navigate = useNavigate();
  ...
```

2. The bead `<g>` (line ~129) gains the handler and a hover tooltip:

```tsx
<g key={b.id} data-testid="tl-bead" className="tl-bead"
  onPointerDown={... unchanged ...}
  onDoubleClick={() => {
    if (!b.entryId) return;
    if (onOpenEntry) onOpenEntry(b.entryId);
    else navigate(`/p/${timeline.projectId}/entries?e=${b.entryId}`);
  }}
  transform={`translate(${b.x}, ${b.y})`}>
  {b.entryId ? <title>Abre no codex</title> : null}
  ...
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run src/features/timelinecanvas/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/timelinecanvas/TimelineCanvasPage.tsx src/features/timelinecanvas/TimelineCanvasPage.test.tsx
git commit -m "timeline: double-click linked bead opens codex entry"
```

---

### Task 8: Oaths — drag, pan/zoom/fit, and in-canvas linking

Oaths is the only board without spatial freedom: positions recompute from the solver every render (no drag), no zoom/pan (large charts clip or overflow), links only via the picker. Port the factions canvas mechanics onto the oaths chart while keeping `tidyOathsChart` as the initial layout.

**Files:**
- Modify: `src/domain/types.ts` (`OathMember` gains `x?: number; y?: number`)
- Modify: `src/data/store.ts` (new action `moveOathMember(id, x, y)` next to `updateOathMember`; interface entry ~line 302)
- Modify: `src/features/oaths/OathsChartPage.tsx` (canvas mechanics)
- Test: `src/data/store-oaths.test.ts`, `src/features/oaths/OathsChartPage.test.tsx`

**Interfaces:**
- Consumes: `tidyOathsChart(members, links, opts?)` (unchanged, `src/domain/oaths.ts`); faction patterns `zoomAt`/`fitToContentNow`/drag-window-listeners.
- Produces: `moveOathMember(id: string, x: number, y: number): void` — mutates member in its chart, pushes `touchProject`, NO `pushOCHistory` (components push once at drag start, mirroring `movePerson`).

Layout rule: stored `(x, y)` wins when present; solver covers members without stored positions. New members keep solver placement until dragged.

- [ ] **Step 1: Write the failing tests**

`src/data/store-oaths.test.ts`:

```ts
it("moveOathMember persists the position", () => {
  const ch = store().addOathsChart("prj_1", "Anel");
  const m = store().addOathMember(ch.id, undefined, { name: "Mirren" })!;
  store().moveOathMember(m.id, 512, 300);
  const got = store().oathsCharts![0].members[0];
  expect(got.x).toBe(512);
  expect(got.y).toBe(300);
});
```

`OathsChartPage.test.tsx`:

```tsx
it("member position is stored on drag", () => {
  const ch = store().addOathsChart("prj_1", "Anel");
  const m = store().addOathMember(ch.id, undefined, { name: "Mirren" })!;
  render(<MemoryRouter><OathsChartPage chartId={ch.id} /></MemoryRouter>);
  const card = screen.getByTestId("oath-member");
  firePointer(card, "pointerdown", { clientX: 100, clientY: 100 });
  firePointer(document.body, "pointermove", { clientX: 200, clientY: 150 });
  firePointer(document.body, "pointerup", { clientX: 200, clientY: 150 });
  const got = store().oathsCharts![0].members[0];
  expect(got.x).not.toBeUndefined();
  expect(got.y).not.toBeUndefined();
});

it("zoom buttons update the zoom % readout", () => {
  // chart + member; initial fit lands at 100% (mock clientWidth 1200 / clientHeight 800, MIN_SPAN 600)
  // click aria-label "Zoom out" → 0.8 * 1 = 80%
  fireEvent.click(screen.getByLabelText("Zoom out"));
  expect(screen.getByTestId("oc-zoom").textContent).toBe("80%");
});

it("clicking the handle then another member creates an oath link", () => {
  const ch = store().addOathsChart("prj_1", "Anel");
  const a = store().addOathMember(ch.id, undefined, { name: "Mirren" })!;
  const b = store().addOathMember(ch.id, undefined, { name: "Orvean" })!;
  render(<MemoryRouter><OathsChartPage chartId={ch.id} /></MemoryRouter>);
  fireEvent.pointerDown(screen.getByLabelText(`Conectar ${a.name}`));
  fireEvent.pointerDown(screen.getByTestId("oath-member")); // orvember card — first match is Orvean? disambiguate via data-member-id
  const chart = store().oathsCharts![0];
  expect(chart.oathLinks.find((l) => l.superiorId === a.id && l.subordinateId === b.id)).toBeTruthy();
});
```

(Disambiguation: use `document.querySelector('[data-member-id="' + b.id + '"]')` where several member cards exist.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run src/data/store-oaths.test.ts src/features/oaths/`
Expected: FAIL — `moveOathMember` not a function; no "Conectar" label; no `oc-zoom`.

- [ ] **Step 3: Implement**

1. `types.ts` — OathMember:

```ts
export type OathMember = {
  id: Id;
  name: string;
  title?: string;
  org?: string;
  notes?: string;
  seatStatus: "held" | "vacant" | "disputed";
  color: string;
  x?: number;
  y?: number;
};
```

2. `store.ts` — inside the oaths section (next to `updateOathMember`), interface entry and implementation:

```ts
moveOathMember(id: string, x: number, y: number): void;
```

```ts
moveOathMember(id, x, y) {
  set((s) => ({
    oathsCharts: (s.oathsCharts ?? []).map((c) => ({
      ...c,
      members: c.members.map((m) => (m.id === id ? { ...m, x, y } : m)),
    })),
  }));
},
```

(Uses `oathsCharts ?? []` shape like siblings; add `projects: touchProject(...)` only if sibling actions in the same section do it — `updateOathMember` already calls `pushOCHistory`, which covers projects touch; verify at implementation and mirror `movePerson`'s minimal shape.)

3. `OathsChartPage.tsx` — port from `FactionWebPage.tsx`:

- State: `scale` + `scaleRef` (mirror lines 26-28), `pan` ref, `drag` ref `{ id, startX, startY, baseX, baseY, pushed }`, `pendingFrom: string | null` (id only; the pending line needs the from-node's position from `pos`).
- Positions merge (replaces the plain `tidyOathsChart` call at line 36, wrapped in `useMemo` on `[chart.members, chart.oathLinks]`):

```tsx
const pos = useMemo(() => {
  const base = tidyOathsChart(chart.members, chart.oathLinks, { rootX: 240, rootY: 120, levelH: 170 });
  const merged = new Map(base);
  for (const m of chart.members) {
    if (m.x != null && m.y != null) merged.set(m.id, { x: m.x, y: m.y });
  }
  return merged;
}, [chart.members, chart.oathLinks]);
```

- Header buttons between Undo/Redo and Fundador (mirror FactionWebPage 158-161):

```tsx
<button type="button" aria-label="Zoom out" className={BOARD_ACTION_BTN} onClick={() => setScale((v) => zoomAt({ ...v }, 1 / 1.25, elWidth(), elHeight()))}>−</button>
<span className="text-slate text-xs font-mono self-center" data-testid="oc-zoom">{Math.round(scale.s * 100)}%</span>
<button type="button" aria-label="Zoom in" className={BOARD_ACTION_BTN} onClick={() => setScale((v) => zoomAt({ ...v }, 1.25, elWidth(), elHeight()))}>+</button>
<button type="button" className={BOARD_ACTION_BTN} onClick={() => fitToContentNow()}>Ajustar</button>
```

`fitToContentNow` mirrors FactionWebPage:47-59 over `pos` values (MIN_SPAN 600, cap scale 1). Initial `scale = { s: 0.1, panX: 0, panY: 0 }` then fit on mount (`useEffect` on `chartId`).

- Canvas div gains `ref={stageRef}`, `onPointerDown/Move/Up` and `onWheel={onWheelZoom}` exactly like FactionWebPage 174-189 (guard `.closest(".oath-card")` and `.closest(".conn-handle")` instead of `.fac-node`), and the plane (line 64) becomes:

```tsx
<div className="absolute top-0 left-0 bg-[radial-gradient(circle_at_25%_25%,#17162a,var(--ink)_65%)] shadow-[inset_0_0_0_1px_var(--line)]" data-testid="oaths-plane"
  style={{
    width: planeSize, height: planeSize,
    transform: `translate(${scale.panX}px, ${scale.panY}px) scale(${scale.s})`,
    transformOrigin: "0 0",
  }}
>
```

with `planeSize` = same 20000 + 4000-margin formula as factions over `pos` coords, and `onWheel` copying FactionWebPage:79-89.

- Member card (lines 95-113): replace onClick with the factions pointerdown scheme + drag + handle:

```tsx
onPointerDown={(e) => {
  if (e.button !== 0) return;
  const t = e.target as Element;
  if (t.closest(".conn-handle")) return; // handle has its own handler
  if (pendingFrom) { connectTo(m.id); return; }
  e.stopPropagation();
  setSelectedId(m.id);
  drag.current = { id: m.id, startX: e.clientX, startY: e.clientY, baseX: p.x, baseY: p.y, pushed: false };
}}
```

plus `onClick={() => { if (pendingFrom) connectTo(m.id); else setSelectedId(m.id); }}` KEPT (the existing test selects with `fireEvent.click`; pointerdown handles drag+jitter, click is idempotent and covers the pending path), keep `role="button"`, `tabIndex`, `aria-label`, seat styling, and add:

```tsx
<button
  type="button"
  className="conn-handle absolute -right-2.5 top-1/2 -translate-y-1/2 size-5 rounded-full bg-gold text-wax border-0 text-[0.6875rem] grid place-items-center cursor-crosshair"
  aria-label={`Conectar ${m.name}`}
  onPointerDown={(e) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    if (!pendingFrom) setPendingFrom(m.id);
    else connectTo(m.id);
  }}
  onDoubleClick={(e) => e.stopPropagation()}
>●</button>
```

with

```tsx
const connectTo = (targetId: string) => {
  if (!pendingFrom || pendingFrom === targetId) { setPendingFrom(null); return; }
  store().addOathLink(chart.id, targetId, pendingFrom); // subordinate = target, superior = origin
  setPendingFrom(null);
};
const onCanvasMove = (e: React.PointerEvent) => {
  if (drag.current) {
    const d = drag.current;
    const dx = e.clientX - d.startX, dy = e.clientY - d.startY;
    if (Math.hypot(dx, dy) > 5) {
      if (!d.pushed) { useScriptorium.getState().pushOCHistory(chartId); d.pushed = true; }
      useScriptorium.getState().moveOathMember(d.id, d.baseX + dx / scaleRef.current.s, d.baseY + dy / scaleRef.current.s);
    }
    return;
  }
  if (pan.current) setScale((v) => ({ ...v, panX: pan.current!.basePanX + (e.clientX - pan.current!.x), panY: pan.current!.basePanY + (e.clientY - pan.current!.y) }));
};
const onCanvasDown = (e: React.PointerEvent) => {
  if (e.button !== 0) return;
  const t = e.target as Element;
  if (t.closest(".oath-card") || t.closest(".conn-handle")) return;
  if (pendingFrom) { setPendingFrom(null); return; }
  pan.current = { x: e.clientX, y: e.clientY, basePanX: scale.panX, basePanY: scale.panY };
};
const onPointerUp = () => { drag.current = null; pan.current = null; };
```

Add `data-fac-id`-equivalent `data-members-id={m.id}` is NOT needed — `data-member-id={m.id}` already exists on cards; pending connector line renders inside the links `<svg>`:

```tsx
{pendingFrom ? (() => {
  const from = pos.get(pendingFrom);
  const cursorLast = cursor ?? null; // track like factions: setCursor on canvas move when pendingFrom
  if (!from || !cursorLast) return null;
  return <line data-testid="pending-oath" x1={from.x} y1={from.y} x2={cursorLast.x / scaleRef.current.s} y2={cursorLast.y / scaleRef.current.s} className="[stroke:var(--gold)] [stroke-width:2] [stroke-dasharray:6_6]" />;
})() : null}
```

(cursor state + crosshair style on the canvas while pending — copy FactionWebPage:32-33,96-101,173.)

The panel picker in `MemberForm` stays as the keyboard alternative. Solver file unchanged.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run src/data/store-oaths.test.ts src/features/oaths/`
Expected: PASS. Existing tests "panel sits beside the canvas" (asserts `grid-cols-[1fr_300px]` wrapper) stay valid — do not touch the outer grid in this task.

- [ ] **Step 5: Commit**

```bash
git add src/domain/types.ts src/data/store.ts src/features/oaths/OathsChartPage.tsx src/data/store-oaths.test.ts src/features/oaths/OathsChartPage.test.tsx
git commit -m "oaths: draggable members, pan/zoom/fit, in-canvas oath linking"
```

---

### Task 9: Full gate + wrap-up

- [ ] **Step 1: Run the whole suite**

Run: `npm run typecheck && npm run lint && npm test -- --run`
Expected: 0 type errors, 0 lint warnings, all tests green (≥ 700).

- [ ] **Step 2: Manual smoke in the browser (optional but recommended)**

Run: `npm run dev` → use Playwright MCP to visit `/p/prj_1` boards: codex date label, quick-fact rename, bloodline house roster + narrow stack (resize to 700px), calendar with 5 weekdays, swatch selection on the seeded plot board, timeline bead dblclick, oaths drag/link.

- [ ] **Step 3: Push + open PR (finishing-a-development-branch skill decides merge vs PR)**

```bash
git push -u origin feedback-round-2
```