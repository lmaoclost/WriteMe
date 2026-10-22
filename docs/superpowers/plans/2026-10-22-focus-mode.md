# Focus Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the writer hide the workspace rail on the three writing pages (Manuscript, Bindery, Wellspring) via a page button or `Ctrl+Shift+F`, with `Esc` as quick exit.

**Architecture:** A small `focus.tsx` module holds `FocusContext`, the `FocusToggle` button, and the pure `isWritingPath` helper. `WorkspaceLayout` owns the `focus` state (session-only `useState`), resets it on every route change, binds the keyboard shortcuts on writing routes only, and renders the rail conditionally behind the provider. Nothing touches zustand or persistence.

**Tech Stack:** React 18 context, react-router `useLocation`, lucide-react icons, react-i18next, Vitest + RTL.

## Global Constraints

- No persistence changes: no zustand store `version` bump, no `migrate`, no export/`serialize` change. Focus state is session-only (`src/data/*` untouched).
- Every new UI string goes in BOTH `src/i18n/locales/en.json` and `pt-BR.json` (parity test `src/i18n/i18n.test.ts` enforces it). Tests run in EN.
- ESLint must pass with zero warnings (`npm run lint`); every file ends with a newline (`eol-last`).
- No Node builtins in `src/` (browser-only bundle).
- Tests are colocated and assert behavior only (visible output, attributes, events) — never internal state.
- Final gate: `npm run typecheck && npm run lint && npm test`.
- Spec source: `docs/superpowers/specs/2026-10-22-focus-mode-design.md`.

---

### Task 1: Focus module (context, toggle button, route helper) + i18n keys

**Files:**
- Create: `src/features/workspace/focus.tsx`
- Modify: `src/i18n/locales/en.json` (workspace block, line ~130)
- Modify: `src/i18n/locales/pt-BR.json` (workspace block, line ~130)
- Test: `src/features/workspace/focus.test.tsx`

**Interfaces:**
- Consumes: i18n keys `workspace.focus.*`, lucide-react `Maximize2`/`Minimize2`.
- Produces (relied on by Tasks 2 and 3):
  - `export interface FocusValue { focus: boolean; toggle: () => void; exit: () => void }`
  - `export const FocusContext: React.Context<FocusValue | null>`
  - `export function FocusToggle(): JSX.Element | null` — reads `FocusContext`; renders `null` outside a provider
  - `export function isWritingPath(pathname: string): boolean`

- [ ] **Step 1: Write the failing tests**

Create `src/features/workspace/focus.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FocusContext, FocusToggle, isWritingPath } from "./focus";

describe("isWritingPath", () => {
  it("recognizes the three writing routes", () => {
    expect(isWritingPath("/p/p1/manuscript")).toBe(true);
    expect(isWritingPath("/p/p1/bindery/m1")).toBe(true);
    expect(isWritingPath("/p/p1/wellspring/w1")).toBe(true);
  });

  it("rejects overviews and index lists", () => {
    expect(isWritingPath("/p/p1")).toBe(false);
    expect(isWritingPath("/p/p1/entries")).toBe(false);
    expect(isWritingPath("/p/p1/bindery")).toBe(false);
    expect(isWritingPath("/p/p1/wellspring")).toBe(false);
  });
});

describe("FocusToggle", () => {
  it("renders nothing outside a focus provider", () => {
    render(<FocusToggle />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows Focus when off, Exit focus when on, and delegates clicks", () => {
    const toggle = vi.fn();
    const { rerender } = render(
      <FocusContext.Provider value={{ focus: false, toggle, exit: vi.fn() }}>
        <FocusToggle />
      </FocusContext.Provider>,
    );
    const off = screen.getByRole("button", { name: "Focus" });
    expect(off).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(off);
    expect(toggle).toHaveBeenCalledTimes(1);

    rerender(
      <FocusContext.Provider value={{ focus: true, toggle, exit: vi.fn() }}>
        <FocusToggle />
      </FocusContext.Provider>,
    );
    const on = screen.getByRole("button", { name: "Exit focus" });
    expect(on).toHaveAttribute("aria-pressed", "true");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/workspace/focus.test.tsx`
Expected: FAIL — `Failed to resolve import "./focus"` (module does not exist yet).

- [ ] **Step 3: Add the i18n keys to both locales**

In `src/i18n/locales/en.json`, replace the `workspace` block:

