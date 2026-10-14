# Scriptorium

Worldbuilding e escrita local: mundos, atlas de mapa com regiões e pins, códex e manuscrito — tudo no navegador, sem servidor.

## Run

    npm install
    npm run dev

## Testes

    npm test
    npm run typecheck && npm run lint

## Dados

localStorage (`scriptorium.v1`), com backup automático caso o storage corrompa (`scriptorium.corrupt.<iso>`). Export/import de JSON na visão geral do projeto.

## Arquitetura (resumo)

- Estado global com zustand + middleware persist, chave `scriptorium.v1` no localStorage.
- Rotas com React Router: `/` (biblioteca), `/project/:id` (workspace) e placeholders de atlas/entries/manuscript.
- Organização por features: `atlas/`, `entries/`, `manuscript/` planejados como sub-projetos 2–4 da fundação.