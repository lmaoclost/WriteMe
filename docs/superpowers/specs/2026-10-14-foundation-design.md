# Scriptorium — Foundation Design (sub-projeto 1)

> Status 2026-10-14: Fundação implementada (tasks 1–10).

Data: 2026-10-14
Escopo: implementação local em React. Este documento cobre o **Foundation** — sub-sistema 1 de 5. O app inteiro foi decomposto em: (1) Foundation, (2) Atlas, (3) Entries/Lore, (4) Manuscript, (5) Extras (timeline, bloodline, factions, calendar).

## 1. Visão

Editor local de worldbuilding e escrita: um usuário, um browser, sem backend. Todo o estado vive em localStorage. O Foundation entrega o shell da aplicação, a camada de dados versionada e o CRUD de projetos, com rotas placeholder para as features futuras — o que já permite navegar num app visualmente acabado.

## 2. Stack

- Vite + React 18 + TypeScript (`strict`)
- React Router (rotas de projeto)
- zustand + `persist` (localStorage) — sem Redux, sem Context global
- @fontsource-variable/fraunces, @fontsource-variable/inter, @fontsource/jetbrains-mono (offline)
- Vitest + React Testing Library + jsdom
- Zero dependências de mapa ou editor: a geometria do Atlas (sub-projeto 2) é escrita à mão, conforme especificado

## 3. Arquitetura

```
src/
  app/        shell, rotas, tema (Ink & Sigil), toasts
  data/       store única (slices), persistência, migrate, seed
  domain/     tipos + geometria compartilhada (entregue no Atlas)
  features/
    projects/ lista + CRUD de projetos
    atlas/    editor de mapa (sub-projeto 2; placeholder agora)
    entries/  codex (sub-projeto 3; placeholder agora)
    manuscript/ livro (sub-projeto 4; placeholder agora)
  ui/         Button, Field, Modal, Toast, Icon (mínimo necessário)
```

Fluxo de dados: componentes leem por seletores (`useStore(s => ...)`) e mutam por actions do store. Toda mutação marca `updatedAt` do projeto afetado. Nenhum estado de domínio fora do store.

## 4. Rotas

| Rota | Conteúdo |
|---|---|
| `/` | Biblioteca: grade de projetos com capa, nome, contagens; criar/excluir |
| `/p/:projectId` | Workspace com rail esquerdo: Overview, Atlas, Entries, Manuscript |
| `/p/:projectId` (overview) | Resumo do projeto + atalhos + export/import de JSON |
| `/p/:projectId/atlas` | Placeholder com empty state até o sub-projeto 2 |
| `/p/:projectId/entries` | Placeholder até o sub-projeto 3 |
| `/p/:projectId/manuscript` | Placeholder até o sub-projeto 4 |

Projeto inexistente → `/` com toast indicativo.

## 5. Modelo de dados (schema v1)

```ts
type Project = { id, name, description, coverImageKey?, createdAt, updatedAt }
type WorldEntry = { id, projectId, title, category, body (md), imageKey?, links: entryId[] }
type Atlas     = { id, projectId, name, mapImageKey?, regions: Region[], pins: Pin[] }
type Pin       = { id, x, y, type, color, label, entryId? }        // x,y ∈ [0,1]
type Region    = { id, points: {x,y}[], color, fillOpacity, label, entryId? }
type Manuscript= { id, projectId, title, author, chapters: Chapter[] }
type Chapter   = { id, heading, content (md), order }
```

Regras:

- IDs: `"<ente>_" + random`, (`pin_x1y2z3`).
- Coordenadas do atlas já nascem normalizadas (0–1) para casar com o sub-projeto 2.
- `imageKey`/`coverImageKey` resolvem dataUrls num mapa próprio da store (`images: Record<string, string>`).
- Upload de imagem: resize por canvas para um cap de 2048px no lado maior, qualidade 0.9, PNG só quando há alpha — a política do `compressMapImage`. Alvo: dataUrl ≤ ~1MB por imagem.
- Deleção de projeto é confirmada por modal e remove em cascata (entries, atlases, manuscripts, imagens órfãs).

## 6. Persistência e versões

- Chave principal: `scriptorium.v1` (zustand persist). `partialize` exclui só estado efêmero (rota ativa, modais).
- `version` no schema; `migrate` encadeia versões a partir da v1. v1 é a inicial.
- Fallback de corrupção: JSON inválido ou shape inesperado → o valor cru é movido para `scriptorium.corrupt.<iso>` antes de qualquer reset, um toast explica o ocorrido e a app abre vazia. Nada de dados some sem cópia.
- Export/Import: download de JSON completo do estado; import valida shape, rejeita com erro claro e não mescla silenciosamente.

## 7. Seed de demonstração (requisito do usuário)

Uma flag (`scriptorium.seeded`) no primeiro uso oferece (e após isso fica disponível em Overview → "Carregar projeto de exemplo") um projeto completo populado:

- entries de todas as categorias (person, place, faction, event, item, lore) com textos de exemplo e links entre si;
- 1 atlas nomeado com mapa procedural (SVG gerado em runtime → dataUrl, sem binário no repo), algumas regiões em ink wash e pins de cada tipo;
- 1 manuscrito com 3 capítulos de exemplo;
- pode ser excluído como qualquer projeto — é só um projeto.

## 8. Identidade visual — "Ink & Sigil" (aprovada)

- Paleta (tokens CSS custom properties):
  `--ink #12121E` (fundo) · `--night #1A1A2E` (painéis) · `--parchment #E8DCC3` (texto) · `--gold #C9A227` (acento único) · `--slate #7A7A99` (texto secundário) · `--ember #A64B35` (só destrutivo).
- Tipografia: Fraunces (display/títulos), Inter (corpo), JetBrains Mono (coords, slugs, números).
- Firma visual: monograma do app como selo de cera dourada no rail; labels de navegação em small-caps espaçadas; regiões em "ink wash" quando o Atlas chegar.
- Resto quieto: sem gradientes, sem sombras duras, foco visível de teclado respeitado, tema único escuro nesta fase.

## 9. Tratamento de erros

- `parse` do localStorage sempre em try/catch com fallback do §6.
- Ações de importação e seed seguras: validação antes de aplicar; undo do seed = deletar o projeto exemplo.
- Empty states instruem a próxima ação ("Crie seu primeiro mundo"), nunca descrevem o sistema.

## 10. Testes (TDD)

- Store primeiro: CRUD de projetos, cascade delete, migrate/versões, recuperação de corrupção, resolução de imagens órfãs, export/import (shape + rejeição).
- Rotas: smoke em RTL — lista renderiza, projeto abre, rota inválida volta com toast.
- Geometria do Atlas só entra no sub-projeto 2, com os mesmos critérios.

## 11. Fora de escopo deste sub-projeto

Editor de mapa, codex funcional, exportação EPUB/PDF, multi-usuário, sincronização, crônicas/feed. Cada um é um spec próprio (sub-projetos 2–5).