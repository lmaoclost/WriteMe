import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppRouter } from "../../app/router";
import { useScriptorium } from "../../data/store";
import type { Manuscript } from "../../domain/types";
import { bookSections, buildBookHtml } from "./buildBook";
import { defaultBindery } from "../../data/schema";

// Real package shape: { EPub (class), default (fn), chapterDefaults, optionsDefaults }.
// The app path instantiates EPub and awaits genEpub() (render() runs inside genEpub).
const epubMock = vi.hoisted(() => ({
  genEpub: vi.fn(async () => new Uint8Array([1, 2, 3])),
  calls: [] as { options: unknown; content: unknown }[],
  expectedOrder: null as string[] | null,
}));

vi.mock("epub-gen-memory", () => ({
  EPub: class {
    constructor(public options: unknown, public content: unknown) {
      epubMock.calls.push({ options, content });
      if (epubMock.expectedOrder) {
        const chapters = Array.isArray(content) ? (content as { title?: unknown }[]) : [];
        expect(chapters.map((chapter) => chapter?.title)).toEqual(epubMock.expectedOrder);
      }
    }
    genEpub(): Promise<Uint8Array> {
      return epubMock.genEpub();
    }
  },
}));

const docxMock = vi.hoisted(() => ({
  toBlob: vi.fn(async () => new Blob(["docx-bytes"])),
}));

vi.mock("docx", () => ({
  Document: class { constructor(public options: unknown) {} },
  Packer: { toBlob: docxMock.toBlob },
  Paragraph: class { constructor(public options: unknown) {} },
  TextRun: class { constructor(public options: unknown) {} },
  HeadingLevel: { HEADING_2: 2, HEADING_3: 3, HEADING_4: 4 },
  AlignmentType: { CENTER: "center" },
}));

function lastOptions(index: number): Record<string, unknown> {
  return epubMock.calls[index].options as Record<string, unknown>;
}

function seedProject(): string {
  return useScriptorium.getState().addProject("Vellmora").id;
}

function seedBook(projectId: string, spec: {
  title: string;
  author?: string;
  chapters?: { heading: string; content?: string }[];
} = { title: "Livro sem título" }): Manuscript {
  const created = useScriptorium.getState().addManuscript(projectId, spec.title);
  if (spec.author) useScriptorium.getState().setManuscriptAuthor(created.id, spec.author);
  for (const ch of spec.chapters ?? []) {
    const chapter = useScriptorium.getState().addChapter(created.id, ch.heading);
    if (chapter && ch.content !== undefined) {
      useScriptorium.getState().updateChapter(chapter.id, { content: ch.content });
    }
  }
  const book = useScriptorium.getState().manuscripts.find((m) => m.id === created.id);
  expect(book, "seeded book should exist").toBeTruthy();
  return book as Manuscript;
}

function binderyRoute(projectId: string, bookId: string) {
  return (
    <MemoryRouter initialEntries={[`/p/${projectId}/bindery/${bookId}`]}>
      <AppRouter />
    </MemoryRouter>
  );
}

let anchorHref = "";
let anchorDownload = "";
let restoreAnchor = () => {};

function stubAnchorDownload() {
  const orig = document.createElement.bind(document);
  document.createElement = ((tag: string) => {
    const el = orig(tag) as HTMLAnchorElement;
    if (tag === "a") {
      el.click = () => {
        anchorHref = el.href;
        anchorDownload = el.download;
      };
    }
    return el as never;
  }) as typeof document.createElement;
  const origCreateObjectUrl = URL.createObjectURL;
  const origRevokeObjectUrl = URL.revokeObjectURL;
  URL.createObjectURL = vi.fn(() => "blob:mock-url");
  URL.revokeObjectURL = vi.fn();
  restoreAnchor = () => {
    document.createElement = orig;
    URL.createObjectURL = origCreateObjectUrl;
    URL.revokeObjectURL = origRevokeObjectUrl;
  };
}

beforeEach(() => {
  localStorage.clear();
  useScriptorium.setState(useScriptorium.getInitialState());
  epubMock.genEpub.mockClear();
  docxMock.toBlob.mockImplementation(async () => new Blob(["docx-bytes"]));
  docxMock.toBlob.mockClear();
  epubMock.calls.length = 0;
  epubMock.expectedOrder = null;
  stubAnchorDownload();
});

