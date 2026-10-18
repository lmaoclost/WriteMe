# Spec: Hydration gate (deep links com reload pleno)

Data: 2026-10-17 · Sequência natural da fase 3 (bug identificado no review).

## Problema

`zustand/persist` rehydrata async; em reload pleno numa URL funda (`/p/:id/...`, `?e=`), o primeiro render vê o store vazio → `WorkspaceLayout` faz `Navigate "/"` (e toast "This world doesn't exist") antes do storage chegar. Navegação SPA não é afetada; URL colada/F5 sim.

## Design

1. `AppRouter` (ou um `RouterGate`) espera `useScriptorium.persist.hasHydrated()` antes de montar `Routes`:
   - `useEffect` assina `onFinishHydration` + `onRehydrateStorage`; estado local `hydrated`.
   - Fallback: tela mínima `bg-background` (sem spinner novo — YAGNI).
   - Só na PRIMEIRA montagem: após hydrate, render normal; o estado hydrate NÃO é re-observado depois (sem loops com persist updates).
2. Nada muda nos componentes de rota; testes jsdom: store tests renderizam `AppRouter` com storage jsdom — hydration é imediata lá (localStorage sync) → 1 microtask; `App.test`/`Workspace shell` suites devem continuar verdes (await findBy se preciso).
3. Gate NÃO bloqueia para ever: após hidratado, renderiza sempre.

## Aceite

- Reload em `/p/:id/entries` permanece na página (Playwright: navigate direto + assert panel/URL).
- Gates verdes.
- O toast de "mundo não existe" NÃO dispara em reload de rota válida.