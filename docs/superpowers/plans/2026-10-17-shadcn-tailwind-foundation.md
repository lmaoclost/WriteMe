# shadcn/ui + Tailwind Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adopt Tailwind v4 + shadcn/ui as the styling engine with DESIGN.md tokens mapped 1:1, without visual regression.

**Architecture:** CSS tokens stay in `src/app/theme.css` (legacy var names kept exact + shadcn semantic vars added; name collisions `--card`/`--accent` resolved via `--card-well`/`--accent-soft`). `src/ui` primitives keep their public API; `Button` becomes a shadcn cva component, `Modal` a wrapper over shadcn `Dialog`, while `Field`/`Seal`/`Toasts` and the shared `ui.css` classes are restyled with the same tokens (shadcn pattern) for feature-CSS compatibility.

**Tech Stack:** Tailwind CSS v4 (`@tailwindcss/vite`), tw-animate-css, shadcn/ui CLI, Radix (dialog), cva + tailwind-merge (`cn()`), Vitest/jsdom.

**Spec:** `docs/superpowers/specs/2026-10-17-shadcn-tailwind-foundation-design.md`

## Global Constraints

- Theme is dark-only; palette = DESIGN.md hex values exactly as in DESIGN.md (no drift).
- Public API preserved: `Button kind`, `Field label`, `Modal {title,onClose,children,closeLabel}`, `Toasts`, `pushToast/dismissToast`, `toastKindAttr`, `Seal {letter}`.
- Do not edit `src/features/**` CSS or TSX in this phase.
- Every task ends with `npm run typecheck && npm run test` green (and `npm run build` where noted) before commit.

---

### Task 1: Deps, aliases, Tailwind CSS entry

**Files:**
- Modify: `vite.config.ts`, `tsconfig.json`
- Rewrite: `src/app/theme.css`
- Modify: `package.json` (via npm install)

**Interfaces:**
- Produces: token utilities (`bg-primary`, `text-parchment`, `border-line`, …) for later tasks; `@/` import alias.

- [ ] **Step 1: Install runtime/style deps**

```bash
npm i tailwindcss@^4 @tailwindcss/vite tw-animate-css class-variance-authority clsx tailwind-merge lucide-react
npm i @radix-ui/react-dialog
```

(Radix dialog now; other radix deps arrive with shadcn components in Task 2.)

- [ ] **Step 2: Wire aliases + Tailwind plugin**

`vite.config.ts`:

```ts
/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // browser shim for deps that require the node path builtin
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      path: "path-browserify",
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      // browser shim for deps that require the node path builtin
      alias: { path: "path-browserify" },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/.worktrees/**", "**/.superpowers/**"],
  },
});
```

`tsconfig.json` — add inside `compilerOptions`:

```json
"baseUrl": ".",
"paths": { "@/*": ["./src/*"] },
```

- [ ] **Step 3: Rewrite `src/app/theme.css`** — tailwind entry + tokens (legacy exact + shadcn semantic) + base layer. Structure:

