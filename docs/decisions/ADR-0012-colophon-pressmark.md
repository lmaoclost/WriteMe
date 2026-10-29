# ADR-0012 — The book's pressmark: a colophon hallmark

## Context
The Lamplight rollout closed the app's chrome (ADR-0011: every surface token-driven) and deliberately left the Bindery's printed artifact alone. The colophon page was two justified text lines ("Set in …", "Trim … Scriptorium."), and nothing inside the book identified the studio that bound it. A review page (`/spec/pressmark`, commit `f9e592c`, spec-only, never merged) showed the proposal side by side with the current book on the same generated HTML; the direction was approved with two decisions: the mark appears in the colophon only, in the hallmark-minimal form (gem on a short rule, not the circular wax seal).

## Decision
1. **The colophon signs the book.** `colophonSection` ships a `<span class="pressmark">` above its lines: a hallmark — a 7px gem on a 120px rule, paper-fixed brass (`#c9a227` on `#9a8d6a`). The mark is the app's only signature inside the book; the paper never takes app styling (no lamp, no chrome tokens).
2. **The title page announces, in the same language but lesser:** a small gem above the "Scriptorium" series line and the author in small caps. Two appearances of the language, never a repeated device.
3. **No data field: the mark rides the back-matter colophon switch.** Colophon on signs the book; colophon off unsigns it. Persist state v1 unchanged; no migration.
4. **Format parity:** print and screen carry the hallmark with fixed hexes, so the mark survives the body-level print portal and any renderer that scrapes CSS variables; the EPUB degrades it to a `❖` glyph where the reading system supports `:before`, and to plain colophon text where it does not; DOCX carries no back matter, hence no mark.
5. **Layering:** the colophon centring is restated in the generated `buildBookCss` (unlayered) because the generated blanket `p { text-align }` outranks `@layer components` rules — the same precedent as the epigraph and part-divider centring. The pressmark and gem visuals live in `theme.css`.

## Consequences
- `export.test.tsx` pins the one behaviour that matters: the mark rides the colophon switch; no hex pin.
- The spec page's purpose is done — it stayed on the review branch and did not merge; the live Bindery preview shows the pass.
- `DESIGN.md` (Book Interior, "The Pressmark Rule") is the source of truth; this ADR records the decision and its scope.
- A future cover-page generator would extend the hallmark language, not the circular seal.