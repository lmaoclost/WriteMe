---
name: WriteMe
description: Local-first worldbuilding and writing studio with a lamplit study's visual language
colors:
  ink: "#171210"
  night: "#1e1815"
  night-2: "#262019"
  card: "#2c2419"
  line: "#3b2f25"
  line-strong: "#4a3a2c"
  parchment: "#e8dccb"
  parchment-strong: "#f6efe0"
  slate: "#a4917d"
  lilac: "#d9b06a"
  gold: "#d3a44e"
  gold-deep: "#9a7a3a"
  wax-ink: "#241c08"
  teal: "#90a583"
  rose: "#d29a80"
  ember: "#c26a4e"
  success: "#6fae72"
typography:
  display:
    fontFamily: "'Newsreader Variable', Georgia, serif"
    fontSize: "clamp(2rem, 4.5vw, 2.75rem)"
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: "-0.015em"
  headline:
    fontFamily: "'Newsreader Variable', Georgia, serif"
    fontSize: "1.375rem"
    fontWeight: 600
    lineHeight: 1.3
  title:
    fontFamily: "'Inter Variable', system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.4
  worldTitle:
    fontFamily: "'Newsreader Variable', Georgia, serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.35
  ledgerTitle:
    fontFamily: "'Newsreader Variable', Georgia, serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "'Inter Variable', system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.6
  small:
    fontFamily: "'Inter Variable', system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  micro:
    fontFamily: "'Inter Variable', system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "'Inter Variable', system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    letterSpacing: "0.08em"
    textTransform: uppercase
  tag:
    fontFamily: "'Inter Variable', system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  sm: "4px"
  md: "8px"
  pill: "999px"
spacing:
  xs: "6px"
  sm: "10px"
  md: "16px"
  lg: "28px"
  xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.gold}"
    textColor: "#241c08"
    rounded: "{rounded.sm}"
    padding: "8px 14px"
  button-ghost:
    backgroundColor: transparent
    textColor: "{colors.slate}"
    rounded: "{rounded.sm}"
    padding: "8px 14px"
  card-panel:
    backgroundColor: "{colors.night}"
    textColor: "{colors.parchment}"
    rounded: "{rounded.md}"
    padding: "16px"
  forge-card:
    backgroundColor: "{colors.night-2}"
    textColor: "{colors.parchment}"
    rounded: "{rounded.md}"
    padding: "24px 20px"
  seal:
    backgroundColor: "#e8c063"
    textColor: "#241c08"
    size: "40px"
---

# Design System: WriteMe

## Overview

> **Stack note (2026-10):** styling now runs on **Tailwind CSS v4 + shadcn/ui**. Tokens live in `src/app/theme.css` (`@theme inline`); semantic shadcn variables (`--primary`, `--card-well`, `--border`, …) are mapped 1:1 from this palette. Legacy variable names remain as aliases. Feature pages use utility classes directly (phase 2 complete): only two stylesheets remain — `theme.css` (tokens/base/components layer for runtime-generated HTML) and `print.css`.

> **Rollout note (2026-10):** visual direction A, "Lamplight Study", applies app-wide at the token level (recorded in ADR-0011). Waves: **1 — Library pilot** (craft treatment) · **2 — workspace rail + Overview + all forge index pages** (`.lamp-card` hover glow, 40px rail/delete hit areas, hallmark rule on Overview, card craft via `ui/pageBits.ts`) · **3 — warm sweep of canvas planes, manuscript editor toolbar, conlang glyph SVGs** (data palettes left intact) · **4 — writing surfaces craft (lore/chapter lists carry the lamp pool, tabular word counts) + day mode ("Proof & Press": direction B in the same language) + CommandPalette active rows in the rail's language**. Earlier archive wording below describes the *roles* (seal, hairline, two voices), now played by the lamplight palette.

**Creative North Star: "The Lamplit Study"**

The system reads like a writer's study at night, working under a single lamp: warm espresso-ink surfaces, parchment text, brass where a lamp would touch. The archive identity comes from composition — serif display type, hairline rules, and stamped seals instead of glow and gradients — with one warm radial "lamp pool" behind the work in progress. Density is calm; sections breathe and are separated by thin umber rules rather than boxes-in-boxes.

