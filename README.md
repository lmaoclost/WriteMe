# WriteMe

Worldbuilding e escrita local-first: um projeto (um mundo) reúne códex, atlas, cronologia, linhagem, facções, calendário, quadro de plot, língua construída e o manuscrito final. Tudo roda no navegador, sem servidor, sem conta, sem upsell.

## Rodar

Requer Node 20.19+ (desenvolvido em Node 24).

    npm install
    npm run dev

Build de produção e preview do bundle:

    npm run build
    npm run preview

O build gera um PWA instalável (manifest + service worker). `npm run dev` não serve o service worker.

## O que tem

A biblioteca (`/`) é o launcher: lista de mundos, idioma da interface e backup. Tudo acontece dentro do workspace (`/p/:projectId`):

| Seção | Rota | O que faz |
| --- | --- | --- |
| Overview | — | Dashboard do mundo: o que existe e o que falta |
| Atlas | `atlas` | Mapas com regiões (polígonos) e pins |
| Lore | `entries` | Entradas em markdown com wikilinks, campos e tipos próprios |
| Chronology | `timeline` | Eventos datados e fronteiras de era, ligada ao calendário |
| Bloodline | `bloodline` | Árvore de linhagem em canvas |
| Factions | `factions` | Facções, membros e território no atlas |
| Oaths | `oaths` | Charta de juramentos entre personagens e casas |
| Calendar | `calendar` | Calendários inventados (meses, dias, eras) |
| Plot board | `plotboard` | Quadro de cenas em painéis, por livro/acto |
| Timeline | `linewheel` | A mesma cronologia em roda, por eras |
| Ideas | `wellspring` | Grafo de ideias e poços de inspiração |
| Language | `conlang` | Alfabeto e glifos, com export da folha em SVG |
| Manuscript | `manuscript` | Escrita: partes e capítulos |
| Publishing | `bindery` | Acabamento: trim, tipografia, página de impressão e export |

Nomes de seção são semânticos na UI; rotas e código mantêm o vocabulário histórico (`entries`, `linewheel`, `wellspring`, `conlang`, `bindery`) — ver `docs/decisions/naming-semantic-clean.md`.

## Exportar

- **Publishing → EPUB e DOCX** (botões de export; geração lazy, download direto).
- **DOCX de volta**: importar capítulo de um `.docx` (mammoth, vira HTML).
- **Print/PDF**: página de impressão com cabeças e fólios em CSS page-margin boxes.
- **Backup JSON**: seção **Backup** na Library — export e restore (substitui a biblioteca inteira).

## Idioma

Interface em English ou português (Brasil), um toggle na Library e na sidebar do workspace. Default EN, sem detecção de browser, persistido por fora do projeto (`writeme.lang`). Conteúdo do mundo é dado do usuário e pode ficar em PT — ver `docs/decisions/ADR-0009-i18n-en-ptbr.md`.

## Dados, storage e offline

- **localStorage**, chave `writeme.v1`, formato persistido v1. Docs pré-release (stamped 2) normalizam no load; docs v1 carregam direto.
- **Backup automático** se o storage corromper (`writeme.corrupt.<iso>`).
- **Imagens no IndexedDB**. O app pede storage persistente no boot (`navigator.storage.persist()`).
- **PWA**: instalável, offline após o primeiro load (service worker cacheia js, css, fontes).
- Safari apaga dados de site após 7 dias sem interação (exceto web app instalado) — instale o app ou mantenha o backup JSON.

## Navegadores

Alvo: Safari 16.4+, Firefox 128+, Chrome/Edge 111+ (baseline do Tailwind 4: `@property`, `color-mix`, `:has`, `@container`).

Impressão/PDF: cabeças e fólios usam CSS page-margin boxes, implementados só no Chromium (Chrome/Edge 131+). Safari 18.2+ e Firefox imprimem a geometria (`@page size` e margens), mas omitem cabeças e fólios. A Bindery mostra o aviso quando o engine não é Chromium.

## Testes

    npm test              # vitest + jsdom + testing-library
    npm run typecheck
    npm run lint          # eslint, zero warnings

## Arquitetura

- **Estado**: zustand + middleware persist (`src/data/store.ts`), chave `writeme.v1` no localStorage; imagens no IndexedDB.
- **Rotas**: React Router em `src/app/router.tsx` — `/` (biblioteca), `/p/:projectId` (workspace).
- **Camadas**: `src/domain` (regras puras), `src/data` (persistência), `src/features/*` (uma pasta por página), `src/ui` e `src/components/ui` (design system), `src/i18n` (en, pt-BR).

Contexto de produto e decisões: `PRODUCT.md`, `DESIGN.md`, `docs/decisions/` (ADRs).

## Licença

MIT.
