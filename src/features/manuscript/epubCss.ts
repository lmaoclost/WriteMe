/** Generated EPUB stylesheet — the print book's typographic voice (fonts,
 *  size, leading, first-line indent, justification, chapter openers, scene
 *  ornaments, drop caps) with none of the page geometry: no @page, no trim
 *  size, no folio, no running heads, no mirrored margins. The reading
 *  system owns the page box; reflow owns the type. */

import type { BinderyConfig, SceneOrnament } from "../../domain/types";

/** CSS string literal: escape backslashes and quotes for content: "...". */
const cssStr = (text: string) => text.replaceAll("\\", "\\\\").replaceAll('"', '\\"');

const ORNAMENT_GLYPHS: Record<SceneOrnament, string> = {
  blank: "", asterisks: "* * *", asterism: "⁂", fleuron: "❦", rule: "",
};

export function buildEpubCss(config: BinderyConfig): string {
  const bodyPt = config.typography?.bodyPt ?? 11;
  const leading = config.typography?.leading ?? 14.5;
  const indent = config.typography?.indent ?? 1;
  const justify = config.typography?.justify ?? true;
  const rules: string[] = [
    `body { font-family: ${config.font}; font-size: ${bodyPt}pt; line-height: ${leading / bodyPt}; }`,
    `p { margin: 0; text-align: ${justify ? "justify" : "left"}; widows: 2; orphans: 2; }`,
    `p + p, blockquote + p, ul + p, ol + p { text-indent: ${indent}em; }`,
    `h1 + p, h2 + p, h3 + p, .chapter-note + p { text-indent: 0; }`,
  ];
  if (config.typography?.hyphens) rules.push(`p { hyphens: auto; -webkit-hyphens: auto; }`);
  rules.push(
    `.chapter h2 { margin: 0 0 1.2em; text-align: center; }`,
    `.chapter h2 .ch-num { display: block; font-size: 0.8em; letter-spacing: 0.2em; text-transform: uppercase; margin-bottom: 0.4em; }`,
    `.scene-marker { text-align: center; letter-spacing: 0.3em; margin: 1.5em auto; }`,
  );
  // scene break: punctuation marker prints as the configured ornament (glyph
  // on ::before, blank keeps the air, rule draws a short rule); an authored
  // line (.scene-marker.text) keeps its own words, same centered shape
  const ornament = config.sceneOrnament ?? "asterism";
  if (ornament === "blank") {
    rules.push(`.scene-marker.ornament { height: 1.5em; }`);
  } else if (ornament === "rule") {
    rules.push(`.scene-marker.ornament { border-top: 1px solid currentColor; width: 4em; }`);
  } else {
    rules.push(`.scene-marker.ornament::before { content: "${cssStr(ORNAMENT_GLYPHS[ornament])}"; }`);
  }
  rules.push(
    `.part-divider { text-align: center; }`,
    // the number is a <p>: the body's `text-align` matches it directly and
    // beats the divider's inherited centring, so this rule must set it
    `.part-num { font-size: 0.8em; letter-spacing: 0.2em; text-transform: uppercase; margin-bottom: 0.4em; text-align: center; }`,
    `.part-title { font-size: 1.6em; margin: 0 0 1.2em; }`,
    `.part-epigraph { font-style: italic; max-width: 60%; margin: 0 auto; }`,
    `.epigraph { font-style: italic; max-width: 60%; margin: 0 auto; }`,
    `figure, img { max-width: 100%; height: auto; }`,
  );
  if (config.dropCaps) {
    rules.push(`.chapter > p:not(.empty):first-of-type::first-letter { font-size: 2.6em; float: left; line-height: 0.85; padding-right: 0.08em; }`);
  }
  return rules.join("\n");
}
