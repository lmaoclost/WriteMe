import { describe, expect, it, vi } from "vitest";
import { marked } from "marked";
import { parseWikilinks, renderWithLinks, resolveWikilink, escapeHtml } from "./wikilinks";
import type { EntryCategory, WorldEntry } from "../../domain/types";

const E = (id: string, title: string, category: string = "lore"): WorldEntry => ({
  id, projectId: "p", title, category: category as EntryCategory, body: "", links: [],
});

const entries = [
  E("ent_1", "Casa Vellmor", "faction"),
  E("ent_2", "Casa Vael", "faction"),
  E("ent_3", "Aerith Vael", "character"),
];

describe("parseWikilinks", () => {
  it("extracts titles between [[ ]]", () => {
    expect(parseWikilinks("A [[Casa Vellmor]] e a [[Casa Vael]]")).toEqual(["Casa Vellmor", "Casa Vael"]);
  });
  it("empty text → none", () => {
    expect(parseWikilinks("sem links")).toEqual([]);
  });
});

describe("resolveWikilink", () => {
  it("exact match case-insensitive", () => {
    expect(resolveWikilink("casa vellmor", entries)?.id).toBe("ent_1");
  });
  it("unique prefix resolves; ambiguous prefix does not", () => {
    expect(resolveWikilink("casa vael", entries)?.id).toBe("ent_2");
    expect(resolveWikilink("casa v", entries)).toBeNull(); // 2 candidates
  });
  it("unknown → null", () => {
    expect(resolveWikilink("nada", entries)).toBeNull();
  });
});

describe("renderWithLinks", () => {
  it("resolvable [[Title]] becomes an internal anchor with data-entry-link", () => {
    const html = renderWithLinks("A [[Casa Vellmor]] governa.", entries);
    expect(html).toContain('data-entry-link="ent_1"');
    expect(html).toContain('class="wiki-link"');
    expect(html).toContain("Casa Vellmor");
    expect(html).not.toContain("[[");
  });

  it("unresolvable link degrades to plain title text", () => {
    const html = renderWithLinks("A [[Nada]] governa.", entries);
    expect(html).not.toContain("[[Nada]]");
    expect(html).toContain("Nada");
    expect(html).not.toContain("data-entry-link");
  });

  it("ambiguous prefix degrades too", () => {
    const html = renderWithLinks("[[Casa v]] é ambíguo", entries);
    expect(html).toContain("Casa v");
    expect(html).not.toContain("data-entry-link");
  });

  it("escapes the raw body when the markdown parser throws", () => {
    const spy = vi.spyOn(marked, "parse").mockImplementation(() => { throw new Error("boom"); });
    expect(renderWithLinks('<img src=x onerror="window.__pwned=1">', entries))
      .toBe('&lt;img src=x onerror="window.__pwned=1"&gt;');
    spy.mockRestore();
  });

  it("titles with quotes are escaped in attributes", () => {
    const es = [E("ent_9", 'A Casa "do Selo"')];
    const html = renderWithLinks("[[A Casa \"do Selo\"]] venceu.", es);
    expect(html).not.toContain('data-entry-link="ent_9" title="A Casa "');
    expect(html).toMatch(/title="A Casa &quot;do Selo&quot;"/);
  });
});

describe("escapeHtml", () => {
  it("escapes angle brackets", () => {
    expect(escapeHtml("<script>x</script>")).toBe("&lt;script&gt;x&lt;/script&gt;");
  });
});
