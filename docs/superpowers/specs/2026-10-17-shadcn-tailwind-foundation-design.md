# Spec: Fundação shadcn/ui + Tailwind (Fase 1)

Data: 2026-10-17 · Decisões do usuário: escopo = fundação + primitivos globais; tema = só dark (identidade do DESIGN.md).

## Objetivo

Adotar Tailwind CSS v4 + shadcn/ui como motor de estilo do Scriptorium sem regredir o visual atual do DESIGN.md ("The Scriptor's Archive"): tokens mapeados 1:1, primitivos `src/ui` preservando API, CSS de feature intacto.

## Fora de escopo (fases seguintes)

- Conversão dos ~2.900 linhas de `features/**/*.css` para utilitários Tailwind.
- `select` nativo → `Select` (radix). Reforma do rich editor e demais feedbacks de UI da sessão anterior.

## Design

### Tokens (src/app/theme.css)

1. `@import "tailwindcss"` + `@import "tw-animate-css"`; `@custom-variant dark`.
2. Bloco `:root` com os **tokens legados exatos** (exatamente os hex atuais; zero drift visual para as 22 folhas `features/**/*.css`). Nome `--card` legado (`#333360`) e `--accent` legado (`#7c5cbf`) permanecem — são usados/aterrados pelo CSS de feature.
3. Tokens semânticos shadcn adicionados ao lado, com nomes que não colidem:
   `--background:#1a1a2e`, `--foreground:#e0e0e0`, `--card-well:#16162a` (cards/wells/modals), `--popover:#2a2a44`, `--primary:#e0c264`, `--primary-foreground:#17131f`, `--secondary:#2a2a44`, `--secondary-foreground:#e0e0e0`, `--muted:#2a2a44`, `--muted-foreground:#a0a0b8`, `--accent-soft:#31314e`, `--accent-foreground:#e0e0e0`, `--destructive:#f44336`, `--border:#3a3a55`, `--input:#3a3a55`, `--ring:#b39642`, extras: `--wax:#17131f`.
4. `@theme inline:` mapeia cores para utilitários (`bg-card→var(--card-well)`, `bg-accent→var(--accent-soft)`, `bg-primary`, `border-line`, `bg-panel` etc. — incluir também o mapeamento da paleta nomeada: `ink/night/panel/line/line-strong/parchment/-strong/-dim/slate/gold/gold-dim/lilac/teal/rose/success/danger/wax`), `--radius:0.5rem` + escala shadcn, fontes `--font-sans` (Inter), `--font-display` (Fraunces), `--font-mono` (JetBrains Mono).
5. `@layer base`: body/bg/foreground, `h1..h3` em Fraunces, `button:focus-visible` outline lilac — mesmas regras de hoje, escritas com utilitários/tokens.

### Primitivos src/ui/API preservada

- `Button`: shadcn cva + variantes custom `primary` (gold bg, ink text, hover brightness 1.08) / `ghost` (transparente, borda line, hover parchment + gold-dim) / `danger` (borda ember, wash 18%). Raio 4px, padding 8px/14px (≠ default shadcn h-9). Sem emissão de classes `btn-*`.
- `ui.css`: `.btn-primary/.btn-ghost/.btn-danger/.field/.field-label/.field input·textarea/.toasts/.toast/.seal` permanecem (usados por ~20 botões nativos em features e por overrides de feature CSS) e são re-escritos com tokens/utilitários iguais aos da cva; `.modal-*` são removidos (viram Dialog).
- `Modal`: wrapper do shadcn `Dialog` (radix) com props `title/onClose/children/closeLabel`; Escape + scrim + ✕ via radix; `DialogClose` com `aria-label={closeLabel}`.
- `Field`, `Seal`, `Toasts`: ficam como componentes próprios (não substituíveis por shadcn) no "padrão shadcn" — tokens + utilitários; store `pushToast/dismissToast` e `toastKindAttr` inalterados.

### Componentes shadcn instalados (uso imediato ou preparação fase 2)

`button`, `dialog`, `input`, `textarea`, `label`, `card`, `badge`, `separator` — via CLI, em `src/components/ui/`, alias `@/`.

### Config

`tsconfig.json` (paths `@/*`) + `vite.config.ts` (plugin `@tailwindcss/vite`, alias `@`, mantém shim `path-browserify`).

## Critérios de aceite

1. `npm run test`, `typecheck`, `lint`, `build` verdes.
2. Screenshot spot-check (hub + uma página de feature) com identidade visual idêntica ao master.
3. Zero chamadas removidas de `pushToast`/`Button`/`Field`/`Modal` (API intacta).

## Riscos

- CLI shadcn reescreve CSS/instala extras → mitigado: `components.json` manual, revisar diff do CSS após `add`.
- `Dialog` radix em jsdom → testes do `ui.test.tsx` atualizados; comportamento (Escape/scrim/✕) coberto.
- Duplicação cva × ui.css `@apply` (mesmas utilidades, duas fontes) → listas mantidas em sincronia; fase 2 elimina `.btn-*`.