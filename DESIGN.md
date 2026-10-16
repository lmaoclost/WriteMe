---
name: Scriptorium
description: Local-first worldbuilding and writing studio — an archivist's take on Scriptorium
colors:
  ink: "#1a1a2e"
  night: "#16162a"
  night-2: "#2a2a44"
  card: "#333360"
  line: "#3a3a55"
  line-strong: "#3d3d5c"
  parchment: "#e0e0e0"
  parchment-strong: "#ffffff"
  slate: "#a0a0b8"
  lilac: "#b89eef"
  gold: "#e0c264"
  gold-deep: "#b39642"
  teal: "#6cc5be"
  rose: "#e08a96"
  ember: "#f44336"
  success: "#42b983"
typography:
  display:
    fontFamily: "'Fraunces Variable', Georgia, serif"
    fontSize: "clamp(2rem, 4.5vw, 2.75rem)"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "'Fraunces Variable', Georgia, serif"
    fontSize: "1.375rem"
    fontWeight: 600
    lineHeight: 1.3
  title:
    fontFamily: "'Inter Variable', system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.4
  worldTitle:
    fontFamily: "'Fraunces Variable', Georgia, serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.35
  ledgerTitle:
    fontFamily: "'Fraunces Variable', Georgia, serif"
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
    textColor: "#17131f"
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
    backgroundColor: "#d8b23a"
    textColor: "#241c08"
    size: "40px"
---

# Design System: Scriptorium

## Overview

**Creative North Star: "The Scriptor's Archive"**

The system reads like a well-kept private archive at night: deep ink-navy surfaces with parchment text, gold seals marking what matters. The incumbent palette stays; the archive identity comes from composition — serif display type, hairline rules, and stamped seals instead of glow and gradients. Density is calm; sections breathe and are separated by thin ink rules rather than boxes-in-boxes.

**Key Characteristics:**
- Ink navy surfaces (`#1a1a2e` base, `#16162a` wells, `#2a2a44` panels)
- Gold used as a wax seal, never as a flood
- Fraunces variable serif carries identity; Inter carries the utility work
- Hairline rules (`#3a3a55`) are the preferred separator
- No glow, no gradient text, no glass

## Colors

A nocturne archive: cool dark blues for space, parchment for reading, gold only where a seal belongs.

### Primary
- **Wax Gold** (#e0c264): seals, primary buttons, hover borders. Never a background wash.
- **Wax Gold, dim** (#b39642): hover/active borders; quieter gold for lines.

### Secondary
- **Reading Lilac** (#b89eef): links and inline emphasis in dim text.

### Tertiary
- **Chronicle Teal** (#6cc5be) and **Vellum Rose** (#e08a96): reserved for success/error adjacent accents on their feature pages

### Neutral
- **Ink** (#1a1a2e): page background
- **Night** (#16162a): card wells, header, modals
- **Night 2 / Panel** (#2a2a44): raised panels — forge cards, toasts
- **Line / Line-strong** (#3a3a55 / #3d3d5c): hairline rules and panel borders
- **Parchment** (#e0e0e0): body text on dark surfaces
- **Slate** (#a0a0b8): muted text, labels

### Named Rules
**The Wax Rule.** Gold appears as a seal, a primary CTA, or a border on hover. It is never a page area larger than a button.

## Typography

**Display Font:** Fraunces Variable (fallback Georgia, serif)
**Body Font:** Inter Variable (fallback system-ui, sans-serif)
**Label/Mono Font:** JetBrains Mono 400 (code and measurement only)

**Character:** Fraunces carries the archive's voice — set as display/headline only. Everything functional is Inter.

### Hierarchy
- **Display** (600, clamp(2rem→2.75rem), -0.02em, 1.15): page welcomes, section marque
- **Headline** (600, 1.375rem, 1.3): card and panel titles
- **Title** (600, 1rem, 1.4): list rows and inline titles
- **Body** (400, 0.9375rem, 1.6, ≤70ch): prose, card descriptions
- **Label** (600, 0.75rem, 0.08em, uppercase): field labels and eyebrows of tables

### Named Rules
**The Two Voices Rule.** Fraunces speaks identity; Inter speaks utility. A button never wears Fraunces.

## Layout

Single shared container: max 1080px, 48px vertical / 24px horizontal padding. Hub pages center a 960px content column. Sections stack vertically, separated by 1px hairline rules with ≥40px above and below. Forge grids run 3 columns on desktop, 2 under 900px, 1 under 620px.

## Elevation & Depth

Flat by default; depth comes from tonal layering (night on ink on night-2). Shadows exist only where an element floats over content (toasts, modals). Panel borders are 1px `--line`; a 2px `--line-strong` border marks the interactive surface on hover.

### Named Rules
**The Flat Archive Rule.** No resting shadows. Border for edges, tone for depth, shadow only while floating.

## Shapes

Small radii, squared-off utility: 4px on controls, 8px on panels and cards, full pill only for tiny site-nav chips. Cards are rectangles with 1px borders; no nested cards.

## Components

### Buttons
- **Shape:** 4px radius, 8px/14px padding
- **Primary:** Wax Gold background, ink text (#17131f), hover brightens 8%
- **Ghost:** transparent, 1px line border, parchment text on hover with gold-dim border
- **Danger:** transparent with ember border; 18% ember wash on hover
- **Focus:** 2px lilac outline, 2px offset

### Cards / Containers
- **Corner:** 8px
- **Background:** Night (wells) or Night-2 (raised panels)
- **Shadow:** none at rest
- **Border:** 1px line; hover border gold-dim
- **Internal padding:** 16–24px

### Seal (signature component)
- **Style:** 40px circle, radial gold wax (#d8b23a→#a3831e→#7d6416), engraved initial in #241c08, Fraunces 700 20px, 1px inset light edge + soft contact shadow
- **Use:** marks forge identity in the hub; marks the app brand

### Inputs / Fields
- **Style:** ink background, 1px line border, 4px radius, 8px/10px padding
- **Focus:** gold-dim border, no glow
- **Error:** ember border + inline recovery text

### Navigation
- **Site nav:** hairline-bordered pills, lilac text, 999px radius — micro-nav only
- **World selector:** ghost dropdown, truncates long names with ellipsis

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