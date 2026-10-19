import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildDocxChildren, docxPageSetup, docxStyles, htmlToBlocks } from "./docx";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useScriptorium } from "../../data/store";
import { DocxReplaceButton } from "./ChapterList";
import { defaultBindery } from "../../data/schema";
import type { Manuscript, SceneOrnament } from "../../domain/types";

vi.mock("mammoth", async () => {
  const convertToHtml = async () => ({ value: "<p>Importado do Word.</p>" });
  return { default: { convertToHtml }, convertToHtml };
});

// The docx classes only record their options here: the real package turns
// them into XML, so plain options are what the assertions can see.
vi.mock("docx", () => ({
  Paragraph: class {
    constructor(public options: Record<string, unknown>) {}
  },
  TextRun: class {
    constructor(public options: Record<string, unknown>) {}
  },
  HeadingLevel: { HEADING_2: 2, HEADING_3: 3, HEADING_4: 4 },
  AlignmentType: { CENTER: "center", LEFT: "left", JUSTIFIED: "both" },
  LineRuleType: { AUTO: "auto" },
  convertInchesToTwip: (n: number) => Math.round(n * 1440),
}));

const store = () => useScriptorium.getState();

beforeEach(() => {
  localStorage.clear();
  useScriptorium.setState(useScriptorium.getInitialState());
});

describe("htmlToBlocks", () => {
  it("splits into p/h/li/quote blocks", () => {
    const blocks = htmlToBlocks("<p>um</p><h2>título</h2><ul><li>a</li><li>b</li></ul><blockquote>fala</blockquote>");
    expect(blocks).toEqual([
      { kind: "p", text: "um" },
      { kind: "h2", text: "título" },
      { kind: "li", text: "a" },
      { kind: "li", text: "b" },
      { kind: "quote", text: "fala" },
    ]);
  });
  it("discards script bodies", () => {
    const blocks = htmlToBlocks("<p>ok</p><script>evil()</script>");
    expect(blocks).toEqual([{ kind: "p", text: "ok" }]);
  });
});

type MockChild = { options: Record<string, unknown> };
const opts = (child: unknown): Record<string, unknown> => (child as MockChild).options;
const runs = (child: unknown): Record<string, unknown>[] =>
  ((opts(child).children as MockChild[] | undefined) ?? []).map((r) => r.options);
const runText = (child: unknown): string =>
  runs(child).map((r) => String(r.text ?? "")).join("");

/** indent 1.5em at 12pt → 360 twips, the brief's fixture value. */
const manuscript = (): Manuscript => ({
  id: "b1",
  projectId: "p1",
  title: "Cantar de Vellmora",
  author: "Renan",
  bindery: {
    ...defaultBindery()!,
    typography: { bodyPt: 12, leading: 16, indent: 1.5, justify: true, hyphens: false },
  },
  chapters: [
    { id: "c1", heading: "Prólogo", content: "Primeiro parágrafo.\n\nSegundo parágrafo.", order: 0 },
  ],
});

/** Stored order interleaves parts and ungrouped chapters on purpose: the
 *  render order must regroup so ungrouped chapters come first, like print. */
const partsBook = (): Manuscript => ({
  id: "b4",
  projectId: "p4",
  title: "Aldoria",
  author: "Renan",
  bindery: { ...defaultBindery()! },
  parts: [
    { id: "p1", title: "Primeira parte", order: 0, epigraph: "*Leve como fumo.*" },
    { id: "p2", title: "Segunda parte", order: 1 },
  ],
  chapters: [
    { id: "c1", heading: "Um", content: "corpo.", order: 0 },
    { id: "c2", heading: "Dois", content: "corpo.", order: 1, partId: "p2" },
    { id: "c3", heading: "Três", content: "corpo.", order: 2, partId: "p1" },
    { id: "c4", heading: "Quatro", content: "corpo.", order: 3 },
  ],
});

