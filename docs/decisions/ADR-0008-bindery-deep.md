# ADR-0008 — Bindery grows its own surface and book features

## Context
The Bindery is a deep route off Manuscript (`/p/:id/bindery/:msId`) reachable only through the Manuscript page; the hub ledger card routes there too. The panel already covers fonts/trims/drop caps/running head/title page/TOC/glossary/dedication with a live paper preview, EPUB + DOCX + PDF exports exist. Gaps surfaced in the grill: the chapter model has scene markers (`noteTop`, `noteEnd`, `endMarker`) that never render in the book, chapter numbering and page numbers don't exist, running head is fixed to the book title, the EPUB ignores the project cover, and the panel leaks PT copy ("Tipografia", "Tamanho do livro", "Capitulares", "Conteúdo", "Glossário", "Sem conteúdo ainda").

## Decision
1. Nav: the workspace rail gains a "Bindery" item: `/p/:id/bindery` is the index of the project's manuscripts (title, chapter count, current trim, export actions); the deep configuration route stays at `/p/:id/bindery/:msId`. The Overview ledger Bindery row and the hub forge card link to the index.
2. Panel additions: **chapter numbering style** (none / 1 / Chapter 1 / word) rendered as a chapter heading prefix in book + EPUB; **page numbers** toggle (print `@page` bottom-center counter); **running-head mode** (book title / current chapter title).
3. Book renders scene markers: `endMarker` as a centered scene separator, `noteTop`/`noteEnd` as small centered note lines above/below the chapter body — in print/preview HTML and therefore in the EPUB/DOCX pipeline that consumes `buildBookHtml`.
4. EPUB uses the project cover (`coverImageKey`) as book cover when present.
5. All Bindery copy becomes EN (panel labels, book strings "Contents" / "Glossary" / "No content yet").
6. `BinderyConfig` gains `numberingStyle` (default `"arabic"`), `pageNumbers` (default `false`), `runningHeadMode` (default `"book"`) — schema validation and defaults follow.

## Consequences
- Workspace rail has 13 items; ManuscriptPage keeps its Bindery shortcut.
- Export/EPUB tests gain cover expectations; DOCX numbering inherits the chapter prefix.
- The paper-artifact tokens (ADR-0007) cover the preview; the new controls follow the account-page Archivist pattern.

## Status
Accepted — 2026-10-16, grilling session with Renan.