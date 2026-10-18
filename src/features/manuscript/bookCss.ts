/** Generated print stylesheet — page geometry, mirrored margins, folio.
 *  Ordered geometry first, then typography; structure rules land here too. */

import type { BinderyConfig, Part } from "../../domain/types";
import { inches, kdpGutter, pageMargins, trimToPage } from "./bindery";

export interface BookCtx {
  chapters: { heading: string; partId?: string }[];
  parts: Part[];
  pageCount: number;
}

const BASE = (config: BinderyConfig) => ({
  bodyPt: config.typography?.bodyPt ?? 11,
  leading: config.typography?.leading ?? 14.5,
  indent: config.typography?.indent ?? 1,
  justify: config.typography?.justify ?? true,
  hyphens: config.typography?.hyphens ?? false,
  mirrored: config.geometry?.mirrored ?? true,
});

export function buildBookCss(config: BinderyConfig, ctx: BookCtx): string {
  const t = BASE(config);
  const gutter = config.geometry?.gutter === "auto" || config.geometry?.gutter === undefined
    ? kdpGutter(ctx.pageCount)
    : config.geometry.gutter;
  const m = pageMargins(config.trim, gutter, t.mirrored);
  const folio = config.pageNumbers
    ? `@bottom-center { content: counter(page); font-size: 9pt; }`
    : "";
  const rules: string[] = [
    `@page { size: ${trimToPage(config.trim)}; margin: ${inches(m.top)} ${inches(m.outer)} ${inches(m.bottom)} ${inches(m.inner)}; ${folio} }`,
  ];
  if (t.mirrored) {
    rules.push(
      `@page :left { margin-left: ${inches(m.outer)}; margin-right: ${inches(m.inner)}; }`,
      `@page :right { margin-left: ${inches(m.inner)}; margin-right: ${inches(m.outer)}; }`,
    );
  }
  rules.push(`.print-book { font-family: ${config.font}; font-size: ${t.bodyPt}pt; line-height: ${t.leading / t.bodyPt}; }`);
  return rules.join("\n");
}