describe("docxPageSetup", () => {
  it("applies the trim size and mirrored margins", () => {
    const setup = docxPageSetup(defaultBindery()!, { pageCount: 240, gutter: 0.5 });
    expect(setup.page.size.width).toBe(8640);   // 6in em twips
    expect(setup.page.size.height).toBe(12960); // 9in em twips
    expect(setup.page.margin.left).toBe(1080);  // 0.75in interno
    expect(setup.page.margin.right).toBe(720);  // 0.5in externo
  });

  it("gutter precedence: explicit ctx, then numeric geometry, then the KDP table", () => {
    // KDP floor for a 800-page book (0.875in) — no gutter configured
    expect(docxPageSetup(defaultBindery()!, { pageCount: 800 }).page.margin.left).toBe(1260);
    // a configured numeric gutter beats the KDP table
    const numeric = { ...defaultBindery()!, geometry: { gutter: 0.8, mirrored: true } };
    expect(docxPageSetup(numeric, { pageCount: 800 }).page.margin.left).toBe(1152);
    // the explicit ctx wins over both
    expect(docxPageSetup(numeric, { pageCount: 800, gutter: 0.5 }).page.margin.left).toBe(1080);
  });
});

describe("buildDocxChildren", () => {
  it("each chapter starts on a new page with a first-line indent", () => {
    const children = buildDocxChildren(manuscript());
    expect(children.some((c) => JSON.stringify(c).includes("pageBreakBefore"))).toBe(true);
    expect(children.some((c) => JSON.stringify(c).includes('"firstLine":360'))).toBe(true);
  });

  it("opens the book with the title, then parts on their own pages with the print order", () => {
    const children = buildDocxChildren(partsBook());
    const texts = children.map((c) => JSON.stringify(c));
    const idx = (needle: string) => texts.findIndex((s) => s.includes(needle));
    expect(idx('"Aldoria"')).toBe(0);
    // the part divider: its own page, the print number rule, centered
    const part1 = idx("Primeira parte");
    expect(part1).toBeGreaterThan(-1);
    expect(texts[part1]).toContain("pageBreakBefore");
    expect(texts[part1]).toContain('"text":"1"');
    expect(opts(children[part1]).alignment).toBe("center");
    expect(opts(children[part1]).style).toBe("BookHeading");
    // the divider's epigraph (markdown-rendered) sits between divider and chapter
    const epigraph = idx("Leve como fumo.");
    expect(epigraph).toBeGreaterThan(part1);
    expect(epigraph).toBeLessThan(idx('"Três"'));
    expect(opts(children[epigraph]).alignment).toBe("center");
    // ungrouped chapters first, then each part's chapters after its divider
    expect(idx('"Um"')).toBeLessThan(part1);
    expect(idx('"Quatro"')).toBeLessThan(part1);
    expect(idx('"Três"')).toBeGreaterThan(part1);
    expect(idx('"Três"')).toBeLessThan(idx("Segunda parte"));
    expect(idx('"Dois"')).toBeGreaterThan(idx("Segunda parte"));
    // chapter headings carry the flat print number and start a page
    const tres = idx('"Três"');
    expect(texts[tres]).toContain('"text":"3"');
    expect(texts[tres]).toContain("pageBreakBefore");
    expect(opts(children[tres]).style).toBe("BookHeading");
    expect(idx('"Dois"')).toBeGreaterThan(-1);
    expect(texts[idx('"Dois"')]).toContain('"text":"4"');
  });

  it("justifies body paragraphs and resets the indent after a heading or top note", () => {
    const book = manuscript();
    const bodies = buildDocxChildren(book).filter((c) => opts(c).style === "BookBody");
    expect(bodies).toHaveLength(2);
    // print's reset: the paragraph right after the chapter heading opens flush
    expect(opts(bodies[0]).indent).toEqual({ firstLine: 0 });
    expect(opts(bodies[0]).alignment).toBe("both");
    expect(opts(bodies[1]).indent).toEqual({ firstLine: 360 });
    expect(opts(bodies[1]).alignment).toBe("both");

    const noted = buildDocxChildren({
      ...book,
      chapters: [{ ...book.chapters[0], noteTop: "Nota de rascunho", noteEnd: "Fim do rascunho" }],
    });
    expect(opts(noted.filter((c) => opts(c).style === "BookBody")[0]).indent).toEqual({ firstLine: 0 });
    // the end note is the chapter's last paragraph (after the body, print order)
    expect(runText(noted[noted.length - 1])).toBe("Fim do rascunho");

    const ragged = buildDocxChildren({
      ...book,
      bindery: { ...book.bindery!, typography: { ...book.bindery!.typography!, justify: false } },
    });
    const alignments = ragged.filter((c) => opts(c).style === "BookBody").map((c) => opts(c).alignment);
    expect(alignments).toEqual(["left", "left"]);
  });

  it("renders markdown content into paragraphs, lists and quotes", () => {
    const children = buildDocxChildren({
      ...manuscript(),
      chapters: [{ id: "c1", heading: "Prólogo", content: "**Negrito** aqui.\n\n- um\n- dois\n\n> fala", order: 0 }],
    });
    const texts = children.map((c) => JSON.stringify(c));
    expect(texts.some((s) => s.includes("Negrito aqui."))).toBe(true);
    expect(children.some((c) => opts(c).bullet !== undefined)).toBe(true);
    expect(texts.some((s) => s.includes('"text":"fala"'))).toBe(true);
  });
});

