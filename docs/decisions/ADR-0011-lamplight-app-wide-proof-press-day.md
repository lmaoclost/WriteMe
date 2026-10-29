# ADR-0011 — Lamplight direction app-wide, with Proof & Press as the day mode

## Context
The redesign pilot (Library) proved visual direction A, "Lamplight Study", and it rolled out in
three waves: 1 — Library, 2 — workspace rail + Overview + all forge index pages, 3 — canvas planes,
manuscript editor toolbar, conlang glyph SVGs (`0f35505`, documented in DESIGN.md's rollout note).
Direction B, "Proof & Press" (a day-lit proofing desk) had come second in the original direction
review and was shelved. Two gaps remained: writing surfaces beyond the ChapterEditor toolbar
(Codex list, chapter list, CommandPalette internals) never got a deliberate craft pass, and the app
had no light mode — the espresso-ink palette was the only option.

## Decision
1. **Direction A governs app-wide; its language (brass seal, hairlines, hallmark gem, lamp pool,
   two voices) is the contract.** This records the completed rollout; no further waves of adoption
   are pending.
2. **Day mode is direction B executed in the same language.** A `.light` class on `<html>` drives a
   second token block in `src/app/theme.css`: the desk inverts to aged ivory, text to warm ink, and
   brass darkens to keep hold on light ground — roles do not change (Wax Rule, Flat Archive,
   Two Voices all hold). The lamp pool stays, reading as plain sunlight.
3. **The theme is a UI preference, not world data.** It follows the i18n language pattern — its own
   localStorage key (`scriptorium.theme`, `night` default, junk → default), no store slice, no
   persist migration. `src/ui/theme.ts` applies the `light` class at import time; `ThemeToggle`
   mounts beside `LanguageToggle` (rail footer, library header, same button craft).
4. **Writing surfaces join the contract.** The lore chapter list and the manuscript chapter list
   carry the lamp pool (the lamp hangs over the work in progress); word counts are
   tabular-nums; the CommandPalette's active row uses the rail's active treatment
   (2px gold inset bar on a gold tint), so keyboard navigation and the rail speak identically.
5. **User data palettes stay untouched, as in waves 1–3:** map/event/faction pin colours,
   connection styles, calendar defaults, and the print worlds keep their seeded hexes — the theme
   rides on layout, chrome and typography tokens only.

## Consequences
- Every surface has moved from hardcoded colors to tokens; the editor toolbar's `#ffffff14`
  hover wash and white pressed text became `--hover-wash` / `--text-strong` so they read in both
  modes.
- Tests pin behaviour, not hexes: the theme module and toggle have their own tests; the rail
  structure test now covers both toggles. No existing colour assertion exists — the data palettes
  were never the app theme.
- Dark espresso remains the default for existing users; day mode applies only when toggled.
- Print worlds and the Bindery sheet are unaffected: `.print-book` keeps paper/ink tokens, which in
  day mode already match the desk, and print CSS continues to force `--print-paper`/`--print-ink`.