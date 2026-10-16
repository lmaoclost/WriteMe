# ADR-0007 — Workspace token sweep; data palettes exempt

## Context
Detector sweep over `src` found 142 hits. Three families: (1) UI literals in legacy workspace/tool CSS (radius 6/10, px font sizes off-ramp, scrim/shadow raws); (2) the paper book artifact (bindery preview, print view) using paper-world colors; (3) data palettes authored in TS constants (well kinds, oath statuses, member pickers, connection styles, event preset colors, demo seed).

## Decision
1. All UI chrome in workspace/tool CSS now uses DESIGN.md tokens: radii snapped (3/2→4, 6/10→8), font sizes snapped to the ramp (10→0.6875rem, 17/19→1.125, 21→1.25, 24/26→1.375), scrims and the seal shadow unified into theme vars (`--scrim`, `--scrim-canvas`, `--shadow-seal`, seal stops `--seal-*`).
2. The paper book artifact keeps physical-fidelity sizes/colors via artifact tokens (`--paper*`, `--fs-paper-*`, `--print-ink`, `--print-paper`) — a book page's world is paper, not app chrome.
3. Data palettes stay as authored TS constants (user-facing color pickers, canvas semantics, tests, seed content): well-kind/status/event/connection colors are content, exempt from the frontmatter palette. The seal/toast left border and canvas-node kind borders are functional state signals — exempt from the side-tab anti-pattern.
4. The `broken-image` hit on `markdown.ts` is a detector false positive (src/alt preserved at runtime from sanitized attributes), dismissed.
5. `ui.css` toast success border unifies to `--success` (legacy #4d8f5f dropped).

## Consequences
- Non-test UI CSS + theme + seal now score 0 detector hits; remaining src hits are data/test files by design.
- Theme.css gains the shared scrim/shadow/seal/paper/print variables all pages consume.

## Status
Accepted — 2026-10-16, token sweep session with Renan.