describe("docxStyles", () => {
  it("carries the book typography in BookBody and BookHeading", () => {
    const styles = docxStyles(defaultBindery()!);
    expect(styles.paragraphStyles?.map((s) => s.id)).toEqual(["BookBody", "BookHeading"]);
    const body = styles.paragraphStyles![0];
    expect(body.paragraph?.alignment).toBe("both");
    expect(body.paragraph?.indent?.firstLine).toBe(220); // 1em at 11pt
    expect(body.paragraph?.spacing?.line).toBe(316);     // 14.5/11 in 240ths of a line
    expect(body.run?.size).toBe(22);                     // 11pt in half-points
    expect(body.run?.font).toBe("EB Garamond");
    const heading = styles.paragraphStyles![1];
    expect(heading.paragraph?.alignment).toBe("center");
    expect(heading.next).toBe("BookBody");
    // unstyled runs (bullets, quotes, notes) still get the book's font
    expect(styles.default?.document?.run?.font).toBe("EB Garamond");
    expect(styles.default?.document?.run?.size).toBe(22);
  });
});

describe("scene markers", () => {
  const withMarker = (endMarker: string, sceneOrnament?: SceneOrnament): Manuscript => ({
    id: "b1",
    projectId: "p1",
    title: "T",
    author: "",
    bindery: { ...defaultBindery()!, ...(sceneOrnament ? { sceneOrnament } : {}) },
    chapters: [{ id: "c1", heading: "Um", content: "corpo.", order: 0, endMarker }],
  });

  it("a punctuation marker becomes the configured ornament, centered", () => {
    const glyph = (ornament: SceneOrnament) => {
      const children = buildDocxChildren(withMarker("***", ornament));
      const marker = children[children.length - 1];
      expect(opts(marker).alignment).toBe("center");
      return runText(marker);
    };
    expect(glyph("asterism")).toBe("⁂");
    expect(glyph("asterisks")).toBe("* * *");
    expect(glyph("fleuron")).toBe("❦");
    expect(glyph("rule")).toBe("————"); // docx borders span the measure; em dashes stand in
    expect(glyph("blank")).toBe("");     // blank keeps the air, no glyph
  });

  it("an authored marker prints as written, in small caps", () => {
    const children = buildDocxChildren(withMarker("Fim do Um", "asterism"));
    const marker = children[children.length - 1];
    expect(runText(marker)).toBe("Fim do Um");
    expect(opts(marker).alignment).toBe("center");
    expect(runs(marker)[0].smallCaps).toBe(true);
    expect(JSON.stringify(marker)).not.toContain("⁂");
  });
});

describe("DocxReplaceButton", () => {
  it("imports html via mammoth and replaces content", async () => {
    useScriptorium.setState(useScriptorium.getInitialState());
    localStorage.clear();
    act(() => { store().addProject("V"); });
    act(() => { store().addManuscript(store().projects[0].id, "Livro"); });
    act(() => { store().addChapter(store().manuscripts[0].id, "Cap"); });
    render(<DocxReplaceButton chapterId={store().manuscripts[0].chapters[0].id} />);
    const input = screen.getByLabelText("Replace with .docx") as HTMLInputElement;
    const file = new File(["docx-bytes"], "ch.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    fireEvent.change(input, { target: { files: [file] } });
    await vi.waitFor(() => expect(store().manuscripts[0].chapters[0].content).toBe("<p>Importado do Word.</p>"), { timeout: 3000 });
  });
});
