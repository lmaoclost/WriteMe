# Spec: Fase 3 — Editor do manuscrito organizado + fix da timeline

Data: 2026-10-17 · Escopo confirmado pelo usuário (múltipla escolha).

## Objetivo

1. Corrigir o layout da página Timeline: card largo na coluna 3, dot centrado na coluna 2 (hoje: card espremido na col de 48px, dot flutuando na coluna larga — bug do master).
2. Reorganizar o editor do manuscrito para eliminar a sensação de "botões soltos": agrupar os blocos de nota (Prologue/Epílogo/marcador do fim/calendário) num painel colapsável e mover a Exportação para um segundo painel colapsável.

## Design

### Timeline

DOM reordenado: `<span date>` → `<span dot>` → `<button card>`. Grid `160px 48px 1fr` fica com placement natural (nenhuma classe nova de posição; as antigas são removidas). Media 720px: 96px/40px/1fr (o CSS de media continua nas utilities por `max-[720px]:`). Testes jsdom mantêm queries (`.timeline-item`, `.timeline-card`, `.timeline-dot`); comportamento de cliques/labels inalterado. Screenshot comparativo browser.

### Editor

- `ChapterEditor`:
  - linha 1: heading input + pills Escrever/Preview numa única row (flex, baseline).
  - papel.
  - **Painel colapsável "Notas e cena"** (default aberto): Prologue, Epilogue, marcador do fim (`✦` + campo + remover/`+ marcador`), vínculo de calendário (picker aberto = grid).
  - footer (words + delete) — inalterado.
  - O painel não usa `Dialog`/overlay: é um `details`-like controlado por state (`aria-expanded` no trigger button estilizado pill; conteúdo sempre montado — sem perda de draft).
- `ManuscriptPage`: `ExportTools` passa a renderizar como **painel colapsável "Exportar" (default fechado)** — trigger pill + conteúdo (`book-export` row + print portal intactos). O portal `print-book` NÃO deve ser condicionado ao painel aberto (impressão funciona com o painel fechado? o print só dispara via botão dentro do painel — ao abrir o painel para exportar o portal monta ✓; nada muda).
- Todos os aria-labels/names preservados; testes adaptados apenas onde a hierarquia muda (agrupamento não deve quebrar `getByLabelText` — verify per test).

## Não-goals

- Mudar paleta/tipografia; trocar o rich editor; bindery aprofundada (fase futura).

## Aceite

1. Gates verdes (lint/typecheck/test/build).
2. Timeline: card ocupa a coluna larga (screenshot em 1280px comparável com antes).
3. Editor: painéis colapsáveis funcionam (open/close), zero labels perdidos.