**Key Characteristics:**
- Warm espresso surfaces (`#171210` base, `#1e1815` wells, `#262019` panels)
- Brass used as a wax seal, primary CTA, hover border, or light — never as a flood
- Newsreader variable serif carries identity; Inter carries the utility work
- Hairline rules (`#3b2f25`) are the preferred separator; the hallmark gem marks section rules on lamplit pages
- No glow beyond the lamp pool, no gradient text, no glass

## Colors

A lamplit study: espresso ink for space, parchment for reading, brass only where the lamp touches.

### Primary
- **Brass Gold** (#d3a44e): seals, primary buttons, hover borders, the lamp pool. Never a background wash.
- **Brass, dim** (#9a7a3a): hover/active borders and hallmark gems; quieter brass for lines.
- **Wax Ink** (#241c08): text set on brass — primary buttons and seals.

### Secondary
- **Lamp Light** (#d9b06a): links and inline emphasis in dim text; 2px focus outline.

### Tertiary
- **Sage** (#90a583) and **Clay Rose** (#d29a80): reserved for success/error adjacent accents on their feature pages

### Neutral
- **Ink** (#171210): page background
- **Night** (#1e1815): card wells, header, modals
- **Night 2 / Panel** (#262019): raised panels — forge cards, toasts
- **Line / Line-strong** (#3b2f25 / #4a3a2c): hairline rules and panel borders
- **Parchment** (#e8dccb): body text on dark surfaces
- **Slate** (#a4917d): muted text, labels

### Named Rules
**The Wax Rule.** Brass appears as a seal, a primary CTA, a hover border, or the lamp pool behind the work in progress. It is never a page area larger than a control.

### Day mode — "Proof & Press" (the same study by day, direction B)
The night palette is the default. A `light` class on `<html>` (persisted as `writeme.theme`, i18n pattern, no store slice) selects the day block in `theme.css`: the desk becomes aged ivory, text becomes warm ink, and brass darkens to keep hold on light ground. Roles never change — the Wax Rule, the Flat Archive Rule and the Two Voices Rule hold in both modes; the lamp pool stays, reading as plain sunlight.

| Token | Night (#171210 base) | Day (#f1e9d9 desk) |
|---|---|---|
| `--bg` / desk | `#171210` espresso ink | `#f1e9d9` ivory |
| `--bg-header` / rail band | `#1e1815` | `#eae0cc` |
| `--panel` / raised panels | `#262019` | `#f5efe1` |
| `--card-well` / wells | `#2c2419` | `#faf5ea` |
| `--line` / `--line-strong` | `#3b2f25` / `#4a3a2c` | `#d3c4a6` / `#b7a684` |
| `--text` / strong / muted | `#e8dccb` / `#f6efe0` / `#a4917d` | `#33291a` / `#1f180c` / `#6f6248` |
| `--gold` / `--gold-dim` | `#d3a44e` / `#9a7a3a` | `#8f6f2c` / `#6f5820` |
| focus light (`--lilac`) | `#d9b06a` | `#8a6519` |
| `--danger` / `--warn` (`--ember`) | `#c26a4e` | `#a8472c` |
| brass text (`--wax`) | `#241c08` | `#fdf8ec` |

Toolbar hovers ride `--hover-wash` (white-alpha at night, ink-alpha in day) — never a raw white hex.

## Typography

**Display Font:** Newsreader Variable (fallback Georgia, serif)
**Body Font:** Inter Variable (fallback system-ui, sans-serif)
**Label/Mono Font:** JetBrains Mono 400 (code and measurement only)

**Character:** Newsreader carries the study's voice — page welcomes at weight 500, headlines at 600, `text-wrap: balance` on headings. Everything functional is Inter.

### Hierarchy
- **Display** (500, clamp(2rem→2.75rem), -0.015em, 1.1): page welcomes, section marque
- **Headline** (600, 1.375rem, 1.3): card and panel titles
- **Title** (600, 1rem, 1.4): list rows and inline titles
- **Body** (400, 0.9375rem, 1.6, ≤70ch): prose, card descriptions
- **Label** (600, 0.75rem, 0.08em, uppercase): field labels and eyebrows of tables

### Named Rules
**The Two Voices Rule.** Newsreader speaks identity; Inter speaks utility. A button never wears Newsreader.

## Layout

Single shared container: max 1080px, 48px vertical / 24px horizontal padding. Hub pages center a 960px content column. Sections stack vertically, separated by 1px hairline rules with ≥40px above and below. Forge grids run 3 columns on desktop, 2 under 900px, 1 under 620px.

## Elevation & Depth

Flat by default; depth comes from tonal layering (night on ink on night-2). Shadows exist only where an element floats over content (toasts, modals). Panel borders are 1px `--line`; a 2px `--line-strong` border marks the interactive surface on hover.

### Named Rules
**The Flat Archive Rule.** No resting shadows. Border for edges, tone for depth, shadow only while floating — plus the lamp pool, which is light, not elevation.

## Shapes

Small radii, squared-off utility: 4px on controls, 8px on panels and cards, full pill only for tiny site-nav chips. Cards are rectangles with 1px borders; no nested cards.

## Components

### Buttons
- **Shape:** 4px radius, 8px/14px padding
- **Primary:** Brass Gold background, ink text (#241c08), hover brightens 8%
- **Ghost:** transparent, 1px line border, parchment text on hover with brass-dim border
- **Danger:** transparent with ember border; 18% ember wash on hover
- **Focus:** 2px lilac outline, 2px offset

### Cards / Containers
- **Corner:** 8px
- **Background:** Night (wells) or Night-2 (raised panels)
- **Shadow:** none at rest
- **Border:** 1px line; hover border gold-dim
- **Internal padding:** 16–24px

### Seal (signature component)
- **Style:** 40px circle, radial brass wax (#e8c063→#b98a35→#8f6e2c), engraved initial in #241c08, Newsreader 600 20px, 1px inset light edge + soft contact shadow
- **Use:** marks forge identity in the hub; marks the app brand

### Lamplight signature (pilot components)
- **`.lamp-pool`** — warm radial pool of light behind a page's header; the page the lamp is "over". Decorative, `pointer-events: none`.
- **`.lamp-dot`** — per-card glow that lights a work in progress on hover; the card carries `group`.
- **`.rule-hallmark` + `.hallmark-gem`** — section rule ended by a rotated brass square (rotated 45°).

### Inputs / Fields
- **Style:** ink background, 1px line border, 4px radius, 8px/10px padding
- **Focus:** gold-dim border, no glow
- **Error:** ember border + inline recovery text

### Navigation
- **Site nav:** hairline-bordered pills, lilac text, 999px radius — micro-nav only
- **World selector:** ghost dropdown, truncates long names with ellipsis

## Book Interior

Print styling has three owners: `buildBookCss` (`src/features/manuscript/bookCss.ts`) generates page geometry and typography from the bindery config, `src/app/theme.css` styles the sheet, and `src/app/print.css` holds the `@media print` rules. The rules below are decisions, each with its reason.

### Golden Rules

- **Measure of 60–75 characters.** Trim size and margins keep body lines inside that band. A longer line loses the reader on the return sweep; a shorter one stalls the rhythm with ragged, hyphen-heavy breaks.
- **The first paragraph after a heading is flush.** An indent says "continues the paragraph above" — under a heading there is nothing above to continue, so the indent reads as a defect. Headings reset the indent for the paragraph that follows.
- **Never an indent and a blank line together.** The two mark different things: the indent says the paragraph continues the run, a blank line marks a stronger break. Set both and the separation doubles, the column fragments, and the indent stops meaning anything. Paragraphs carry no space of their own; the indent does the separating.
- **Every chapter opens with a sink.** The opening line sits low under the heading, so a one- or two-word chapter title still lands with weight and the drop cap (when enabled) has room.
- **The chapter opener gets its own page.** The opener already carries the title, the sink and the drop cap. A head would repeat the title beside them and a folio would crowd them — and Chromium cannot switch a margin box off for just the first page of a page type (see limits). So when either suppression is on, the opener prints alone on its `@page openerN`, head and folio suppressed exactly as configured, and the text starts on the next page, where the head and folio resume. Suppression off, the opener and the text share one page.
- **The folio runs at the foot**, small and bottom-center: the top edge stays reserved for the running head, and the folio stays out of the measure.
- **Front matter is roman-numbered.** Lower-roman folios mark the preliminaries as separate from the text. Both runs count the same physical pages — Chromium ignores a page-counter reset (see limits) — so the body's first folio is not 1. Display pages — half title, title, copyright, dedication, epigraph — carry no folio and no head at all.

The Manuscript preset opts out of the opener rules: flush openings, no sink, opener suppression off.

### The Pressmark Rule

**The colophon signs the book.** The only WriteMe mark inside the book is the colophon's pressmark — a hallmark (a 7px gem sitting on a 120px rule, paper brass `#c9a227` on muted `#9a8d6a`). The paper never takes app styling. The title page only announces, in the same language: a small gem above the "WriteMe" series line, and the author set in small caps. Colophon copy sits centred; the pressmark rides the existing back-matter colophon switch, so no data field exists for it. In EPUB the mark degrades to a `❖` glyph where the reading system supports `:before` and to plain colophon text where it does not; DOCX carries no back matter, hence no mark.

### Paged-Media Limits

The print path targets Chromium. Firefox and Safari honor `@page size` and margins (Firefox 95+; Safari 18.2+), but implement no page-margin boxes, so running heads and folios are dropped there. The Bindery shows an engine-specific note instead of pretending parity.

Chromium implements none of the five paged-media features the print path would want, and each absence costs something:

- **No `string-set`.** It would give the running head the current chapter's heading automatically — one rule, the page-margin string following the document. Instead, a running head per chapter comes from **named pages**: each chapter gets an `@page chN` whose top margin carries that chapter's title, selected by the chapter's index; book mode puts the book title on the base page instead.
- **No `target-counter`.** It would resolve every contents entry to its target page (`target-counter(attr(href url), page)`), giving the contents real page numbers. Instead, **the table of contents has no page numbers**: number, title and dotted leader only.
- **No `@page <name>:first`** (nor `:nth()`). It would suppress the running head and the folio on a chapter's first page in place — title and text together on the same sheet. Chromium drops the selector, which is why **the chapter opener gets its own page** instead: a preset that wants the title and the text together (the Manuscript preset) has to give up the suppression, which is what its switches already say.
- **No page-counter reset.** `counter-reset: page` on an element is ignored, so the body folio cannot restart at 1 after the roman-numbered front matter: the roman and the arabic runs count the same physical pages, and the body's first folio is not 1.
- **No `break-before: recto`.** It would force a chapter onto an odd page (recto) by inserting a blank page when needed. Chromium ignores it, so chapter 1 cannot be forced onto a recto and the body starts on whatever page the front matter ends on.

### Format Parity

What each export carries, before putting a feature in the wrong pass:

- **Print/PDF:** page geometry (trim, mirrored margins, gutter, folio, running heads), typography, chapter openers with drop caps, parts, front matter, back matter and scene ornaments.
- **EPUB:** typography, chapter openers with drop caps, parts, front matter, back matter and scene ornaments. No page geometry: the format is reflowable and the reading system owns the page box — no `@page`, no trim, no folio. The pressmark degrades to a glyph or nothing (see The Pressmark Rule).
- **DOCX:** page geometry, typography, parts, chapter numbering and scene ornaments — but no front matter, no back matter and no drop caps.
- **Navigation differs:** the EPUB's navigation lists the back matter (glossary, about the author, colophon); the printed contents page lists only parts and chapters.

## Do's and Don'ts

### Do:
- **Do** use hairline rules to separate sections (1px `--line`).
- **Do** mark every forge with its Seal.
- **Do** keep body copy ≤70ch.

### Don't:
- **Don't** use gradient text, glass, purple glow, or neon on dark.
- **Don't** nest cards inside cards.
- **Don't** tint secondary text gray on tinted surfaces — tint it from the surface hue (parchment/slate family).
- **Don't** let gold paint areas larger than a control.