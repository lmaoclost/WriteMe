# Scriptorium — Códex Design (sub-projeto 3)

Data: 2026-10-14
Escopo: códex de entries (person/place/faction/event/item/lore) com edição em markdown, imagens de capa, links estruturados entre entradas, filtro/busca e navegação de grafo. Fecha o loop aberto no Atlas: pins e regiões já são vinculáveis a entries.

## 1. Rotas

| Rota | Conteúdo |
|---|---|
| `/p/:projectId/entries` | Códex: sidebar-lista (filtro categoria + busca por título), painel central do entry selecionado; criar/excluir |
| (nenhuma rota extra) | Entry = estado selecionado na mesma rota (view única com painel) |

`src/features/entries/`: `CodexPage.tsx`, `EntryList.tsx`, `EntryView.tsx`, `EntryEditor.tsx`, `MarkdownView.tsx`, `codex.css`.

## 2. Editor (decisão aprovada)

- Textareas para `title` (inline, header) e `body` com **toggle Escrever/Prévia** (markdown render).
- Markdown render: **`marked`** (única dep nova). Sanitização por allowlist (sem DOMPurify): parse com DOMParser → whitelist de tags (`p h1-6 ul ol li blockquote code pre em strong b i a[title] br img`) → `<img>` só com `src` `data:image/` do store; atributos de estilo/evento/tags fora da lista viram texto; atributos removidos exceto `src`/`title`/alt. marked com `{ breaks: true, mangle: false, headerIds: false }`.
- Campos: título (header), categoria (select 6), capa (imagem: upload ou de outra entry — reutiliza FilePicker pattern do Atlas), body, links (chips + picker de entries; auto-recíproco? NÃO — um lado só, igual).

## 3. Store (ação mínima, schema v1 intocado)

- `addEntry(projectId, category?): Entry` (título "Sem título")
- `updateEntry(id, patch)`, `deleteEntry(id)` (limpa imagens, e links EM OUTRAS entries que apontavam pra ela — higiene)
- `linkEntries(fromId, toId)`, `unlinkEntries(fromId, toId)`
- `putEntryImage(entryId, dataUrl): boolean` (troca/limpa antigas — higiene de imagem como atlas)
- Persistência/validação: já v1; nada novo.

## 4. Visual (Ink & Sigil, quieto)

- Sidebar: lista com categoria colorida por ponto (6 cores discretas da paleta seed) + título; filtro por categoria (chips) e busca.
- Painel: capa (se houver) + título serifada grande + categoria como eyebrow + body markdown + seção "Vínculos" (chips com entrada-link → navega selecionando).
- Empty states: "O códex está vazio — registre a primeira entrada."
- Editor: botão "Nova entrada" cria e foca título; edição sempre ativa (local state + commit on change com debounce 300ms — para não inundar histórico… NÃO há histórico no códex: store commita direto, persist middleware salva).

## 5. Integração Atlas ↔ Códex

- `PinPanel`/`RegionPanel` LinkPicker JÁ lista entries do projeto (Task AT7) — passa a navegar: clicar no título do vínculo abre o códex com a entry selecionada (route/state: `navigate(\`../entries\`, { state: { select: entryId } })` — `CodexPage` lê `location.state?.select`).
- Tooltip de pin mostra título do entry linkado (já implementado).

## 6. Erros/edge

- Delete de entry: confirmação inline (chips "Confirmar?" como no Atlas) + toast; links externos limpos.
- Body vazio → painel mostra "Sem conteúdo ainda." 
- Imagem grande: mesmo util (2048/jpg.9/png-alpha) + rollback.
- marked parse: try/catch → fallback texto plano com toast uma vez.

## 7. Testes (TDD)

- store: CRUD entry + delete limpa links inversos/imagem; linkEntries/unlink (dedupe); putEntryImage troca+limpa.
- UI: lista render + filtro categoria + busca; criar → seleciona; editar body/título (debounce commit); toggle prévia renderiza markdown (h1/strong/code); chips de vínculo + navegação; delete com confirm; integração: LinkPicker do atlas navega ao códex (smoke).
- marked: casos (h1, strong, code, parágrafo) + strip de `<script>`.

## 8. Fora de escopo

Wikilinks `[[...]]` no texto, versões/história de entradas, uploads múltiplos, grafo visual (faction web — sub-projeto 5).