```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

:root {
  /* ===== legacy tokens — keep exact values (feature CSS depends on them) ===== */
  --bg: #1a1a2e;
  --bg-header: #16162a;
  --bg-raised: #2a2a4a;
  --panel: #2a2a44;
  --card: #333360;          /* legacy card token (unused by shadcn mapping) */
  --line: #3a3a55;
  --line-strong: #3d3d5c;
  --text: #e0e0e0;
  --text-strong: #ffffff;
  --text-muted: #a0a0b8;
  --text-faint: #888888;
  --accent: #7c5cbf;        /* legacy accent (used by feature CSS) */
  --lilac: #b89eef;
  --gold: #e0c264;
  --gold-dim: #b39642;
  --teal: #6cc5be;
  --rose: #e08a96;
  --success: #42b983;
  --success-hover: #35a372;
  --info: #3498db;
  --danger: #f44336;
  --warn: #e74c3c;

  --ink: var(--bg);
  --night: var(--bg-header);
  --night-2: var(--panel);
  --parchment: var(--text);
  --parchment-strong: var(--text-strong);
  --parchment-dim: var(--text-muted);
  --slate: var(--text-muted);
  --ember: var(--warn);
  --wax: #17131f;

  --scrim: rgb(10 10 18 / 0.7);
  --scrim-canvas: rgb(0 0 0 / 0.5);
  --seal-wax: #d8b23a;
  --seal-mid: #a3831e;
  --seal-deep: #7d6416;
  --seal-engrave: #241c08;
  --shadow-seal: 0 1px 0 rgb(255 255 255 / 0.15) inset, 0 2px 6px rgb(0 0 0 / 0.5);
  --fs-paper-h1: 30px;
  --fs-paper-h2: 21px;
  --fs-paper-title: 34px;
  --fs-paper-body: 17px;
  --paper: #fdfbf5;
  --paper-ink: #241c08;
  --paper-muted: #63583c;
  --paper-muted-soft: #9a8d6a;
  --print-ink: #000;
  --print-paper: #fff;

  /* ===== shadcn semantic tokens (mapped from DESIGN.md; dark-only) ===== */
  --background: #1a1a2e;
  --foreground: #e0e0e0;
  --card-well: #16162a;      /* cards, wells, modals (--card is the legacy token) */
  --card-well-foreground: #e0e0e0;
  --popover: #2a2a44;
  --popover-foreground: #e0e0e0;
  --primary: #e0c264;
  --primary-foreground: #17131f;
  --secondary: #2a2a44;
  --secondary-foreground: #e0e0e0;
  --muted: #2a2a44;
  --muted-foreground: #a0a0b8;
  --accent-soft: #31314e;    /* accent-soft (--accent is the legacy token) */
  --accent-foreground: #e0e0e0;
  --destructive: #f44336;
  --border: #3a3a55;
  --input: #3a3a55;
  --ring: #b39642;
  --radius: 0.5rem;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card-well);
  --color-card-foreground: var(--card-well-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent-soft);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);

  /* named palette utilities */
  --color-ink: var(--ink);
  --color-night: var(--night);
  --color-night-2: var(--night-2);
  --color-panel: var(--panel);
  --color-line: var(--line);
  --color-line-strong: var(--line-strong);
  --color-parchment: var(--parchment);
  --color-parchment-strong: var(--parchment-strong);
  --color-parchment-dim: var(--parchment-dim);
  --color-slate: var(--slate);
  --color-gold: var(--gold);
  --color-gold-dim: var(--gold-dim);
  --color-lilac: var(--lilac);
  --color-teal: var(--teal);
  --color-rose: var(--rose);
  --color-success: var(--success);
  --color-wax: var(--wax);
  --color-danger: var(--danger);

  --radius-sm: calc(var(--radius) - 4px);   /* 4px controls */
  --radius-md: calc(var(--radius) - 2px);   /* 6px */
  --radius-lg: var(--radius);               /* 8px panels/cards */
  --radius-xl: calc(var(--radius) + 4px);

  --font-sans: "Inter Variable", system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-display: "Fraunces Variable", Georgia, serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;
}

@layer base {
  html, body, #root { height: 100%; }
  body {
    margin: 0;
    @apply bg-background text-foreground font-sans;
    -webkit-font-smoothing: antialiased;
  }
  h1, h2, h3 { @apply font-display font-semibold; letter-spacing: 0.01em; margin: 0; }
  button { @apply cursor-pointer font-sans; }
  button:focus-visible, [tabindex]:focus-visible { outline: 2px solid var(--lilac); outline-offset: 2px; }
}
```

Note: deliberately OMIT the shadcn-default `* { @apply border-border outline-ring/50 }` — it would recolor borders that currently rely on `currentColor` (colored chips).

- [ ] **Step 4: Verify no regression**

```bash
npm run typecheck && npm run test && npm run build
```

