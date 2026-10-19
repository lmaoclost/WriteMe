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
}));

vi.mock("epub-gen-memory", async (importOriginal) => {
  const actual = await importOriginal<typeof import("epub-gen-memory")>();
  return {
    ...actual,
    EPub: class {
      constructor(public options: unknown, public content: unknown) {
        epubMock.calls.push({ options, content });
      }
      genEpub(): Promise<Uint8Array> {
        return epubMock.genEpub();
      }
    },
  };
});

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
    expect(html).toContain('<div class="scene-marker ornament" aria-hidden="true"></div>');
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

describe("back matter + scene ornament", () => {
  const mkBook = (patch: Partial<Manuscript> = {}): Manuscript => ({
    id: "b5", projectId: "p5", title: "A Coroa e o Rio", author: "Renan",
    bindery: { ...defaultBindery()!, frontMatter: { halfTitle: false, copyright: false, romanNumerals: false } },
    chapters: [{ id: "c1", heading: "Um", content: "corpo um.", order: 0 }],
    ...patch,
  });

  function seedGlossaryEntry(): string {
    act(() => { useScriptorium.getState().addProject("Vellmora"); });
    const projectId = useScriptorium.getState().projects[0].id;
    act(() => { useScriptorium.getState().addEntry(projectId, "faction"); });
    act(() => {
      useScriptorium.getState().updateEntry(useScriptorium.getState().entries[0].id,
        { title: "Casa Vellmor", summary: "Dinastia do rio." });
    });
    return projectId;
  }

  it("about the author and colophon close the book", () => {
    const html = buildBookHtml(mkBook({
      bindery: {
        ...defaultBindery()!,
        font: "Georgia, serif",
        backMatter: { glossary: false, aboutAuthor: "Ana escreve em Porto Alegre.", colophon: true },
      },
    }));
    expect(html).toContain('class="back-matter about-author"');
    expect(html).toContain("Ana escreve em Porto Alegre.");
    expect(html).toContain('class="back-matter colophon"');
    // typeset from the config: the label of the configured stack + the trim
    expect(html).toContain("Set in Georgia.");
    expect(html).toContain("6in 9in");
    expect(html).toContain("Scriptorium.");
    expect(html.indexOf("about-author")).toBeLessThan(html.indexOf("colophon"));
    expect(html.indexOf("colophon")).toBeLessThan(html.indexOf("</article>"));
  });

  it("an unknown font stack falls back to the first font label in the colophon", () => {
    const html = buildBookHtml(mkBook({
      bindery: { ...defaultBindery()!, font: "Comic Sans, cursive", backMatter: { glossary: false, colophon: true } },
    }));
    expect(html).toContain("Set in Georgia.");
  });

  it("back matter sections print after the glossary and only when configured", () => {
    const projectId = seedGlossaryEntry();
    const html = buildBookHtml(mkBook({
      projectId,
      bindery: { ...defaultBindery()!, backMatter: { glossary: true, aboutAuthor: "Ana escreve em Porto Alegre.", colophon: true } },
    }));
    expect(html.indexOf("back-matter glossary")).toBeLessThan(html.indexOf("back-matter about-author"));
    expect(html.indexOf("back-matter about-author")).toBeLessThan(html.indexOf("back-matter colophon"));
    const bare = buildBookHtml(mkBook({ bindery: { ...defaultBindery()! } }));
    expect(bare).not.toContain("back-matter about-author");
    expect(bare).not.toContain("back-matter colophon");
  });

  it("glossary switch: the backMatter block wins, the legacy field is the fallback", () => {
    const projectId = seedGlossaryEntry();
    const book = (bindery: NonNullable<Manuscript["bindery"]>) =>
      buildBookHtml(mkBook({ projectId, bindery }));
    const base = defaultBindery()!;
    // advanced block on, legacy off → glossary
    expect(book({ ...base, glossary: false, backMatter: { glossary: true, colophon: false } })).toContain("back-matter glossary");
    // advanced block off wins over legacy on → no glossary
    expect(book({ ...base, glossary: true, backMatter: { glossary: false, colophon: false } })).not.toContain("back-matter glossary");
    // no block (old saved data): the legacy field decides
    expect(book({ ...base, glossary: true, backMatter: undefined })).toContain("back-matter glossary");
    expect(book({ ...base, glossary: false, backMatter: undefined })).not.toContain("back-matter glossary");
  });

  it("scene ornaments: a punctuation marker becomes the configured glyph, an authored line prints as written", async () => {
    const { buildBookCss } = await import("./bookCss");
    const ctx = { title: "A Coroa e o Rio", chapters: [{ heading: "Um" }], parts: [], pageCount: 100 };
    const css = buildBookCss({ ...defaultBindery()!, sceneOrnament: "asterism" }, ctx);
    expect(css).toContain('content: "⁂"');
    const punct = buildBookHtml(mkBook({
      bindery: { ...defaultBindery()!, sceneOrnament: "asterism" },
      chapters: [{ id: "c1", heading: "Um", content: "corpo.", order: 0, endMarker: "***" }],
    }));
    expect(punct).toContain('<div class="scene-marker ornament" aria-hidden="true"></div>');
    expect(punct).not.toContain("***");
    // the writer's line is never replaced by the glyph
    const word = buildBookHtml(mkBook({
      bindery: { ...defaultBindery()!, sceneOrnament: "asterism" },
      chapters: [{ id: "c1", heading: "Um", content: "corpo.", order: 0, endMarker: "Fim do Um" }],
    }));
    expect(word).toContain('<div class="scene-marker text">Fim do Um</div>');
    expect(word).not.toContain("scene-marker ornament");
  });

  it("blank and rule ornaments draw no glyph; asterisks and fleuron do", async () => {
    const { buildBookCss } = await import("./bookCss");
    const ctx = { title: "A Coroa e o Rio", chapters: [{ heading: "Um" }], parts: [], pageCount: 100 };
    const blank = buildBookCss({ ...defaultBindery()!, sceneOrnament: "blank" }, ctx);
    expect(blank).toContain(".print-book .scene-marker.ornament { height: 1.5em; }");
    expect(blank).not.toContain("scene-marker.ornament::before");
    const rule = buildBookCss({ ...defaultBindery()!, sceneOrnament: "rule" }, ctx);
    expect(rule).toContain(".print-book .scene-marker.ornament { border-top: 1px solid currentColor; width: 4em; }");
    expect(rule).not.toContain("scene-marker.ornament::before");
    expect(buildBookCss({ ...defaultBindery()!, sceneOrnament: "asterisks" }, ctx)).toContain('content: "* * *"');
    expect(buildBookCss({ ...defaultBindery()!, sceneOrnament: "fleuron" }, ctx)).toContain('content: "❦"');
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
    render(binderyRoute(projectId, book.id));
    fireEvent.click(screen.getByRole("button", { name: "Exportar EPUB" }));
    await waitFor(() => {
      expect(useScriptorium.getState().toasts.some((t) => t.message === "EPUB gerado.")).toBe(true);
    });
    expect(epubMock.calls).toHaveLength(1);
    expect(epubMock.genEpub).toHaveBeenCalledTimes(1);
    const content = epubMock.calls[0].content as { title: string; content: string }[];
    // default front matter (half title, copyright) rides before the numbered chapters
    expect(content.map((c) => c.title)).toEqual(["Cantar de Vellmora", "Copyright", "1 Prólogo", "2 Fim"]);
    expect(content[2].content).toContain("<strong>Negrito</strong>");
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

  it("passes bindery typography to the EPUB and keeps print-only settings out", async () => {
    const projectId = seedProject();
    const book = seedBook(projectId, { title: "Tipos", chapters: [{ heading: "Um", content: "x." }] });
    render(binderyRoute(projectId, book.id));
    fireEvent.click(screen.getByRole("button", { name: "Exportar EPUB" }));
    await waitFor(() => expect(epubMock.calls).toHaveLength(1));
    const def = lastOptions(0).css as string;
    // default config: the configured indent (1em), never the brief's 1.2em
    expect(def).toContain("text-indent: 1em");
    expect(def).not.toContain("text-indent: 1.2em");
    // same reset as print: first paragraph after a heading or top note stays flush
    expect(def).toContain("h1 + p, h2 + p, h3 + p, .chapter-note + p { text-indent: 0; }");
    expect(def).toContain("text-align: justify");
    expect(def).toContain("::first-letter");
    // print-only geometry stays out; the package default stylesheet survives (appended to)
    expect(def).not.toContain("@page");
    expect(def).not.toContain("6in 9in");
    expect(def).toContain(".epub-author");

    act(() => {
      useScriptorium.getState().setBindery(book.id, {
        typography: { bodyPt: 12, leading: 16, indent: 1.5, justify: false, hyphens: true },
      });
    });
    fireEvent.click(screen.getByRole("button", { name: "Exportar EPUB" }));
    await waitFor(() => expect(epubMock.calls).toHaveLength(2));
    const css = lastOptions(1).css as string;
    expect(css).toContain("font-size: 12pt");
    expect(css).toContain("line-height: 1.33");
    expect(css).toContain("text-indent: 1.5em");
    expect(css).toContain("text-align: left");
    expect(css).toContain("hyphens: auto");
    expect(lastOptions(1).lang).toBe("pt");
    expect(lastOptions(1).version).toBe(3);
    const entries = epubMock.calls[1].content as { beforeToc?: boolean }[];
    expect(entries.some((c) => c.beforeToc)).toBe(true);
    expect(lastOptions(1).tocTitle).toBe("Contents");
  });

  it("styles scene ornaments like the print book", async () => {
    const projectId = seedProject();
    const book = seedBook(projectId, { title: "Ornamentos", chapters: [{ heading: "Um", content: "x." }] });
    render(binderyRoute(projectId, book.id));
    fireEvent.click(screen.getByRole("button", { name: "Exportar EPUB" }));
    await waitFor(() => expect(epubMock.calls).toHaveLength(1));
    const base = lastOptions(0).css as string;
    expect(base).toContain(".scene-marker { text-align: center;");
    expect(base).toContain('scene-marker.ornament::before { content: "⁂"; }');

    act(() => { useScriptorium.getState().setBindery(book.id, { sceneOrnament: "fleuron" }); });
    fireEvent.click(screen.getByRole("button", { name: "Exportar EPUB" }));
    await waitFor(() => expect(epubMock.calls).toHaveLength(2));
    expect(lastOptions(1).css).toContain('scene-marker.ornament::before { content: "❦"; }');

    act(() => { useScriptorium.getState().setBindery(book.id, { sceneOrnament: "rule" }); });
    fireEvent.click(screen.getByRole("button", { name: "Exportar EPUB" }));
    await waitFor(() => expect(epubMock.calls).toHaveLength(3));
    const rule = lastOptions(2).css as string;
    expect(rule).toContain("border-top: 1px solid currentColor");
    expect(rule).toContain("width: 4em");
    expect(rule).not.toContain("scene-marker.ornament::before");

    act(() => { useScriptorium.getState().setBindery(book.id, { sceneOrnament: "blank" }); });
    fireEvent.click(screen.getByRole("button", { name: "Exportar EPUB" }));
    await waitFor(() => expect(epubMock.calls).toHaveLength(4));
    const blank = lastOptions(3).css as string;
    expect(blank).toContain("height: 1.5em");
    expect(blank).not.toContain("scene-marker.ornament::before");
  });

  it("builds the spine in bookSections order with part entries and epub:type", async () => {
    const projectId = seedProject();
    const book = seedBook(projectId, {
      title: "Livro em Partes",
      chapters: [{ heading: "Um" }, { heading: "Dois" }, { heading: "Três", content: "x." }],
    });
    act(() => {
      const part = useScriptorium.getState().addPart(book.id, "Parte I");
      expect(part).toBeTruthy();
      useScriptorium.getState().setChapterPart(book.chapters[0].id, part!.id);
      useScriptorium.getState().setChapterPart(book.chapters[1].id, part!.id);
    });
    render(binderyRoute(projectId, book.id));
    fireEvent.click(screen.getByRole("button", { name: "Exportar EPUB" }));
    await waitFor(() => expect(epubMock.calls).toHaveLength(1));
    const content = epubMock.calls[0].content as { title: string; content: string }[];
    // ungrouped run first, then the part's divider before its chapters — the
    // print order; numbering is the flat render-order sequence print uses
    expect(content.map((c) => c.title)).toEqual([
      "Livro em Partes", "Copyright", "1 Três", "1 Parte I", "2 Um", "3 Dois",
    ]);
    const partEntry = content.find((c) => c.title === "1 Parte I")!;
    expect(partEntry.content).toContain('epub:type="part"');
    expect(partEntry.content).toContain('<p class="part-num">1</p>');
    expect(partEntry.content).toContain('<h1 class="part-title">Parte I</h1>');
    const tres = content.find((c) => c.title === "1 Três")!;
    expect(tres.content).toContain('epub:type="chapter"');
    expect(tres.content).toContain('<span class="ch-num">1</span>');
    // data-ch is print-only (chN named pages); EPUB's attribute allow-list would drop it with a warning
    expect(tres.content).not.toContain("data-ch");
  });

  it("emits front matter before the TOC and back matter after the chapters", async () => {
    const projectId = seedProject();
    const book = seedBook(projectId, { title: "Completo", author: "Ana Silva", chapters: [{ heading: "Um", content: "x." }] });
    act(() => {
      const st = useScriptorium.getState();
      st.setBindery(book.id, {
        dedication: "Para A. G.",
        frontMatter: { ...defaultBindery()!.frontMatter!, epigraph: "> Citado aqui." },
        backMatter: { glossary: true, aboutAuthor: "Ana escreve no Nordeste.", colophon: true },
      });
      const entry = st.addEntry(projectId, "lore");
      st.updateEntry(entry.id, { title: "Termo", summary: "Definição curta." });
    });
    render(binderyRoute(projectId, book.id));
    fireEvent.click(screen.getByRole("button", { name: "Exportar EPUB" }));
    await waitFor(() => expect(epubMock.calls).toHaveLength(1));
    const content = epubMock.calls[0].content as { title: string; content: string; beforeToc?: boolean; excludeFromToc?: boolean }[];
    expect(content.map((c) => c.title)).toEqual([
      "Completo", "Copyright", "Dedication", "Epigraph", "1 Um", "Glossary", "About the author", "Colophon",
    ]);
    const byTitle = (t: string) => content.find((c) => c.title === t)!;
    expect(byTitle("Completo")).toMatchObject({ beforeToc: true, excludeFromToc: true });
    expect(byTitle("Copyright").beforeToc).toBe(true);
    expect(byTitle("Copyright").excludeFromToc).toBe(true);
    expect(byTitle("Copyright").content).toContain("All rights reserved.");
    expect(byTitle("Dedication").beforeToc).toBe(true);
    expect(byTitle("Dedication").excludeFromToc).toBeFalsy();
    expect(byTitle("Dedication").content).toContain("Para A. G.");
    expect(byTitle("Epigraph").beforeToc).toBe(true);
    expect(byTitle("Epigraph").excludeFromToc).toBeFalsy();
    expect(byTitle("Epigraph").content).toContain("Citado aqui.");
    const chapterIdx = content.findIndex((c) => c.title === "1 Um");
    for (const back of ["Glossary", "About the author", "Colophon"]) {
      expect(content.findIndex((c) => c.title === back)).toBeGreaterThan(chapterIdx);
      expect(byTitle(back).beforeToc).toBeFalsy();
    }
    expect(byTitle("Glossary").content).toContain("Termo");
    expect(byTitle("About the author").content).toContain("Ana escreve no Nordeste.");
    expect(byTitle("Colophon").content).toContain("Set in");
  });

  it("omits front and back matter that the bindery turns off", async () => {
    const projectId = seedProject();
    const book = seedBook(projectId, { title: "Enxuto", chapters: [{ heading: "Um", content: "x." }] });
    act(() => {
      useScriptorium.getState().setBindery(book.id, {
        frontMatter: { halfTitle: false, copyright: false, romanNumerals: false },
        backMatter: { glossary: false, aboutAuthor: "", colophon: false },
        glossary: false,
      });
    });
    render(binderyRoute(projectId, book.id));
    fireEvent.click(screen.getByRole("button", { name: "Exportar EPUB" }));
    await waitFor(() => expect(epubMock.calls).toHaveLength(1));
    const content = epubMock.calls[0].content as { title: string; beforeToc?: boolean }[];
    expect(content.map((c) => c.title)).toEqual(["1 Um"]);
    expect(content.some((c) => c.beforeToc)).toBe(false);
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
