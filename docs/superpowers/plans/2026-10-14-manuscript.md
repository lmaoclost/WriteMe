# Scriptorium Manuscript Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Manuscript — multi-book chapters CRUD/ordering/wordcount, markdown editor reuse, EPUB client-side export + PDF print dialog.

**Architecture:** Store actions extend the Foundation store (schema v1 intocado); `useDebouncedDraft` extracted from EntryView for reuse; export composes sanitized HTML and hands it to epub-gen-memory (lazy import) or the print stylesheet.

**Tech Stack:** Existing stack + `epub-gen-memory` (only new dependency).

## Global Constraints

- TypeScript strict; no new deps except `epub-gen-memory`
- Schema v1 intocado; `validateProjectData` keeps passing
- moveChapter: swap adjacent orders (±1), gaps tolerated (sort by order; no renumbering)
- Editor mechanics copied from Codex: debounce 300ms + flush (via extracted `src/ui/useDebouncedDraft.ts` — refactor EntryView to consume it)
- Wordcount: `content.trim().split(/\s+/).filter(Boolean).length`, memoized on commit
- Export disabled when 0 chapters (title attr "Adicione capítulos primeiro")
- EPUB: lazy `import("epub-gen-memory")` in try/catch; content via `renderMarkdown`; metadata title/author/language "pt"; project cover as optional cover; download `<book-title>.epub`; failure toast "Falha ao gerar o EPUB."
- PDF: `PrintBook` portal rendered before `window.print()`; `@media print { aside, nav, .editor-header { display: none } }`
- Theme vars only; PT-BR copy; a11y labels; gate = typecheck + lint + vitest + build

---

### Task 1: store actions + debounced draft hook (TDD)

**Files:**
- Create: `src/ui/useDebouncedDraft.ts`
- Modify: `src/data/store.ts`, `src/features/entries/EntryView.tsx` (consume the hook)
- Test: `src/ui/useDebouncedDraft.test.tsx`, `src/data/store-manuscript.test.ts`

**Interfaces:**
- Produces: hook `useDebouncedDraft(value, onCommit, delay = 300): { draft, setDraft, flush }` — single timer, cleanup on unmount (flush), blur flush; store actions `addManuscript(projectId, title?) → Manuscript` (title default "Livro sem título", author ""), `renameManuscript`, `setManuscriptAuthor`, `deleteManuscript`, `addChapter(manuscriptId, heading?) → Chapter` (order = max+1), `updateChapter(id, patch)` (clone arrays/strings), `deleteChapter(id)`, `moveChapter(id, dir)` (swap with neighbor by order; first↑/last↓ no-op).

- [ ] **Step 1:** RED both test files → implement hook + actions → GREEN + full gate → commit `feat(book): manuscript actions and debounced draft hook`

Cases (hook): draft starts at value + value change resync (only when NOT dirty); typing sets draft; commit after delay; flush commits now and clears timer; unmount flush. Cases (store): add default; rename/author touch project; delete releases nothing (no images in chapter) but clears state; addChapter order max+1; updateChapter content; deleteChapter leaves gap; moveChapter swap middle/first/last; validateProjectData(export) after ops.

### Task 2: ManuscriptPage (TDD)

**Files:**
- Create: `src/features/manuscript/ManuscriptPage.tsx`, `src/features/manuscript/ChapterList.tsx`, `src/features/manuscript/ChapterEditor.tsx`, `src/features/manuscript/book.css`
- Modify: `PlaceholderPage.tsx` (drop "manuscript" key), router (route → ManuscriptPage)
- Test: `src/features/manuscript/ManuscriptPage.test.tsx`

**Interfaces:**
- Consumes: Task 1 (hook + actions), Codex patterns (two-step delete, chips).
- Produces: `<ManuscriptPage projectId>`; multi-book select (header `<select aria-label="Livro">` when >1 + Nova/Excluir livro buttons: rename+author inline inputs at top); chapter list rows (order, heading, wordcount, ↑/↓) with active state; editor (heading input + textarea + Prévia toggle via MarkdownView util from codex — import { renderMarkdown } from entries/markdown — OK cross-feature import; spec allows); empty copy per spec §3.

Cases: page render (route), create book default + select behavior (first book auto-selected when single), multi-book select + create + delete two-step; chapters CRUD + reorder swap + wordcount column; editor debounced commit + preview toggle; empty copies; placeholder removed smoke.

Commit `feat(book): page with chapter list, editor and export buttons`

### Task 3: Export EPUB + PDF (TDD)

**Files:**
- Create: `src/features/manuscript/Export.tsx`, `src/features/manuscript/buildBook.ts`
- Modify: ManuscriptPage (Export row)
- Test: `src/features/manuscript/export.test.tsx`

**Interfaces:**
- Consumes: store, renderMarkdown, `epub-gen-memory` (lazy).
- Produces: `buildBookHtml(manuscript, opts?: { stripImages?: boolean }): string` — doc with `<h1>title</h1> <p>author</p>` + per chapter `<h2>heading</h2>` + `renderMarkdown(content)`; unit tests (exact cases: h1/h2/order, empty body → "Sem conteúdo ainda." paragraph). `ExportRow`: EPUB button (loading state, disabled rule) → assemble `{ title, author, content: [{ title: heading, data: renderMarkdown(content) }...] }` → mock-safe dynamic import → `window.URL.createBlobObjectURL`-style download `<slug>.epub`; PDF button → renders `<PrintBook/>` (portal div `.print-book` with buildBookHtml injected) + `window.print()`; `@media print` CSS per constraints.

Cases: buildBookHtml structure; EPUB mocked (vi.mock epub-gen-memory → returns fake ArrayBuffer) + download stub (anchor href blob:) `<slug>.epub`; failure path (mock throws) → toast + button re-enabled; PDF: PrintBook mounts with book html; disabled when no chapters.

NOTE: window.print stub in jsdom (defineProperty). Commit `feat(book): epub and pdf export`

### Task 4: gates + docs + whole-branch review + merge (controller)

Spec status note; browser smoke (create book → chapters → export buttons visible → EPUB flow mocked NOT run in browser (blob download fine) → PDF print dialog skipped in headless but PrintBook visual ok); whole-branch review → fix wave → re-review → merge.

## Self-review notes

- Spec §1–§8 coverage: store (T1), page/editor (T2), export (T3), a11y/copy (T2), errors (T3), testes (T1–T3).
- Cross-feature imports documented (renderMarkdown from entries/markdown.ts, useDebouncedDraft in src/ui).
- Type consistency: Manuscript/Chapter names match domain; moveChapter(dir) signed.