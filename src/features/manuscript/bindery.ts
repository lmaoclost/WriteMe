/** Bindery book materials — fonts, trim sizes, page css. */

export const BINDERY_FONTS: { id: string; label: string; stack: string }[] = [
  { id: "georgia", label: "Georgia", stack: "Georgia, serif" },
  { id: "times", label: "Times New Roman", stack: '"Times New Roman", Times, serif' },
  { id: "palatino", label: "Palatino", stack: '"Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif' },
  { id: "garamond", label: "Garamond", stack: '"EB Garamond", Garamond, "Book Antiqua", serif' },
  { id: "baskerville", label: "Baskerville", stack: '"Libre Baskerville", Baskerville, "Baskerville Old Face", serif' },
  { id: "literata", label: "Literata", stack: 'Literata, Georgia, serif' },
  { id: "sans", label: "Sans serif", stack: "Inter, system-ui, sans-serif" },
];

export const BINDERY_TRIMS: { id: string; label: string }[] = [
  { id: "5x8", label: '5 × 8"' },
  { id: "5.25x8", label: '5.25 × 8"' },
  { id: "5.5x8.5", label: '5.5 × 8.5"' },
  { id: "6x9", label: '6 × 9"' },
  { id: "6.14x9.21", label: '6.14 × 9.21" (digest)' },
  { id: "7x10", label: '7 × 10"' },
];

export function trimToPage(trim: string): string {
  const parts = trim.split("x");
  return `${parts[0]}in ${parts[1]}in`;
}

/** Live book stylesheet driven by the bindery config. */
export function binderyCss(font: string, trim: string, opts: { dropCaps: boolean; runningHead: boolean } | undefined): string {
  const page = trimToPage(trim);
  return [
    `@page { size: ${page}; margin: 0.75in 0.7in; }`,
    `.print-book { font-family: ${font}; }`,
    opts?.dropCaps ? `.print-book .chapter > p:first-child::first-letter { font-size: 2.6em; float: left; line-height: 0.8; padding: 0 6px 0 0; font-family: var(--font-display, Georgia, serif); color: #241c08; }` : "",
    opts?.runningHead ? "" : "",
  ].filter(Boolean).join("\n");
}