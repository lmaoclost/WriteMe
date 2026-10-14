# Scriptorium — Livro/Manuscript Design (sub-projeto 4)

Data: 2026-10-14
Escopo: manuscrito com capítulos, editor de texto (markdown), contagem de palavras, reordenação, export EPUB (client-side) + PDF via print. Encerra a trilha core: Foundation + Atlas + Códex + Livro.

## 1. Rotas

| Rota | Conteúdo |
|---|---|
| `/p/:projectId/manuscript` | Lista/estrutura do livro (capítulos em ordem, criar/excluir/reordenar, editar) — ONE VIEW como códex |

`src/features/manuscript/`: `ManuscriptPage.tsx`, `ChapterList.tsx`, `ChapterEditor.tsx`, `Export.tsx` (botões EPUB/PDF), `book.css`.

Manuscript por projeto: múltiplos OK (Multi-livro ruling) — se >1, lista no topo com select; default: primeiro. Criar/excluir livro: header (título/autor inline edit).

## 2. Modelo — schema v1 intocado

`Manuscript { id, projectId, title, author, chapters: Chapter[] }`; `Chapter { id, heading, content, order }`.
Store actions: `addManuscript(projectId, title?)`, `renameManuscript(id, title)`, `setManuscriptAuthor(id, author)`, `deleteManuscript(id)`, `addChapter(manuscriptId, heading?)`, `updateChapter(id, patch)`, `deleteChapter(id)`, `moveChapter(id, dir: -1 | 1)` (swap orders adjacentes), exportação não persiste.

## 3. Editor de capítulo

- Lista à esquerda (ordem, wordcount por capítulo), editor à direita: heading `<input>`, body textarea (mesma mecânica do códex: markdown + preview toggle + debounce 300ms + flush) — REUSE: extrair o hook `useDebouncedDraft` do EntryView para `src/ui/useDebouncedDraft.ts` (refactor pequeno, EntryView passa a usar).
- Word count: `content.trim().split(/\s+/).length` memoizado (~live no debounce commit).
- Delete: two-step; reordenação: ↑/↓ por capítulo (moveChapter swap) — sem drag-and-drop.
- Empty states: sem livro → "Comece o seu livro — crie o primeiro."; sem capítulo → "Adicione o primeiro capítulo."

## 4. Export

- **EPUB**: `epub-gen-memory` (client-side). Content: títulos/body markdown→HTML via `renderMarkdown` (sanitize já existente). Capa: `images[coverImageKey]`? Manuscript não tem cover no schema v1 — usa a capa do PROJETO quando existe (opcional, pula se ausente). Metadados: title, author, language "pt". Toast sucesso + download (`book.title.epub`).
  - Dep nova: `epub-gen-memory` (~peso ok, client-side zip).
- **PDF**: rota print — `exportPdf()`: abre `window.print()` com uma classe no root (`.print-book` que renderiza layout de livro: título + capítulos em páginas @media print) — componente `PrintBook` renderizado num portal invisível? Mais confiável: window.open("about:blank")? Não — modal de prévia com @media print no CSS (`.print-only`); PDF = o usuário imprime do dialog (padrão). Botão "Exportar PDF" = abre dialog com o livro renderizado + chama window.print() (usuário escolhe "Salvar como PDF").
- Ambos: disabled quando 0 capítulos (title attr "Adicione capítulos primeiro").

## 5. A11y/qualidade

- Focus visible; aria-labels nas setas; print CSS `@media print { aside/rail display:none }`.
- EPUB build async com loading state no botão.

## 6. Erros

- EPUB throw → toast "Falha ao gerar o EPUB." + botão reabilitado.
- Print: sem tratamento (browser handle).
- Deps: try/catch import dinâmico (lazy chunk) do epub-gen-memory.

## 7. Testes (TDD)

- store: add/rename/author/delete manuscript + chapters CRUD/moveChapter swap orders/deleteChapter (ordens renumeradas? RULING: orders NÃO renumeradas — swap só troca valores adjacêntes; gaps tolerados, sort por order).
- Export: buildBookHtml(manuscript, renderer) unit test (h1 título + h2 chapter headings + markdown body) ; EPUB mocked (vi.mock epub-gen-memory → buffer blob) download stub; PDF: PrintBook render smoke.
- UI: page render + chapter CRUD + move swap + wordcount + editor debounce/preview (fake timers) + exports disabled state.

## 8. Fora de escopo

Tabelas-livro/índice, capítulos aninhados, import .txt/.docx, sync códex→livro, versões.