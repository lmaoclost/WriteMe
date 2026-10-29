# AGENTS.md — Scriptorium

Local-first worldbuilding SPA. React 18 + Vite + TS, Tailwind v4 + shadcn/ui, zustand persist. No backend, no CI, no env vars.

## Commands

    npm run dev                       # vite dev server (no service worker)
    npm test                          # vitest run
    npx vitest run src/data/store-atlas.test.ts -t "name"   # single file/test
    npm run typecheck                 # tsc, covers src/ only (tsconfig include)
    npm run lint                      # eslint src --max-warnings 0
    npm run build                     # tsc && vite build (emits PWA service worker)

Verify before finishing: `npm run typecheck && npm run lint && npm test`. Lint fails on any warning.

## Gotchas (would burn you otherwise)

- **i18n parity**: every UI string goes in both `src/i18n/locales/en.json` and `pt-BR.json`. `src/i18n/i18n.test.ts` asserts pt-BR mirrors every EN key — one-sided strings fail tests. Tests run in EN by default (`setLanguage("en")` in `src/test/setup.ts`).
- **Theme is UI chrome, not world data**: `scriptorium.theme` (`src/ui/theme.ts`) mirrors the language pattern — own localStorage key, `light` class on `<html>`, no store slice, no persist migration (`docs/glossary.md`, ADR-0011).
- **Persistence versions**: everything is v1 — storage key `scriptorium.v1` (`src/data/storage.ts`, never rename), zustand persist `version: 1` with `migrate` in `src/data/store.ts`, backup JSON `version: 1` via `serialize` (`app: "scriptorium"`; any other version throws `unsupportedVersion` from `parseExport` in `src/data/schema.ts`). Changing persisted state ⇒ bump persist `version` + write `migrate`; changing export shape ⇒ bump export version + reject older in `parseExport`.
- **Boot must survive storage failure**: persist errors are tolerated on load (`src/data/persistence.ts`, `persistence.test.ts`). Never `throw` when localStorage/IndexedDB is unavailable or corrupt.
- **Store is one file**: `src/data/store.ts` (~130 KB) holds all slices and actions; tests split as `store-<feature>.test.ts` beside it. Domain logic belongs in `src/domain/*.ts` (pure, fully tested), not in the store.
- **No node builtins in `src/`**: browser-only bundle; `path` is shimmed with `path-browserify` via Vite alias. Node imports (`node:fs`) are fine only inside tests.
- **Vitest `maxWorkers: 4`** in `vite.config.ts` is deliberate (dev-server transform queue starves RTL awaits). Don't raise it. Tests are colocated next to the source file.
- **ESLint `eol-last`**: files missing a trailing newline fail lint.
- New workspace pages are lazy-loaded from `src/app/lazyRoutes.tsx` and registered in `src/app/router.tsx` under `/p/:projectId`.

## Naming (deliberate, not drift)

UI sections use semantic names (Lore, Chronology, Ideas, Language, Publishing, …) while routes/components keep historical vocabulary (`entries`, `linewheel`, `wellspring`, `conlang`, `bindery`). Renaming identifiers is churn on purpose — see `docs/decisions/naming-semantic-clean.md`.

## Layers

`src/domain` (pure rules) · `src/data` (persistência, store) · `src/features/<page>` (uma pasta por página) · `src/ui` + `src/components/ui` (design system) · `src/app` (rotas) · `src/i18n`.

## Reference

`README.md` (rodar/export/navegadores) · `PRODUCT.md` (verdade de produto) · `DESIGN.md` (design system + limites de paged-media) · `docs/decisions/` (ADR-0001…0012) · `docs/glossary.md`.