```json
  "workspace": {
    "worldSections": "World sections",
    "myWorlds": "← My worlds",
    "search": "Search",
    "worldMissing": "This world doesn't exist or was removed.",
    "focus": {
      "toggle": "Focus",
      "exit": "Exit focus",
      "tip": "Focus mode — Ctrl+Shift+F (Esc exits)"
    }
  },
```

In `src/i18n/locales/pt-BR.json`, replace the `workspace` block:

```json
  "workspace": {
    "worldSections": "Seções do mundo",
    "myWorlds": "← Meus mundos",
    "search": "Buscar",
    "worldMissing": "Este mundo não existe ou foi removido.",
    "focus": {
      "toggle": "Foco",
      "exit": "Sair do foco",
      "tip": "Modo foco — Ctrl+Shift+F (Esc sai)"
    }
  },
```

- [ ] **Step 4: Write the implementation**

Create `src/features/workspace/focus.tsx`:

```tsx
import { createContext, useContext } from "react";
import { useTranslation } from "react-i18next";
import { Maximize2, Minimize2 } from "lucide-react";

export interface FocusValue {
  focus: boolean;
  toggle: () => void;
  exit: () => void;
}

/** Focus state lives in WorkspaceLayout; null outside the workspace. */
export const FocusContext = createContext<FocusValue | null>(null);

/** Writing routes only: manuscript, bindery/:id, wellspring/:id.
 *  The index lists (bindery, wellspring) are not writing surfaces. */
export function isWritingPath(pathname: string): boolean {
  const rest = pathname.match(/^\/p\/[^/]+\/(.+)$/)?.[1] ?? "";
  if (rest === "manuscript") return true;
  return /^bindery\/[^/]+$/.test(rest) || /^wellspring\/[^/]+$/.test(rest);
}

/** Page-level toggle for focus mode; renders null outside FocusContext. */
export function FocusToggle() {
  const { t } = useTranslation();
  const ctx = useContext(FocusContext);
  if (!ctx) return null;
  return (
    <button
      type="button"
      aria-pressed={ctx.focus}
      title={t("workspace.focus.tip")}
      className="flex items-center gap-1.5 cursor-pointer bg-none border-0 px-2 py-1.5 text-xs uppercase tracking-[0.1em] text-slate hover:text-parchment aria-pressed:text-gold"
      onClick={ctx.toggle}
    >
      {ctx.focus
        ? <Minimize2 aria-hidden className="size-3.5 flex-none" />
        : <Maximize2 aria-hidden className="size-3.5 flex-none" />}
      {ctx.focus ? t("workspace.focus.exit") : t("workspace.focus.toggle")}
    </button>
  );
}```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/features/workspace/focus.test.tsx src/i18n/i18n.test.ts`
Expected: PASS — focus tests green, i18n parity green.

- [ ] **Step 6: Commit**

```bash
git add src/features/workspace/focus.tsx src/features/workspace/focus.test.tsx src/i18n/locales/en.json src/i18n/locales/pt-BR.json
git commit -m "feat: focus context, toggle button and writing-route helper"
```

---

### Task 2: WorkspaceLayout wiring (state, shortcuts, conditional rail)

**Files:**
- Modify: `src/features/workspace/WorkspaceLayout.tsx`
- Test: `src/features/workspace/focus.test.tsx` (append)

**Interfaces:**
- Consumes: `FocusContext`, `FocusValue`, `isWritingPath` from Task 1.
- Produces: focus behavior inside the workspace — `Ctrl+Shift+F` toggles, `Esc` exits, rail unmounts while focus is on, any navigation resets focus. Task 3 relies on the context being provided around `<Outlet>` so `FocusToggle` works on writing pages.

- [ ] **Step 1: Write the failing integration tests**

Append to `src/features/workspace/focus.test.tsx` (merge imports with the ones already there):

```tsx
import { useState, type ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Link, MemoryRouter } from "react-router-dom";
import { beforeEach } from "vitest";
import { AppRouter } from "../../app/router";
import { useScriptorium } from "../../data/store";
```

Helpers and suite:

```tsx
async function at(path: string, extra?: ReactNode): Promise<void> {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppRouter />
      {extra}
    </MemoryRouter>,
  );
  await waitFor(() => {
    expect(screen.queryByTestId("hydration-splash")).toBeNull();
    expect(screen.queryByTestId("chunk-splash")).toBeNull();
  }, { timeout: 10000 });
}

