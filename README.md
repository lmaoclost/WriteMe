# Scriptorium

Worldbuilding e escrita local: mundos, atlas de mapa com regiões e pins, códex e manuscrito — tudo no navegador, sem servidor.

## Run

    npm install
    npm run dev

## Stack

React 18 + Vite + TypeScript · Tailwind CSS v4 + shadcn/ui · Zustand.

## Navegadores

Alvo: Safari 16.4+, Firefox 128+, Chrome/Edge 111+ (baseline do Tailwind 4: `@property`, `color-mix`, `:has`, `@container`).

Impressão/PDF: cabeças e fólios usam CSS page-margin boxes, implementados só no Chromium (Chrome/Edge 131+). Safari 18.2+ e Firefox imprimem a geometria (`@page size` e margens), mas omitem cabeças e fólios. A Bindery mostra o aviso quando o engine não é Chromium.

## Testes

    npm test
    npm run typecheck && npm run lint

## Dados

localStorage (`scriptorium.v1`), com backup automático caso o storage corrompa (`scriptorium.corrupt.<iso>`). Export/import de JSON na seção **Backup** da Library (página inicial) — export/download e restore substituem a biblioteca inteira.

Imagens ficam no IndexedDB. O app pede storage persistente no boot (`navigator.storage.persist()`). Safari pode apagar dados de site após 7 dias sem interação (exceto web app instalado), então instale o app ou mantenha um backup JSON.

## Arquitetura (resumo)

- Estado global com zustand + middleware persist, chave `scriptorium.v1` no localStorage.
- Rotas com React Router: `/` (biblioteca), `/p/:projectId` (workspace: overview, atlas, entries, manuscript).
- Organização por features: `atlas/`, `entries/`, `manuscript/` planejados como sub-projetos 2–4 da fundação.