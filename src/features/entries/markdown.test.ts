import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./markdown";

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
  it("strips style and event attributes from disallowed tags but keeps text", () => {
    const out = renderMarkdown('<span onerror="x" style="color:red">t</span>');
    expect(out).not.toContain("onerror");
    expect(out).not.toContain("style");
    expect(out).toContain("t</p>");
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