const rail = () =>
  screen.queryByRole("navigation", { name: /world sections/i });

beforeEach(() => {
  localStorage.clear();
  useScriptorium.setState(useScriptorium.getInitialState());
});

describe("focus mode", () => {
  it("hides the rail on Ctrl+Shift+F and restores it with Esc", async () => {
    const p = useScriptorium.getState().addProject("Focus World");
    await at(`/p/${p.id}/manuscript`);
    expect(rail()).toBeInTheDocument();

    fireEvent.keyDown(document.body, { key: "F", ctrlKey: true, shiftKey: true });
    expect(rail()).toBeNull();

    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(rail()).toBeInTheDocument();
  });

  it("ignores the shortcut outside writing routes", async () => {
    const p = useScriptorium.getState().addProject("Calm");
    await at(`/p/${p.id}/entries`);
    fireEvent.keyDown(document.body, { key: "F", ctrlKey: true, shiftKey: true });
    expect(rail()).toBeInTheDocument();
  });

  it("drops focus when navigating to another page", async () => {
    const p = useScriptorium.getState().addProject("Wanderer");
    await at(`/p/${p.id}/manuscript`, <Link to={`/p/${p.id}/entries`}>elsewhere</Link>);

    fireEvent.keyDown(document.body, { key: "F", ctrlKey: true, shiftKey: true });
    expect(rail()).toBeNull();

    fireEvent.click(screen.getByRole("link", { name: "elsewhere" }));
    await waitFor(() => expect(rail()).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/features/workspace/focus.test.tsx`
Expected: FAIL on the new suite — `expect(rail()).toBeNull()` fails (no focus behavior yet; the shortcut does nothing).

- [ ] **Step 3: Implement the WorkspaceLayout wiring**

In `src/features/workspace/WorkspaceLayout.tsx`:

1. Extend the router import and add React hooks:

```tsx
import { NavLink, Navigate, Outlet, useParams, Link, useLocation } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
```

2. Import the focus module (keep existing imports):

```tsx
import { FocusContext, isWritingPath, type FocusValue } from "./focus";
```

3. Inside `WorkspaceLayout`, after `const warnedRef = useRef(false);` add:

```tsx
  const [focus, setFocus] = useState(false);
  const { pathname } = useLocation();
  const writing = isWritingPath(pathname);

  // Any navigation drops focus — the rail comes back with the new page.
  useEffect(() => {
    setFocus(false);
  }, [pathname]);

  useEffect(() => {
    if (!writing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setFocus((v) => !v);
      } else if (e.key === "Escape" && focus) {
        setFocus(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [writing, focus]);

  const focusValue = useMemo<FocusValue>(
    () => ({ focus, toggle: () => setFocus((v) => !v), exit: () => setFocus(false) }),
    [focus],
  );
```

4. Wrap the returned JSX. The return becomes:

```tsx
  return (
    <FocusContext.Provider value={focusValue}>
      <div className={"grid h-screen " + (focus
        ? "grid-cols-[1fr]"
        : "grid-cols-[180px_1fr] max-[720px]:grid-cols-1 max-[720px]:grid-rows-[auto_1fr]")}>
        {focus ? null : (
          <nav
            aria-label={t("workspace.worldSections")}
            className="sticky top-0 h-screen bg-night border-r border-line px-3.5 pt-[18px] pb-3 flex flex-col gap-1.5 overflow-hidden max-[720px]:static max-[720px]:h-auto max-[720px]:flex-row max-[720px]:items-center max-[720px]:overflow-x-auto max-[720px]:pr-4 max-[720px]:[scrollbar-width:none] max-[720px]:[&::-webkit-scrollbar]:hidden"
          >
            {/* …existing nav content, unchanged, re-indented by two spaces… */}
          </nav>
        )}
        <main className="h-screen min-h-0 overflow-hidden py-6 px-7 max-[720px]:p-5">
          <Outlet context={{ projectId }} />
        </main>
      </div>
    </FocusContext.Provider>
  );
```

Concretely: keep every line of the existing `<nav>` and `<main>` JSX as-is; only (a) change the root `<div>` className to the ternary above, (b) wrap `<nav>` in `{focus ? null : ( … )}`, (c) wrap everything in `<FocusContext.Provider>`. Lint must stay clean (`npm run lint` catches indentation/JSX errors).

- [ ] **Step 4: Run focus tests and the existing layout suite**

Run: `npx vitest run src/features/workspace/focus.test.tsx src/features/workspace/WorkspaceLayout.test.tsx`
Expected: PASS — new focus suite green, existing rail tests unchanged and green.

- [ ] **Step 5: Commit**

```bash
git add src/features/workspace/WorkspaceLayout.tsx src/features/workspace/focus.test.tsx
git commit -m "feat: hide workspace rail in focus mode with keyboard shortcuts"
```

---

### Task 3: FocusToggle on the three writing pages

**Files:**
- Modify: `src/features/manuscript/ManuscriptPage.tsx` (header, line ~174)
- Modify: `src/features/manuscript/BinderyPage.tsx` (header actions, line ~156)
- Modify: `src/features/wellspring/WellSpringPage.tsx` (header actions, line ~101)
- Test: `src/features/workspace/focus.test.tsx` (append)

**Interfaces:**
- Consumes: `FocusToggle` from Task 1 (renders `null` outside `FocusContext`, so it is safe anywhere), focus wiring from Task 2.
- Produces: end-user entry point — a visible Focus button on every writing page.

- [ ] **Step 1: Write the failing integration test**

Append to `src/features/workspace/focus.test.tsx`, inside the `describe("focus mode")` block:

```tsx
  it("turns focus on from the page button and back off again", async () => {
    const p = useScriptorium.getState().addProject("Ink");
    const m = useScriptorium.getState().addManuscript(p.id);
    await at(`/p/${p.id}/bindery/${m.id}`);

    fireEvent.click(screen.getByRole("button", { name: "Focus" }));
    expect(rail()).toBeNull();
    expect(screen.getByRole("button", { name: "Exit focus" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Exit focus" }));
    expect(rail()).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Focus" })).toHaveAttribute("aria-pressed", "false");
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/workspace/focus.test.tsx`
Expected: FAIL — `Unable to find an accessible element with the role "button" and name "Focus"` (button not rendered on the page yet).

- [ ] **Step 3: Render FocusToggle on the three writing pages**

1. `src/features/manuscript/ManuscriptPage.tsx` — add import and put the toggle first inside the header's right-aligned group (line ~174):

```tsx
import { FocusToggle } from "../workspace/focus";
```

```tsx
        <div className="flex gap-2 ml-auto">
          <FocusToggle />
          <Button onClick={createBook}>
```

2. `src/features/manuscript/BinderyPage.tsx` — add import and put the toggle first inside the board actions (line ~156):

```tsx
import { FocusToggle } from "../workspace/focus";
```

```tsx
        <div className={BOARD_ACTIONS}>
          <FocusToggle />
          <ExportButtons manuscript={manuscript} />
```

3. `src/features/wellspring/WellSpringPage.tsx` — add import and put the toggle last inside the board actions (line ~101):

```tsx
import { FocusToggle } from "../workspace/focus";
```

```tsx
        <div className={BOARD_ACTIONS}>
          <button type="button" aria-label={t("wellspring.page.undo")} className={BOARD_ACTION_BTN} disabled={!flags.canUndo} onClick={() => useScriptorium.getState().undoWS(wellId)}>↶</button>
          <button type="button" aria-label={t("wellspring.page.redo")} className={BOARD_ACTION_BTN} disabled={!flags.canRedo} onClick={() => useScriptorium.getState().redoWS(wellId)}>↷</button>
          <button type="button" aria-pressed={notesOpen} className={BOARD_ACTION_BTN} onClick={() => setNotesOpen((v) => !v)}>{t("wellspring.page.notes")}</button>
          <FocusToggle />
        </div>
```

Import placement: group with the other relative imports at the top of each file (ManuscriptPage's `../../ui/Button` block; BinderyPage's `../../ui/board` block; WellSpringPage's `../../ui/board` block).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/features/workspace/focus.test.tsx`
Expected: PASS — the button round-trip (on → rail hidden → off → rail back) is green.

- [ ] **Step 5: Full verification gate**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all three clean — typecheck OK, 0 lint warnings, all test files green.

- [ ] **Step 6: Commit**

```bash
git add src/features/manuscript/ManuscriptPage.tsx src/features/manuscript/BinderyPage.tsx src/features/wellspring/WellSpringPage.tsx src/features/workspace/focus.test.tsx
git commit -m "feat: focus toggle button on writing pages"
```