afterEach(() => {
  restoreAnchor();
  restoreAnchor = () => {};
  anchorHref = "";
  anchorDownload = "";
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("buildBookHtml", () => {
  it("renders h1 title + optional author + chapters in order with rendered markdown", () => {
    const book: Manuscript = {
      id: "b1",
      projectId: "p1",
      title: "Cantar de Vellmora",
      author: "Renan",
      chapters: [
        { id: "c2", heading: "Fim", content: "A última linha.", order: 1 },
        { id: "c1", heading: "Prólogo", content: "**Negrito** aqui.", order: 0 },
      ],
    };
    const html = buildBookHtml(book);
    expect(html.startsWith('<article class="book">')).toBe(true);
    expect(html).toContain('<h1 class="tp-title">Cantar de Vellmora</h1>');
    expect(html).toContain('<p class="tp-author">Renan</p>');
    expect(html.indexOf("Prólogo")).toBeLessThan(html.indexOf("Fim"));
    expect(html).toContain('<h2><span class="ch-num">1</span>Prólogo</h2>');
    expect(html).toContain("<strong>Negrito</strong>");
  });

  it("title page is the first page; toc follows it", () => {
    const book: Manuscript = {
      id: "b1", projectId: "p1", title: "T", author: "A",
      chapters: [{ id: "c1", heading: "Um", content: "x.", order: 0 }],
    };
    const html = buildBookHtml(book);
    expect(html.indexOf("title-page")).toBeLessThan(html.indexOf("front-matter toc"));
  });

  it("dropping the title page still gives the book its own centered title page (not glued to chapter 1)", () => {
    const book: Manuscript = {
      id: "b1", projectId: "p1", title: "T", author: "A",
      bindery: { font: "Georgia, serif", trim: "6x9", dropCaps: false, runningHead: false, titlePage: false, toc: true, glossary: false },
      chapters: [{ id: "c1", heading: "Um", content: "x.", order: 0 }],
    };
    const html = buildBookHtml(book);
    expect(html).toContain('<section class="front-matter book-title-page display"><h1 class="book-title">T</h1>');
    expect(html).toContain('<p class="book-author">A</p>');
    expect(html.indexOf("book-title-page")).toBeLessThan(html.indexOf("front-matter toc"));
    expect(html.indexOf('<h1 class="book-title">')).toBeLessThan(html.indexOf('<section class="chapter"'));
  });

  it("with the title page on, no second book-title is glued before the chapters", () => {
    const book: Manuscript = {
      id: "b1", projectId: "p1", title: "Título Página", author: "Renan",
      chapters: [{ id: "c1", heading: "Um", content: "x.", order: 0 }],
    };
    const html = buildBookHtml(book);
    expect(html).not.toContain('class="book-title"');
    expect(html.indexOf("tp-title")).toBeLessThan(html.indexOf("front-matter toc"));
  });

  it("omits the author paragraph when the author is empty", () => {
    const book: Manuscript = {
      id: "b1",
      projectId: "p1",
      title: "T",
      author: "",
      chapters: [],
    };
    expect(buildBookHtml(book)).not.toContain("book-author");
  });

  it("renders the empty-content paragraph for chapters without body", () => {
    const book: Manuscript = {
      id: "b1",
      projectId: "p1",
      title: "T",
      author: "A",
      chapters: [{ id: "c1", heading: "Vazio", content: "", order: 0 }],
    };
    expect(buildBookHtml(book)).toContain('<p class="empty">No content yet.</p>');
  });

  it("escapes book title, author and heading text", () => {
    const book: Manuscript = {
      id: "b1",
      projectId: "p1",
      title: "Livro <b>X</b>",
      author: "An & Co",
      chapters: [{ id: "c1", heading: "Cap > 1", content: "corpo", order: 0 }],
    };
    const html = buildBookHtml(book);
    expect(html).toContain("Livro &lt;b&gt;X&lt;/b&gt;");
    expect(html).toContain("An &amp; Co");
    expect(html).toContain("Cap &gt; 1");
  });
});

describe("buildBookHtml v2", () => {
  const mkBook = (patch: Partial<Manuscript> & { chapters?: Manuscript["chapters"] }): Manuscript => ({
    id: "b2", projectId: "p2", title: "A Coroa e o Rio", author: "Renan",
    chapters: [{ id: "c1", heading: "Prólogo", content: "corpo um.", order: 0 }, { id: "c2", heading: "Fim", content: "corpo dois.", order: 1 }],
    ...patch,
  });

  it("numbers chapters in arabic by default", () => {
    const html = buildBookHtml(mkBook({}));
    expect(html).toContain('<h2><span class="ch-num">1</span>Prólogo</h2>');
    expect(html).toContain('<h2><span class="ch-num">2</span>Fim</h2>');
  });

  it("word numbering covers 1-99 with compounds, falls back to arabic at 100", () => {
    const mkAt = (n: number) => {
      const chapters = Array.from({ length: n }, (_, i) => ({ id: `c${i}`, heading: `C${i + 1}`, content: "x.", order: i }));
      const html = buildBookHtml(mkBook({ chapters, bindery: { font: "Georgia, serif", trim: "6x9", dropCaps: false, runningHead: false, titlePage: false, toc: false, glossary: false, numberingStyle: "word" } }));
      return html;
    };
    expect(mkAt(21)).toContain('<span class="ch-num">Twenty-One</span>');
    expect(mkAt(99)).toContain('<span class="ch-num">Ninety-Nine</span>');
    expect(mkAt(100)).toContain('<span class="ch-num">100</span>');
  });

  it("toc rows carry the chapter number prefix when numbering is on", () => {
    const on = buildBookHtml(mkBook({}));
    expect(on).toContain('<li class="toc-row"><span class="toc-num">1</span><span>Prólogo</span>');
    const off = buildBookHtml(mkBook({ bindery: { font: "Georgia, serif", trim: "6x9", dropCaps: false, runningHead: true, titlePage: true, toc: true, glossary: false, numberingStyle: "none" } }));
    expect(off).toContain('<li class="toc-row"><span>Prólogo</span>');
  });

  it("numbering styles: none, chapter, word", () => {
    const none = buildBookHtml(mkBook({ bindery: { font: "Georgia, serif", trim: "6x9", dropCaps: false, runningHead: true, titlePage: true, toc: true, glossary: false, numberingStyle: "none" } }));
    expect(none).not.toContain('ch-num');
    const chap = buildBookHtml(mkBook({ bindery: { font: "Georgia, serif", trim: "6x9", dropCaps: false, runningHead: true, titlePage: true, toc: true, glossary: false, numberingStyle: "chapter" } }));
    expect(chap).toContain('<span class="ch-num">Chapter 1</span>');
    const word = buildBookHtml(mkBook({ bindery: { font: "Georgia, serif", trim: "6x9", dropCaps: false, runningHead: true, titlePage: true, toc: true, glossary: false, numberingStyle: "word" } }));
    expect(word).toContain('<span class="ch-num">One</span>');
    expect(word).toContain('<span class="ch-num">Two</span>');
  });

  it("print page breaks are single-sided (no break-after: page anywhere)", async () => {
    const fsp = await import("node:fs/promises");
    const bookCss = await fsp.readFile("src/app/print.css", "utf8");
    const binderyCss = await fsp.readFile("src/app/theme.css", "utf8");
    // adjacent forced breaks (break-after + break-before on touching elements)
    // make Chromium emit blank pages in print-to-PDF
    expect(bookCss).not.toMatch(/break-after:\s*page/);
    expect(binderyCss).not.toMatch(/break-after:\s*page/);
    // single-side breaks exist where the document advances a page
    expect(binderyCss).toMatch(/\.print-book \.chapter \{ break-before: page; \}/);
    expect(bookCss).toMatch(/\.print-book \.chapter \{ break-before: page; \}/);
    expect(binderyCss).toMatch(/\.print-book \.front-matter \{ break-before: page; \}/);
    expect(bookCss).toMatch(/\.print-book \.front-matter \{ break-before: page; \}/);
    expect(binderyCss).toMatch(/\.print-book \.back-matter \{ break-before: page; \}/);
    expect(bookCss).toMatch(/\.print-book \.back-matter \{ break-before: page; \}/);
  });

  it("screen sheet geometry (padding/page width) never reaches the print portal", async () => {
    const fsp = await import("node:fs/promises");
    const theme = await fsp.readFile("src/app/theme.css", "utf8");
    // the fixed 7in preview cap was the "large horizontal margins" complaint:
    // on screen the sheet fills the preview pane, the reading column stays capped
    expect(theme).toMatch(/@media screen \{\s*\.print-book \{[^}]*max-width: 100%;/s);
    expect(theme).toMatch(/\.print-book > \.book \{ max-width: 36rem; margin: 0 auto; \}/);
    expect(theme).toMatch(/\.print-book \.back-matter \{ break-before: page; \}/);
    expect(theme).toMatch(/\.print-book \.back-matter \{ padding: 3in 0 2in; \}/);
    expect(theme).not.toContain("7in");
  });

  it("renders scene markers: endMarker between paragraphs, noteTop/noteEnd around the body", () => {
    const html = buildBookHtml(mkBook({ chapters: [{ id: "c1", heading: "Um", content: "para um.\n\npara dois.", order: 0, endMarker: "⁂", noteTop: "Drafted 1204", noteEnd: "End of draft" }] }));
    expect(html).toContain('<div class="scene-marker">⁂</div>');
    expect(html).toContain('<div class="chapter-note top"><p>Drafted 1204</p>');
    expect(html).toContain('<div class="chapter-note bottom"><p>End of draft</p>');
  });

  it("running-head mode chapter uses the chapter title per section", async () => {
    const { buildBookCss } = await import("./bookCss");
    const bindery: NonNullable<Manuscript["bindery"]> = { font: "Georgia, serif", trim: "6x9", dropCaps: false, runningHead: true, titlePage: true, toc: true, glossary: false, runningHeadMode: "chapter" };
    // the chapter title no longer lives in the markup: it moves to the CSS, as a named page per chapter
    const html = buildBookHtml(mkBook({ bindery }));
    expect(html).not.toContain("running-head");
    expect(html).toContain('<section class="chapter" data-ch="1">');
    expect(html).toContain('<section class="chapter" data-ch="2">');
    const css = buildBookCss({ ...defaultBindery()!, ...bindery },
      { title: "A Coroa e o Rio", chapters: [{ heading: "Prólogo" }, { heading: "Fim" }], parts: [], pageCount: 200 });
    expect(css).toContain('@page ch1 { @top-center { content: "Prólogo";');
    expect(css).toContain('@page ch2 { @top-center { content: "Fim";');
    const book = buildBookHtml(mkBook({ bindery: { ...bindery, runningHeadMode: "book" } }));
    expect(book).not.toContain('<span class="running-head"');
  });

  it("book strings are EN: Contents, Glossary, No content yet", () => {
    const html = buildBookHtml(mkBook({ bindery: { font: "Georgia, serif", trim: "6x9", dropCaps: false, runningHead: true, titlePage: true, toc: true, glossary: true, dedication: "To the river." } }));
    expect(html).toContain("<h2>Contents</h2>");
    const emptyBody = buildBookHtml(mkBook({ chapters: [{ id: "c9", heading: "Vazio", content: "", order: 0 }] }));
    expect(emptyBody).toContain("No content yet.");
  });

  it("pageNumbers only affects the print stylesheet, not the book markup", async () => {
    const { buildBookCss } = await import("./bookCss");
    const ctx = { title: "A Coroa e o Rio", chapters: [{ heading: "Um" }], parts: [], pageCount: 100 };
    const on = buildBookCss({ ...defaultBindery()!, pageNumbers: true }, ctx);
    expect(on).toContain("counter(page)");
    const off = buildBookCss({ ...defaultBindery()!, pageNumbers: false }, ctx);
    expect(off).not.toContain("counter(page)");
  });
});

describe("buildBookHtml front matter + parts", () => {
  const plainBook = (): Manuscript => ({
    id: "b3", projectId: "p3", title: "A Coroa e o Rio", author: "Renan",
    bindery: { ...defaultBindery()!, frontMatter: { halfTitle: false, copyright: false, romanNumerals: false } },
    chapters: [{ id: "c1", heading: "Um", content: "corpo um.", order: 0 }],
  });

  const frontMatterBook = (
    frontMatter: NonNullable<NonNullable<Manuscript["bindery"]>["frontMatter"]>,
    extra: Partial<NonNullable<Manuscript["bindery"]>> = {},
  ): Manuscript => ({
    id: "b3", projectId: "p3", title: "A Coroa e o Rio", author: "Renan",
    bindery: { ...defaultBindery()!, ...extra, frontMatter },
    chapters: [
      { id: "c1", heading: "Um", content: "corpo um.", order: 0 },
      { id: "c2", heading: "Dois", content: "corpo dois.", order: 1 },
    ],
  });

  // stored order interleaves parts and ungrouped chapters on purpose:
  // render order must regroup so ungrouped chapters come first
  const mixedBook = (): Manuscript => ({
    id: "b4", projectId: "p3", title: "Aldoria", author: "Renan",
    bindery: { ...defaultBindery()!, frontMatter: { halfTitle: false, copyright: false, romanNumerals: false } },
    parts: [
      { id: "p1", title: "Primeira parte", order: 0 },
      { id: "p2", title: "Segunda parte", order: 1 },
    ],
    chapters: [
      { id: "c1", heading: "Um", content: "corpo.", order: 0 },
      { id: "c2", heading: "Dois", content: "corpo.", order: 1, partId: "p2" },
      { id: "c3", heading: "Três", content: "corpo.", order: 2, partId: "p1" },
      { id: "c4", heading: "Quatro", content: "corpo.", order: 3 },
    ],
  });

  it("renders the canonical front matter order", () => {
    const html = buildBookHtml(frontMatterBook(
      { halfTitle: true, copyright: true, romanNumerals: true, copyrightInfo: { year: "2026", holder: "Ana" }, epigraph: "*Leve, como fumo.*" },
      { dedication: "Ao rio." },
    ));
    const order = ["half-title", "title-page", "copyright", "dedication", "epigraph", "front-matter toc"]
      .map((cls) => html.indexOf(cls));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(html).toContain("© 2026 Ana");
    expect(html).toContain("All rights reserved.");
    expect(html).toContain('class="front-matter half-title display"');
  });

  it("copyright omits empty optional lines", () => {
    const html = buildBookHtml(frontMatterBook(
      { halfTitle: false, copyright: true, romanNumerals: false, copyrightInfo: { holder: "Ana" } },
    ));
    expect(html).not.toContain("ISBN");
    expect(html).not.toContain("edition");
    expect(html).not.toContain("©");
    expect(html).toContain("Cover and interior set in Scriptorium.");
  });

  it("a chapter whose part no longer exists renders with the ungrouped ones", () => {
    const book = plainBook();
    book.chapters.push({ id: "c9", heading: "Órfã", content: "corpo.", order: 1, partId: "deleted-part" });
    const html = buildBookHtml(book);
    expect(html).toContain('<section class="chapter" data-ch="2"><h2><span class="ch-num">2</span>Órfã</h2>');
  });

  it("a part opens its own divider and groups its chapters", () => {
    const html = buildBookHtml(mixedBook());
    expect(html).toContain('<section class="part-divider" data-part="1"><p class="part-num">1</p><h1 class="part-title">Primeira parte</h1>');
    // pin the body, not the TOC (whose part rows precede every chapter):
    // ungrouped chapters close before the first divider; each part's chapter
    // sits between its divider and the next one, or the end of the book
    const divider1 = html.indexOf('<section class="part-divider" data-part="1"');
    const divider2 = html.indexOf('<section class="part-divider" data-part="2"');
    const chPos = (n: number) => html.indexOf(`<section class="chapter" data-ch="${n}">`);
    expect(divider1).toBeGreaterThan(-1);
    expect(divider2).toBeGreaterThan(divider1);
    expect(chPos(1)).toBeGreaterThan(-1);
    expect(chPos(1)).toBeLessThan(divider1); // Um — ungrouped
    expect(chPos(2)).toBeLessThan(divider1); // Quatro — ungrouped
    expect(chPos(3)).toBeGreaterThan(divider1); // Três — Primeira parte
    expect(chPos(3)).toBeLessThan(divider2);
    expect(chPos(4)).toBeGreaterThan(divider2); // Dois — Segunda parte
    expect(chPos(4)).toBeLessThan(html.indexOf("</article>"));
  });

  it("front matter off and no parts keeps the pre-parts markup", () => {
    const html = buildBookHtml(plainBook());
    expect(html).not.toContain("part-divider");
    expect(html).not.toContain("half-title");
    expect(html).not.toContain("copyright");
    expect(html).toContain('<section class="chapter" data-ch="1">');
  });

  it("data-ch and the TOC follow the render order: ungrouped chapters first, then each part's chapters", () => {
    const html = buildBookHtml(mixedBook());
    // flat numbering over the render order, not per part
    const renderOrder = ["Um", "Quatro", "Três", "Dois"];
    renderOrder.forEach((heading, i) => {
      expect(html).toContain(`<section class="chapter" data-ch="${i + 1}"><h2><span class="ch-num">${i + 1}</span>${heading}</h2>`);
    });
    const rows = [
      '<li class="toc-row"><span class="toc-num">1</span><span>Um</span>',
      '<li class="toc-row"><span class="toc-num">2</span><span>Quatro</span>',
      '<li class="toc-row toc-part"><span class="toc-num">1</span><span>Primeira parte</span>',
      '<li class="toc-row"><span class="toc-num">3</span><span>Três</span>',
      '<li class="toc-row toc-part"><span class="toc-num">2</span><span>Segunda parte</span>',
      '<li class="toc-row"><span class="toc-num">4</span><span>Dois</span>',
    ];
    const positions = rows.map((r) => html.indexOf(r));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("bookSections is the render order both the markup and buildBookCss read", async () => {
    const { buildBookCss } = await import("./bookCss");
    const book = mixedBook();
    const sections = bookSections(book);
    expect(sections.map((s) => s.part?.title ?? null)).toEqual([null, "Primeira parte", "Segunda parte"]);
    expect(sections.flatMap((s) => s.chapters).map((c) => c.heading)).toEqual(["Um", "Quatro", "Três", "Dois"]);
    const css = buildBookCss({ ...defaultBindery()!, runningHead: true, runningHeadMode: "chapter" }, {
      title: book.title,
      chapters: sections.flatMap((s) => s.chapters).map((c) => ({ heading: c.heading, partId: c.partId })),
      parts: book.parts ?? [],
      pageCount: 200,
    });
    expect(css).toContain('@page ch1 { @top-center { content: "Um";');
    expect(css).toContain('@page ch2 { @top-center { content: "Quatro";');
    expect(css).toContain('@page ch3 { @top-center { content: "Três";');
    expect(css).toContain('@page ch4 { @top-center { content: "Dois";');
  });

  it("part dividers open their own page: sink, no head, no folio", async () => {
    const { buildBookCss } = await import("./bookCss");
    // book mode puts the title head on the base page — the partpage named
    // page is what keeps it off the divider
    const css = buildBookCss({ ...defaultBindery()!, runningHead: true, runningHeadMode: "book" }, {
      title: "Aldoria", chapters: [{ heading: "Um" }],
      parts: [{ id: "p1", title: "Primeira parte", order: 0 }], pageCount: 100,
    });
    expect(css).toContain(".print-book .part-divider { break-before: page; padding-top: 18%; text-align: center; }");
    expect(css).toContain(".print-book .part-divider { page: partpage; }");
    expect(css).toContain("@page partpage { @bottom-center { content: none; } @top-center { content: none; } }");
    expect(css).toContain(".print-book .part-num { font-size: 0.8em; letter-spacing: 0.2em; text-transform: uppercase; margin-bottom: 0.4em; }");
    expect(css).toMatch(/\.print-book \.part-title \{ font-size: 1\.6em;/);
    expect(css).toMatch(/\.print-book \.part-epigraph \{ font-style: italic;/);
    expect(css).not.toMatch(/break-after:\s*page/);
  });

  it("a book without parts emits no part-page rules", async () => {
    const { buildBookCss } = await import("./bookCss");
    const css = buildBookCss({ ...defaultBindery()!, runningHead: true, runningHeadMode: "book" }, {
      title: "Aldoria", chapters: [{ heading: "Um" }], parts: [], pageCount: 100,
    });
    expect(css).not.toContain("partpage");
    expect(css).not.toContain("part-divider");
  });

  it("display pages carry no folio; the TOC keeps the roman numeral", async () => {
    const { buildBookCss } = await import("./bookCss");
    const ctx = { title: "Aldoria", chapters: [{ heading: "Um" }], parts: [], pageCount: 100 };
    const on = buildBookCss({ ...defaultBindery()!, pageNumbers: true, frontMatter: { halfTitle: true, copyright: true, romanNumerals: true } }, ctx);
    expect(on).toContain("@page display { @bottom-center { content: none; } @top-center { content: none; } }");
    expect(on).toContain(".print-book .front-matter.display { page: display; }");
    expect(on).toContain("@page frontmatter { @bottom-center { content: counter(page, lower-roman); } }");
    expect(on).toContain(".print-book .front-matter { page: frontmatter; }");
    const noRoman = buildBookCss({ ...defaultBindery()!, pageNumbers: true, frontMatter: { halfTitle: true, copyright: true, romanNumerals: false } }, ctx);
    expect(noRoman).not.toContain("@page frontmatter");
    const noFolio = buildBookCss({ ...defaultBindery()!, pageNumbers: false, frontMatter: { halfTitle: true, copyright: true, romanNumerals: true } }, ctx);
    expect(noFolio).not.toContain("@page frontmatter");
  });
});

describe("EPUB export", () => {
  it("passes the project cover as EPUB cover when one exists", async () => {
    const projectId = seedProject();
    let key!: string;
    act(() => { key = useScriptorium.getState().putImage("data:image/png;base64,CAPACOVER", "cover"); });
    act(() => { useScriptorium.getState().updateProject(projectId, { coverImageKey: key }); });
    const book = seedBook(projectId, { title: "Livro Com Capa", chapters: [{ heading: "Um", content: "x." }] });
    render(binderyRoute(projectId, book.id));
    fireEvent.click(screen.getByRole("button", { name: "Exportar EPUB" }));
    await waitFor(() => expect(epubMock.calls).toHaveLength(1));
    expect((epubMock.calls[0].options as { cover?: string }).cover).toBe("data:image/png;base64,CAPACOVER");
  });

  it("omits the cover option when the project has none", async () => {
    const projectId = seedProject();
    const book = seedBook(projectId, { title: "Livro Sem Capa", chapters: [{ heading: "Um", content: "x." }] });
    render(binderyRoute(projectId, book.id));
    fireEvent.click(screen.getByRole("button", { name: "Exportar EPUB" }));
    await waitFor(() => expect(epubMock.calls).toHaveLength(1));
    expect((epubMock.calls[0].options as { cover?: string }).cover).toBeUndefined();
  });
});

describe("EPUB export", () => {
  it("assembles the book in order, downloads <slug>.epub and shows the success toast", async () => {
    const projectId = seedProject();
    const book = seedBook(projectId, {
      title: "Cantar de Vellmora",
      author: "Renan",
      chapters: [
        { heading: "Prólogo", content: "**Negrito** aqui." },
        { heading: "Fim", content: "A última linha." },
      ],
    });
    epubMock.expectedOrder = ["Prólogo", "Fim"];
    render(binderyRoute(projectId, book.id));
    fireEvent.click(screen.getByRole("button", { name: "Exportar EPUB" }));
    await waitFor(() => {
      expect(useScriptorium.getState().toasts.some((t) => t.message === "EPUB gerado.")).toBe(true);
    });
    expect(epubMock.calls).toHaveLength(1);
    expect(epubMock.genEpub).toHaveBeenCalledTimes(1);
    const content = epubMock.calls[0].content as { title: string; content: string }[];
    expect(content).toHaveLength(2);
    expect(content[0]).toMatchObject({ title: "Prólogo" });
    expect(content[0].content).toContain("<strong>Negrito</strong>");
    expect(content[1]).toMatchObject({ title: "Fim" });
    expect(lastOptions(0)).toEqual(expect.objectContaining({ title: "Cantar de Vellmora", author: "Renan", lang: "pt" }));
    expect(anchorDownload).toBe("cantar-de-vellmora.epub");
    expect(anchorHref).toBe("blob:mock-url");
    expect(screen.getByRole("button", { name: "Exportar EPUB" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Exportar EPUB" })).not.toHaveAttribute("aria-busy");
  });

  it("passes the project cover only when one exists", async () => {
    const projectId = seedProject();
    const key = useScriptorium.getState().putImage("data:image/png;base64,COVER", "cover");
    useScriptorium.getState().updateProject(projectId, { coverImageKey: key });
    const coveredBook = seedBook(projectId, { title: "A", chapters: [{ heading: "Um", content: "x" }] });
    const covered = render(binderyRoute(projectId, coveredBook.id));
    fireEvent.click(screen.getByRole("button", { name: "Exportar EPUB" }));
    await waitFor(() => expect(epubMock.calls).toHaveLength(1));
    expect(lastOptions(0)).toEqual(expect.objectContaining({ cover: "data:image/png;base64,COVER" }));
    covered.unmount();

    useScriptorium.setState(useScriptorium.getInitialState());
    const bareId = seedProject();
    const bareBook = seedBook(bareId, { title: "B", chapters: [{ heading: "Um", content: "x" }] });
    render(binderyRoute(bareId, bareBook.id));
    fireEvent.click(screen.getByRole("button", { name: "Exportar EPUB" }));
    await waitFor(() => expect(epubMock.calls).toHaveLength(2));
    expect("cover" in lastOptions(1)).toBe(false);
  });

  it("falls back to the 'livro' slug when the title has no alnum characters", async () => {
    const projectId = seedProject();
    const book = seedBook(projectId, { title: "???", chapters: [{ heading: "Um", content: "x" }] });
    render(binderyRoute(projectId, book.id));
    fireEvent.click(screen.getByRole("button", { name: "Exportar EPUB" }));
    await waitFor(() => expect(epubMock.calls).toHaveLength(1));
    expect(anchorDownload).toBe("livro.epub");
  });

  it("folds accents out of the download filename slug", async () => {
    const projectId = seedProject();
    const book = seedBook(projectId, { title: "Época Antiga", chapters: [{ heading: "Um", content: "x" }] });
    render(binderyRoute(projectId, book.id));
    fireEvent.click(screen.getByRole("button", { name: "Exportar EPUB" }));
    await waitFor(() => expect(epubMock.calls).toHaveLength(1));
    expect(anchorDownload).toBe("epoca-antiga.epub");
  });

  it("shows disabled + aria-busy while generating, then re-enables", async () => {
    const projectId = seedProject();
    const book = seedBook(projectId, { title: "A", chapters: [{ heading: "Um", content: "x" }] });
    let resolve!: (value: never) => void;
    epubMock.genEpub.mockImplementationOnce(
      () => new Promise<never>((res) => { resolve = res; }),
    );
    render(binderyRoute(projectId, book.id));
    const button = screen.getByRole("button", { name: "Exportar EPUB" });
    fireEvent.click(button);
    await waitFor(() => expect(button).toBeDisabled());
    expect(button).toHaveAttribute("aria-busy", "true");
    resolve([1, 2, 3] as never);
    await waitFor(() => expect(button).toBeEnabled());
    expect(button).not.toHaveAttribute("aria-busy");
    expect(epubMock.genEpub).toHaveBeenCalledTimes(1);
  });

  it("toasts the failure message and re-enables the button", async () => {
    const projectId = seedProject();
    const book = seedBook(projectId, { title: "A", chapters: [{ heading: "Um", content: "x" }] });
    epubMock.genEpub.mockRejectedValueOnce(new Error("boom"));
    render(binderyRoute(projectId, book.id));
    const button = screen.getByRole("button", { name: "Exportar EPUB" });
    fireEvent.click(button);
    await waitFor(() => {
      expect(useScriptorium.getState().toasts.some((t) => t.message === "Falha ao gerar o EPUB.")).toBe(true);
    });
    expect(button).toBeEnabled();
    expect(button).not.toHaveAttribute("aria-busy");
  });
});

describe("Word export", () => {
  it("downloads <slug>.docx and toasts success", async () => {
    const projectId = seedProject();
    const book = seedBook(projectId, { title: "Açúcar & Sal", chapters: [{ heading: "Um", content: "Um parágrafo." }] });
    render(binderyRoute(projectId, book.id));
    fireEvent.click(screen.getByRole("button", { name: "Exportar Word" }));
    await waitFor(() => expect(docxMock.toBlob).toHaveBeenCalledTimes(1));
    await waitFor(() => {
      expect(useScriptorium.getState().toasts.some((t) => t.message === "Word gerado.")).toBe(true);
    });
    expect(anchorDownload).toBe("acucar-sal.docx");
    expect(anchorHref).toBe("blob:mock-url");
  });

  it("toasts the failure message", async () => {
    const projectId = seedProject();
    const book = seedBook(projectId, { title: "A", chapters: [{ heading: "Um", content: "x" }] });
    docxMock.toBlob.mockRejectedValueOnce(new Error("boom"));
    render(binderyRoute(projectId, book.id));
    fireEvent.click(screen.getByRole("button", { name: "Exportar Word" }));
    await waitFor(() => {
      expect(useScriptorium.getState().toasts.some((t) => t.message === "Falha ao gerar o Word.")).toBe(true);
    });
    expect(screen.getByRole("button", { name: "Exportar Word" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Exportar Word" })).not.toHaveAttribute("aria-busy");
  });
});
