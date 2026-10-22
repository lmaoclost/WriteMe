# Focus Mode — Design

**Date:** 2026-10-22
**Status:** approved
**Scope:** writing pages only (Manuscript, Bindery, Wellspring)

## Problem

The workspace rail (180px nav on the left) competes with the text while
writing. Writers want an option to hide it and give the page the whole
viewport — without leaving the page or entering a separate screen.

## Decisions (validated with the user)

| Question | Decision |
|---|---|
| Where does it apply? | Writing pages only: `manuscript`, `bindery/:manuscriptId`, `wellspring/:wellId` |
| What hides? | The rail only (sections, "My worlds", language toggle, Ctrl+K hint — the whole `<nav>`). Page chrome, toasts, and CommandPalette stay |
| Activation? | Visible button **and** keyboard shortcut `Ctrl+Shift+F` |
| Quick exit? | `Esc` leaves focus mode |
| Persistence? | None. Session state; every reload starts with focus off |
| State scope? | Per page. Navigating to another route segment resets focus to off |

## Architecture

**New file:** `src/features/workspace/focus.tsx`

- `FocusContext` — `{ focus, toggle, exit }`, created and provided by
  `WorkspaceLayout`.
- `FocusToggle` — reusable button that reads the context; rendered by the
  three writing pages.

**Changes to `src/features/workspace/WorkspaceLayout.tsx`:**

- `useState(false)` for focus. An effect keyed on the route's section
  segment resets it to `false` on navigation (switching page exits focus).
- A `keydown` listener:
  - `Ctrl+Shift+F` toggles focus (`preventDefault`), but only on writing
    routes; elsewhere it is a no-op.
  - `Esc` exits focus, and only reacts while focus is on — it must not
    intercept `Esc` for open dialogs/selects when focus is off.
- The root grid becomes `grid-cols-[1fr]` while focus is on instead of
  `grid-cols-[180px_1fr]`; the `<nav>` rail does not render at all.
- No zustand, no persisted state, no version bump.

Writing routes detection derives from the current `useLocation` pathname
against `projectId` (the segment right after `/p/:projectId`).

## UI

**`FocusToggle` button:**

- Off state: `Maximize2` icon + label "Focus" (PT: "Foco"), tooltip shows
  `Ctrl+Shift+F`.
- On state: `Minimize2` icon + label "Exit focus" (PT: "Sair do foco"),
  `aria-pressed="true"`.
- Styling follows the rail's existing pattern: `text-slate
  hover:text-parchment`, uppercase `text-xs tracking-[0.1em]`.
- Placement: top-right corner of each writing page's header area —
  `ManuscriptPage`, `BinderyPage`, `WellSpringPage`.

**Mobile (≤720px):** the rail is a horizontal top bar; focus hides it the
same way. No special case.

**No dead ends inside focus:** exits are `Esc`, the toggle button, and
`Ctrl+K` (CommandPalette mounts outside the layout and keeps working).

**i18n:** three new keys in both `src/i18n/locales/en.json` and
`pt-BR.json` (label on/off, tooltip). The existing parity test enforces
both files.

## Testing

Colocated RTL tests (`src/features/workspace/focus.test.tsx`), rendered on
a writing route:

1. Rail visible by default.
2. Clicking `FocusToggle` hides the rail and sets `aria-pressed=true`;
   clicking again restores it.
3. `Ctrl+Shift+F` toggles focus.
4. `Esc` exits focus.
5. Navigating to a non-writing route with focus on restores the rail
   (per-page reset).
6. `Ctrl+Shift+F` on a non-writing route changes nothing.

Behavior only — no internal-state assertions, no timers, no persistence.

Existing coverage: `src/i18n/i18n.test.ts` (EN/PT key parity), plus the
final `npm run typecheck && npm run lint && npm test` gate.

## Out of scope

- Fullscreen API / browser fullscreen
- Hiding page-level toolbars or toasts
- Focus timers, pomodoro, session tracking
- Persisting focus state across reloads
