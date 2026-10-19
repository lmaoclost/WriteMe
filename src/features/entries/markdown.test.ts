import { describe, expect, it } from "vitest";
import { renderMarkdown, isHtmlFragment } from "./markdown";

describe("renderMarkdown", () => {
  it("renders h1", () => {
    expect(renderMarkdown("# Título")).toContain("<h1>Título</h1>");
  });
  it("renders strong", () => {
    expect(renderMarkdown("**foco**")).toContain("<strong>foco</strong>");
  });
  it("renders inline code", () => {
    expect(renderMarkdown("`código`")).toContain("<code>código</code>");
  });
  it("renders fenced code inside pre", () => {
    expect(renderMarkdown("```\nx = 1\n```")).toContain("<pre><code>x = 1\n</code></pre>");
  });
  it("wraps plain text in a paragraph", () => {
    expect(renderMarkdown("Texto simples")).toContain("<p>Texto simples</p>");
  });
  it("renders empty body as empty string", () => {
    expect(renderMarkdown("")).toBe("");
  });
  it("converts script tag into inert text", () => {
    const out = renderMarkdown("antes\n\n<script>alert(1)</script>\n\ndepois");
    expect(out).not.toContain("<script");
    expect(out).toContain("alert(1)");
  });
  it("strips inline event attributes from img", () => {
    const out = renderMarkdown('<img src="data:image/png;base64,AAA" onerror="boom()">');
    expect(out).not.toContain("onerror");
    expect(out).toContain("<img");
    expect(out).toContain("data:image/png;base64,AAA");
  });
  it("strips style/event attrs from spans, keeps only class/aria-hidden, keeps text", () => {
    const out = renderMarkdown('<span onerror="x" style="color:red" class="wiki-link-icon" aria-hidden="true">t</span>');
    expect(out).not.toContain("onerror");
    expect(out).not.toContain("style");
    // the span itself survives (the wikilink icon wrapper needs it), but with
    // only its allowlisted attributes
    expect(out).toBe('<span class="wiki-link-icon" aria-hidden="true">t</span>');
  });
  it("drops href from links but keeps text and title", () => {
    const out = renderMarkdown('<a href="https://x.com" title="Ex">texto</a>');
    expect(out).not.toContain("href");
    expect(out).toContain('title="Ex"');
    expect(out).toContain(">texto</a>");
  });
  it("keeps img with data:image src", () => {
    const out = renderMarkdown('<img src="data:image/png;base64,AAA" alt="mapa">');
    expect(out).toContain('src="data:image/png;base64,AAA"');
    expect(out).toContain('alt="mapa"');
    expect(out).toContain("<img");
  });
  it("drops external img src but falls back to alt text", () => {
    const out = renderMarkdown('<img src="https://x.com/i.png" alt="mapa">');
    expect(out).not.toContain("<img");
    expect(out).toContain("mapa");
  });
  it("drops external img without alt entirely", () => {
    expect(renderMarkdown('<img src="https://x.com/i.png">')).not.toContain("<img");
  });
  it("escapes attribute quote breakout in img alt", () => {
    const out = renderMarkdown('<img alt=\'x" onerror="alert(1)\' src="data:image/png;base64,x">');
    expect(out).toContain('alt="x&quot; onerror=&quot;alert(1)"');
    const img = new DOMParser().parseFromString(out, "text/html").querySelector("img");
    expect(img?.getAttribute("onerror")).toBeNull();
  });
  it("keeps nested formatting when a disallowed wrapper is dropped", () => {
    expect(renderMarkdown("<div><strong>x</strong></div>")).toContain("<strong>x</strong>");
  });
  it("sanitizes nested content inside disallowed wrappers", () => {
    const out = renderMarkdown("<div><a href='https://x.com'>y</a></div>");
    expect(out).toContain("<a>y</a>");
    expect(out).not.toContain("href");
  });
});

describe("rich editor HTML passthrough", () => {
  it("HTML content renders sanitized without markdown processing", () => {
    const html = '<p><b>negrito</b> e <u>linha</u></p>';
    expect(renderMarkdown(html)).toContain("<b>negrito</b>");
    expect(renderMarkdown(html)).toContain("<u>linha</u>");
    expect(renderMarkdown(html)).not.toContain("&lt;");
  });
  it("script/attrs discarded; align kept on div", () => {
    expect(renderMarkdown('<div align="center">x</div>')).toContain('align="center"');
    expect(renderMarkdown('<div onclick="x()" style="evil">x</div>')).not.toContain("onclick");
    expect(renderMarkdown("<p><img src='https://x' onerror='y'>z</p>")).not.toContain("onerror");
  });
  it("keeps only text-align in a style attribute, drops the rest", () => {
    const out = renderMarkdown('<p style="text-align: center; position: fixed; background:url(javascript:x)">x</p>');
    expect(out).toContain("text-align: center");
    expect(out).not.toContain("position");
    expect(out).not.toContain("javascript");
  });
  it("drops a style attribute with no allowed declaration", () => {
    expect(renderMarkdown('<p style="color:red">x</p>')).not.toContain("style");
  });
  it("markdown still works (mixed content starts with tag = html, else md)", () => {
    expect(renderMarkdown("# Título")).toContain("<h1>");
    expect(isHtmlFragment("# Título")).toBe(false);
    expect(isHtmlFragment("<p>x</p>")).toBe(true);
  });
});
