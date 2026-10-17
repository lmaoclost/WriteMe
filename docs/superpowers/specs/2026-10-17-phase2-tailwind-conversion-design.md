# Spec: Fase 2 — conversão das features para Tailwind (Scriptorium)

Data: 2026-10-17 · Sucessora direta da fundação (2026-10-17-shadcn-tailwind-foundation-design.md).

## Objetivo

Converter todo o CSS próprio por feature (`src/features/**/*.css`, ~2.950 linhas em 22 arquivos) para utilitários Tailwind inline no JSX, adotar os componentes shadcn onde a fase 1 os deixou em compat (`<Button>`, `<Field>`), e substituir os `<select>` nativos por `Select` (radix). No fim, `ui.css` e todos os `features/**/*.css` saem do projeto; identidade visual do DESIGN.md preservada byte-visual (hex/tipografia/espaçamentos atuais → tokens).

## Decisões

- Select radix: SIM (usuário confirmou). Componente `@/components/ui/select` instalado via CLI com audit de React 18 (forwardRef) como na fase 1.
- Componentização: todo uso cru de `btn-primary|ghost|danger` vira `<Button kind>`; `.field` cru vira `<Field>`; `.form-stack/.form-actions` viram utilitários inline.
- `Seal` recebe prop opcional `className` (aditivo, API antiga funciona) para absorver overrides de tamanho que hoje vivem em `projects.css` (`.hub-brand .seal`).
- Ordem de conversão em 5 batches (cada um commit + gates + spot-check visual):
  - **A — Shell:** projects, workspace, overview, updates, account.
  - **B — Pequenos:** calendar, factions, conlang, oaths, plotboard, wellspring, timelinecanvas, bloodline, timeline.
  - **C — Codex:** entries (EntryList, CodexPage, EntryView, EntryPreview, ImagePicker, MarkdownView).
  - **D — Manuscript/Bindery:** manuscript, book.css, bindery.css.
  - **E — Atlas + Chronicles:** atlas (stage/panels), chronicles.
- Impressões (print) em `book.css`/`bloodline.css` escondem `.toasts` / estilizam `.paper`: mantidos — regras `@media print` migram para um `src/app/print.css` enxuto (única folha global de print) para não espalhar CSS de novo.

## Padrão de conversão

1. Cada regra CSS vira utilitários equivalente; `color-mix`/`radial-gradient` complexos permanecem como CSS-arbitrary (`bg-[…]`) ou variável existente.
2. Seletores estado-dependentes (`:hover`, `data-*`, `aria-pressed`) viram variantes utilitárias (`hover:`, `data-[…]:`); seletores de estrutura cruzada de painéis (`.panel .field > button`) viram classes no próprio elemento.
3. Fontes/tamanhos exatos preservados (`text-[15px]`, radius 4px/8px, paddings originais).
4. Testes jsdom devem passar sem edição, exceto quando consultam classe CSS ou DOM de `<select>` (radix Select muda role/estrutura) — adapta-se o teste para a nova estrutura, o comportamento continua coberto.
5. Cada feature convergida perde seu arquivo `.css` (delete); `theme.css` permanece como única folha global de tokens/base/print.

## Não-goals

- Reforma do rich editor (feedback de UX da sessão anterior) — fase 3.
- Troca de visual (só conversão fiel; DESIGN.md rege).

## Critérios de aceite

1. Zero `.css` em `src/features/` e zero regras de layout/componente em `ui.css` (arquivo apagado).
2. Gates verdes por batch: `lint`, `typecheck`, `test`, `build`.
3. Spot-check visual por batch (screenshot antes/depois, 1280×800) sem drift além de tolerância perceptual.
4. Total: nenhum `<select>` nativo em `src/features`.