Expected: all green (visual smoke comes in Task 7).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(style): tailwind v4 entry + design tokens (legacy vars exact, shadcn semantic map)"
```

---

### Task 2: `cn()` + shadcn components

**Files:**
- Create: `src/lib/utils.ts`, `components.json`
- Create (via CLI): `src/components/ui/{button,dialog,input,textarea,label,card,badge,separator}.tsx`

**Interfaces:**
- Produces: `cn(...inputs)` from `@/lib/utils`; `@/components/ui/*` components (Button/Dialog/Input/Textarea/Label/Card/Badge/Separator) available for Tasks 3, 5 and phase 2.

- [ ] **Step 1: cn helper**

`src/lib/utils.ts`:

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 2: components.json (manual — avoids CLI overwriting theme.css)**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": { "config": "", "css": "src/app/theme.css", "baseColor": "neutral", "cssVariables": true },
  "aliases": { "components": "@/components", "utils": "@/lib/utils", "ui": "@/components/ui", "lib": "@/lib", "hooks": "@/hooks" },
  "iconLibrary": "lucide"
}
```

- [ ] **Step 3: Add components**

```bash
npx shadcn@latest add button dialog input textarea label card badge separator --yes --overwrite
```

Fallback (CLI failure / network): hand-write each component from the shadcn registry source pinned to `components.json` aliases; keep classes token-based as in Task 3.

- [ ] **Step 4: Post-CLI audit**

1. `git diff src/app/theme.css` — if the CLI injected token blocks, dedupe so only the Task-1 structure remains.
2. Check generated components import from `@/lib/utils` and don't reference `next-themes`.
3. Verify radix deps installed (`npm ls @radix-ui/react-dialog @radix-ui/react-label @radix-ui/react-separator`), install missing ones manually.

- [ ] **Step 5: Verify + commit**

```bash
npm run typecheck && npm run test && npm run build
git add -A && git commit -m "feat(ui): install shadcn components (button, dialog, input, textarea, label, card, badge, separator)"
```

---

### Task 3: Button → shadcn cva (test-first)

**Files:**
- Modify (test first): `src/ui/ui.test.tsx:16-19`
- Modify: `src/ui/Button.tsx`

**Interfaces:**
- Consumes: `cn` from Task 2; palette utilities from Task 1.
- Produces: `Button` — same props (`kind?: "primary" | "ghost" | "danger"` + ButtonHTMLAttributes); no `btn-*` classes emitted.

- [ ] **Step 1: Update the failing test**

In `src/ui/ui.test.tsx`, replace the danger assertion:

```tsx
it("danger gets ember accent classes", () => {
  render(<Button kind="danger">Excluir</Button>);
  const btn = screen.getByRole("button");
  expect(btn).toHaveClass("border-destructive");
  expect(btn).toHaveClass("text-destructive");
});
```

- [ ] **Step 2: Run — expect FAIL** (`toHaveClass("border-destructive")` fails against `btn-danger`)

```bash
npx vitest run src/ui/ui.test.tsx
```

- [ ] **Step 3: Implement cva Button** — `src/ui/Button.tsx`:

```tsx
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm px-3.5 py-2 text-[15px] transition-[filter,border-color,background-color,color] duration-150 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      kind: {
        primary: "bg-gold font-semibold text-wax hover:brightness-[1.08]",
        ghost: "border border-line text-parchment-dim hover:border-gold-dim hover:text-parchment",
        danger: "border border-destructive text-destructive hover:bg-destructive/18",
      },
    },
    defaultVariants: { kind: "primary" },
  }
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>;

export function Button({ kind = "primary", className = "", ...rest }: ButtonProps) {
  return <button type="button" className={cn(buttonVariants({ kind }), className)} {...rest} />;
}
```

Design fidelity notes: radius 4px (`rounded-sm`), padding 8/14 (`px-3.5 py-2`), body size 15px, primary hover = brightness (not opacity) per DESIGN.md; focus ring comes from the global base rule, so no shadcn `ring` classes here (would double the indicator).

- [ ] **Step 4: Run — expect PASS (all suites)**

```bash
npm run typecheck && npm run test
```

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(ui): Button on shadcn cva with design-token variants (API kind preserved)"
```

---

### Task 4: ui.css restyled with tokens (no modal-*)

**Files:**
- Rewrite: `src/ui/ui.css` (delete `.modal-*`; keep `.btn-*`, `.field*`, `.toasts*`, `.seal`)

**Interfaces:**
- Consumes: palette utilities from Task 1.
- Produces: `.btn-primary/.btn-ghost/.btn-danger` with the SAME computed styles as the Task-3 cva variants (raw `<button className="btn-*">` sites in features keep rendering identically until phase 2).

- [ ] **Step 1: Rewrite ui.css** — shared classes composed of the same utilities used by the cva variants:

```css
.btn-primary {
  @apply inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm px-3.5 py-2 text-[15px]
    bg-gold font-semibold text-wax transition-[filter] duration-150 hover:brightness-[1.08]
    disabled:pointer-events-none disabled:opacity-50;
}
.btn-ghost {
  @apply inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm px-3.5 py-2 text-[15px]
    border border-line text-parchment-dim transition-colors duration-150
    hover:border-gold-dim hover:text-parchment disabled:pointer-events-none disabled:opacity-50;
}
.btn-danger {
  @apply inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm px-3.5 py-2 text-[15px]
    border border-destructive text-destructive transition-colors duration-150
    hover:bg-destructive/18 disabled:pointer-events-none disabled:opacity-50;
}
.field { @apply flex flex-col gap-1.5; }
.field-label { @apply text-xs font-semibold uppercase tracking-[0.08em] text-slate; }
.field input, .field textarea {
  @apply w-full rounded-sm border border-line bg-ink px-2.5 py-2 text-[15px] text-parchment outline-none;
}
.field input:focus-visible, .field textarea:focus-visible { @apply border-gold-dim outline-none; }
.toasts {
  position: fixed; bottom: 18px; right: 18px; z-index: 60;
  @apply flex flex-col;
  gap: 8px;
}
.toast {
  @apply flex items-center gap-2.5 rounded-sm border border-line bg-panel py-2.5 pr-3 pl-3;
  border-left: 3px solid var(--gold);
}
.toast[data-kind="error"] { border-left-color: var(--destructive); }
.toast[data-kind="success"] { border-left-color: var(--success); }
.toast-message { font: inherit; }
.toast-dismiss { @apply border-0 bg-transparent text-xs text-slate hover:text-parchment; }
.seal {
  display: inline-grid; place-items: center;
  width: 40px; height: 40px; border-radius: 50%;
  background: radial-gradient(circle at 32% 30%, var(--seal-wax), var(--seal-mid) 62%, var(--seal-deep));
  color: var(--seal-engrave); font-family: var(--font-display); font-weight: 700; font-size: 1.25rem;
  box-shadow: 0 1px 0 rgb(255 255 255 / 0.15) inset, 0 2px 6px var(--scrim-canvas);
}
.form-stack { @apply grid gap-3; }
.form-actions { @apply mt-2 flex justify-end gap-2.5; }
```

(`.form-stack`/`.form-actions` were tokenized from their literal values in the old file.)

- [ ] **Step 2: Verify + commit** — the `ui.test.tsx` "danger gets ember accent classes" no longer needs `.btn-danger` (Task 3 removed that assertion); check no other test/feature asserts `btn-*` or `modal-*`:

```bash
grep -rn "btn-danger\|modal-scrim\|modal-head" src --include="*.test.tsx"
```

Expected: (empty). Then run gates and commit.

```bash
npm run typecheck && npm run test && npm run build
git add -A && git commit -m "refactor(ui): ui.css tokenized via tailwind utilities; drop modal-* styles"
```

---

### Task 5: Modal → shadcn Dialog wrapper (test-first)

**Files:**
- Modify (test first): `src/ui/ui.test.tsx` (modal block: add scrim-click coverage)
- Modify: `src/ui/Modal.tsx`

**Interfaces:**
- Consumes: `@/components/ui/dialog` (Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose), `cn` from Task 2.
- Produces: `Modal` — same props `{title, onClose, children?, closeLabel = "Fechar"}`; role=dialog via radix; Escape/scrim/✕ all trigger `onClose` once.

- [ ] **Step 1: Extend the modal tests** — add after the Escape test in the `Field / Modal` block:

```tsx
it("modal closes on scrim click", () => {
  const onClose = vi.fn();
  const { container } = render(
    <Modal title="Excluir projeto" onClose={onClose}><p>confirmar</p></Modal>
  );
  const overlay = container.ownerDocument.querySelector("[data-slot='dialog-overlay']");
  expect(overlay).not.toBeNull();
  fireEvent.mouseDown(overlay!, { buttons: 1 });
  fireEvent.mouseUp(overlay!, { buttons: 1 });
  expect(onClose).toHaveBeenCalledTimes(1);
});
```

(Radix DismissableLayer closes on outside pointer down+up; jsdom-safe via `mouseDown`+`mouseUp` on the overlay. If the generated component lacks `data-slot="dialog-overlay"`, target `[data-radix-dialog-overlay]`? No — the shadcn template includes `data-slot` attributes; verify in Step 3 and keep this selector in sync.)

- [ ] **Step 2: Run — expect the new test to FAIL** (current Modal has no overlay element)

```bash
npx vitest run src/ui/ui.test.tsx
```

- [ ] **Step 3: Implement the wrapper** — `src/ui/Modal.tsx`:

```tsx
import type { ReactNode } from "react";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function Modal({
  title,
  onClose,
  children,
  closeLabel = "Fechar",
}: {
  title: ReactNode;
  onClose: () => void;
  children?: ReactNode | undefined;
  closeLabel?: string;
}) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="w-[min(440px,92vw)] rounded-lg bg-card p-4.5 sm:max-w-[min(440px,92vw)]">
        <DialogHeader className="flex-row items-center justify-between gap-3 space-y-0">
          <DialogTitle className="font-display font-semibold">{title}</DialogTitle>
          <DialogClose aria-label={closeLabel} className="border-0 bg-transparent text-sm text-slate hover:text-parchment">✕</DialogClose>
        </DialogHeader>
        <div className="modal-body">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
```

Also in the generated `src/components/ui/dialog.tsx`, set the overlay class to the design scrim — replace `bg-black/50` with `bg-ink/70` (≈ `rgb(10 10 18/0.70)` from DESIGN) so the scrim matches. Keep everything else standard.

Escape + scrim + close-button are radix behaviors wired to `onOpenChange → onClose`.

- [ ] **Step 4: Run full suite — expect PASS**

```bash
npm run typecheck && npm run test
```

If `getByRole("dialog", …)` fails in any feature test, radix also exposes the role; check the failing query and adapt the TEST (not the component) only if the query was asserting internals.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(ui): Modal wraps shadcn Dialog; escape/scrim/close preserved"
```

---

### Task 6: Docs

**Files:**
- Modify: `DESIGN.md` (stack note only), `README.md` (deps line)

- [ ] **Step 1:** In `DESIGN.md` Overview, append one paragraph: styling now runs on Tailwind CSS v4 + shadcn/ui; DESIGN tokens live in `src/app/theme.css` (`@theme inline`), legacy CSS variable names kept as aliases.
- [ ] **Step 2:** In `README.md`, add a stack line: React 18 + Vite + TypeScript + Tailwind v4 + shadcn/ui + Zustand.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "docs: record tailwind v4 + shadcn migration in DESIGN/README"
```

---

### Task 7: Full verification + visual spot-check

**Files:** none (verification only)

- [ ] **Step 1: Gates**

```bash
npm run lint && npm run typecheck && npm run test && npm run build
```

Expected: all green.

- [ ] **Step 2: Visual spot-check** — start `npm run dev`, screenshot hub (`/`) and a codex feature page with Playwright at 1280×800; compare against the same pages on master for identity (colors, buttons, modals, toasts). Record any drift; fix in a follow-up commit to this branch.

- [ ] **Step 3:** Final commit if fixes were needed; leave the worktree branch ready for review.

---

## Self-Review

- Spec coverage: tokens (Task 1), components (Task 2), Button (Task 3), ui.css compat classes (Task 4), Modal (Task 5), docs+verification (Tasks 6–7). Non-goals (feature CSS conversion, Select, editor) excluded per spec. ✓
- Placeholder scan: none — every code step carries full code; CLI fallback described. ✓
- Type consistency: `Button` variant prop named `kind` everywhere (matches 18 consumer files + tests); `cn` path `@/lib/utils` matches Task 2. ✓