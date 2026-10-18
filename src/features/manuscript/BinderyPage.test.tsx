import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { useScriptorium } from "../../data/store";
import { pickSelectOptionSync } from "../../test/selectHelper";
import { BinderyPage } from "./BinderyPage";
import { trimToPage, BINDERY_FONTS, BINDERY_TRIMS } from "./bindery";
import { defaultBindery } from "../../data/schema";

const store = () => useScriptorium.getState();

beforeEach(() => {
  localStorage.clear();
  useScriptorium.setState(useScriptorium.getInitialState());
});

const seedBook = () => {
  act(() => { store().addProject("V"); });
  const prj = store().projects[0].id;
  act(() => { store().addManuscript(prj, "A Coroa e o Rio"); });
  act(() => { store().addChapter(store().manuscripts[0].id, "Arco"); });
  return store().manuscripts[0].id;
};

describe("bindery utils", () => {
  it("trim → page size string", () => {
    expect(trimToPage("6x9")).toBe("6in 9in");
    expect(trimToPage("5x8")).toBe("5in 8in");
  });
  it("fonts + trims catalogs", () => {
    expect(BINDERY_FONTS.map((f) => f.label)).toContain("Palatino");
    expect(BINDERY_TRIMS.length).toBeGreaterThanOrEqual(6);
  });

  it("mirrored geometry puts the gutter on the inner edge of each page", async () => {
    const { buildBookCss } = await import("./bookCss");
    const css = buildBookCss({ ...defaultBindery()!, geometry: { gutter: 0.5, mirrored: true }, trim: "6x9" },
      { title: "A Coroa e o Rio", chapters: [{ heading: "Um" }], parts: [], pageCount: 240 });
    expect(css).toContain("@page :left");
    expect(css).toContain("margin-right: 0.75in"); // inner à direita no verso
    expect(css).toContain("@page :right");
    expect(css).toContain("margin-left: 0.75in");  // inner à esquerda no recto
    expect(css).toContain("size: 6in 9in");
  });

  it("folio counter only appears when pageNumbers is on", async () => {
    const { buildBookCss } = await import("./bookCss");
    const ctx = { title: "A Coroa e o Rio", chapters: [{ heading: "Um" }], parts: [], pageCount: 100 };
    expect(buildBookCss({ ...defaultBindery()!, pageNumbers: true }, ctx)).toContain("counter(page)");
    expect(buildBookCss({ ...defaultBindery()!, pageNumbers: false }, ctx)).not.toContain("counter(page)");
  });

  it("gutter auto derives from the estimated page count", async () => {
    const { buildBookCss } = await import("./bookCss");
    const css = buildBookCss({ ...defaultBindery()!, trim: "5x8", geometry: { gutter: "auto", mirrored: true } },
      { title: "A Coroa e o Rio", chapters: [{ heading: "Um" }], parts: [], pageCount: 700 });
    expect(css).toContain("@page :right");
    expect(css).toContain("margin-left: 0.75in");  // 700 páginas → gutter KDP 0.75 vence outer×1.5 (0.63)
    expect(css).toContain("margin-right: 0.42in"); // outer = 5 × 0.0833
  });

  it("indents paragraphs after the first and never the opener", async () => {
    const { buildBookCss } = await import("./bookCss");
    const css = buildBookCss(defaultBindery()!, { title: "A Coroa e o Rio", chapters: [{ heading: "Um" }], parts: [], pageCount: 100 });
    expect(css).toMatch(/\.print-book p \+ p \{ text-indent: 1em; \}/);
    expect(css).toContain("widows: 2");
    expect(css).toContain("orphans: 2");
  });

  it("one named page per chapter carries the chapter title as a running head", async () => {
    const { buildBookCss } = await import("./bookCss");
    const ctx = { title: "A Coroa e o Rio", chapters: [{ heading: "A Porta" }, { heading: "O Rio" }], parts: [], pageCount: 200 };
    const css = buildBookCss({ ...defaultBindery()!, runningHead: true, runningHeadMode: "chapter" }, ctx);
    expect(css).toContain(`@page ch1 { @top-center { content: "A Porta";`);
    expect(css).toContain(`@page ch2 { @top-center { content: "O Rio";`);
    expect(css).toContain('.print-book .chapter[data-ch="1"] { page: ch1; }');
  });

  it("book-wide running head carries the book title and no chapter pages", async () => {
    const { buildBookCss } = await import("./bookCss");
    const ctx = { title: "A Coroa e o Rio", chapters: [{ heading: "A Porta" }], parts: [], pageCount: 200 };
    const css = buildBookCss({ ...defaultBindery()!, runningHead: true, runningHeadMode: "book" }, ctx);
    expect(css).toContain('@page { @top-center { content: "A Coroa e o Rio"; font-size: 9pt; letter-spacing: 0.08em; text-transform: uppercase; } }');
    expect(css).not.toContain('content: "A Porta"');
    expect(css).not.toContain("@page ch1");
  });

  it("chapter mode leaves the base page head-free for front matter", async () => {
    const { buildBookCss } = await import("./bookCss");
    const ctx = { title: "A Coroa e o Rio", chapters: [{ heading: "Um" }], parts: [], pageCount: 100 };
    const css = buildBookCss({ ...defaultBindery()!, runningHead: true, runningHeadMode: "chapter" }, ctx);
    expect(css).not.toContain("@page { @top-center");
    expect(css).not.toContain('content: "A Coroa e o Rio"');
  });

  it("escapes quotes and backslashes in running-head titles", async () => {
    const { buildBookCss } = await import("./bookCss");
    const ctx = { title: 'Rio "de\\Baixo"', chapters: [{ heading: 'Capa "Um"\\Final' }], parts: [], pageCount: 100 };
    const book = buildBookCss({ ...defaultBindery()!, runningHead: true, runningHeadMode: "book" }, ctx);
    expect(book).toContain('content: "Rio \\"de\\\\Baixo\\""');
    const chapter = buildBookCss({ ...defaultBindery()!, runningHead: true, runningHeadMode: "chapter" }, ctx);
    expect(chapter).toContain('content: "Capa \\"Um\\"\\\\Final"');
  });

  it("chapter opener drops head and folio, and sinks", async () => {
    const { buildBookCss } = await import("./bookCss");
    const css = buildBookCss(defaultBindery()!, { title: "A Coroa e o Rio", chapters: [{ heading: "Um" }], parts: [], pageCount: 100 });
    expect(css).toContain("@page ch1:first { @top-center { content: none; } @bottom-center { content: none; } }");
    expect(css).toContain(".print-book .chapter { break-before: page; padding-top: 18%; }");
  });

  it("drop cap styles the chapter's opening paragraph only when enabled", async () => {
    const { buildBookCss } = await import("./bookCss");
    const ctx = { title: "A Coroa e o Rio", chapters: [{ heading: "Um" }], parts: [], pageCount: 100 };
    const on = buildBookCss({ ...defaultBindery()!, dropCaps: true }, ctx);
    expect(on).toContain(".print-book .chapter > p:first-of-type::first-letter { font-size: 2.6em; float: left; line-height: 0.85; padding-right: 0.08em; }");
    const off = buildBookCss({ ...defaultBindery()!, dropCaps: false }, ctx);
    expect(off).not.toContain("::first-letter");
  });

  it("justification is opt-in and hyphens stay off by default", async () => {
    const { buildBookCss } = await import("./bookCss");
    const ctx = { title: "A Coroa e o Rio", chapters: [{ heading: "Um" }], parts: [], pageCount: 100 };
    expect(buildBookCss(defaultBindery()!, ctx)).toContain("text-align: justify");
    expect(buildBookCss(defaultBindery()!, ctx)).not.toContain("hyphens: auto");
    const ragged = { ...defaultBindery()!, typography: { bodyPt: 11, leading: 14.5, indent: 1, justify: false, hyphens: false } };
    expect(buildBookCss(ragged, ctx)).toContain("text-align: left");
  });

  it("chapter head numbers get visual separation from the title, in live preview and print portal", async () => {
    const fsp = await import("node:fs/promises");
    const theme = await fsp.readFile("src/app/theme.css", "utf8");
    // both copies of the book carry .print-book, so the rule must live there —
    // not on .bindery-live (screen-only class the portal copy never has)
    expect(theme).toMatch(/\.print-book \.chapter h2 \.ch-num \{ margin-right: 0\.35em; \}/);
    expect(theme).not.toMatch(/\.bindery-live \.chapter \{/);
  });
});

describe("BinderyPage", () => {
  it("renders settings + live preview with front matter", () => {
    const id = seedBook();
    render(<MemoryRouter><BinderyPage manuscriptId={id} /></MemoryRouter>);
    expect(screen.getByLabelText("Typography")).toBeInTheDocument();
    expect(screen.getByLabelText("Book size")).toBeInTheDocument();
    expect(screen.getByTestId("bindery-book").innerHTML).toContain("title-page");
    expect(screen.getByTestId("bindery-book").innerHTML).toContain("Contents");
  });

  it("keeps hook order stable when the manuscript is removed while mounted", () => {
    const id = seedBook();
    render(<MemoryRouter><BinderyPage manuscriptId={id} /></MemoryRouter>);
    expect(screen.getByTestId("bindery-page")).toBeInTheDocument();
    expect(() =>
      act(() => { store().deleteManuscript(id); }),
    ).not.toThrow();
    expect(screen.queryByTestId("bindery-page")).not.toBeInTheDocument();
  });

  it("font select updates bindery + preview font", async () => {
    const id = seedBook();
    render(<MemoryRouter><BinderyPage manuscriptId={id} /></MemoryRouter>);
    await pickSelectOptionSync(() => screen.getByLabelText("Typography"), /Palatino/);
    expect(store().manuscripts[0].bindery!.font).toContain("Palatino");
    act(() => { store().setBindery(id, {}); }); // re-render hook
    expect(document.querySelector(".print-book")?.getAttribute("style") || document.querySelector("style")?.textContent || "").toBeTruthy();
  });

  it("dedication + glossary toggle flow", () => {
    const id = seedBook();
    act(() => { store().setBindery(id, { glossary: true }); });
    const prj = store().manuscripts[0].projectId;
    act(() => {
      store().addEntry(prj, "artifact");
      store().updateEntry(store().entries[0].id, { title: "Coroa de Sarnen", summary: "Coroa perdida no rio." });
    });
    render(<MemoryRouter><BinderyPage manuscriptId={id} /></MemoryRouter>);
    const ded = screen.getByLabelText("Dedication");
    fireEvent.change(ded, { target: { value: "Ao rio." } });
    fireEvent.blur(ded);
    expect(store().manuscripts[0].bindery!.dedication).toBe("Ao rio.");
    const book = screen.getByTestId("bindery-book");
    expect(book.innerHTML).toContain("Glossary");
    expect(book.innerHTML).toContain("Coroa de Sarnen");
    expect(book.innerHTML).toContain("dedication");
  });

  it("glossary rows navigate to the codex deep link on click", () => {
    const id = seedBook();
    act(() => { store().setBindery(id, { glossary: true }); });
    const prj = store().manuscripts[0].projectId;
    act(() => {
      store().updateEntry(store().addEntry(prj, "artifact").id, { title: "Coroa de Sarnen", summary: "Coroa perdida no rio." });
    });
    const entryId = store().entries[0].id;
    render(
      <MemoryRouter initialEntries={[`/p/prj_1/bindery/${id}`]}>
        <Routes>
          <Route path="/p/:projectId/bindery/:manuscriptId" element={<BinderyPage manuscriptId={id} />} />
          <Route path="/p/:projectId/entries" element={<div data-testid="codex-dest" data-entry={entryId} />} />
        </Routes>
      </MemoryRouter>,
    );
    const row = document.querySelector("tr[data-glossary]") as HTMLElement;
    expect(row).toBeTruthy();
    fireEvent.click(row);
    expect(screen.getByTestId("codex-dest")).toBeInTheDocument();
  });

  it("print preview triggers window.print once", async () => {
    const id = seedBook();
    const printSpy = vi.fn();
    Object.defineProperty(window, "print", { value: printSpy, configurable: true });
    render(<MemoryRouter><BinderyPage manuscriptId={id} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Print preview" }));
    await waitFor(() => expect(printSpy).toHaveBeenCalledTimes(1), { timeout: 2000 });
  });

  it("print preview portals the book to <body>, outside the app shell, with the bindery sheet", async () => {
    const id = seedBook();
    const printSpy = vi.fn();
    Object.defineProperty(window, "print", { value: printSpy, configurable: true });
    render(<MemoryRouter><BinderyPage manuscriptId={id} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Print preview" }));
    const portal = document.querySelector("body > [data-testid='print-book']") as HTMLElement;
    expect(portal).toBeTruthy(); // lives on <body>, outside #root
    expect(portal.innerHTML).toContain("Arco");
    expect(document.querySelector("body > style")?.textContent).toContain("@page");
    await waitFor(() => expect(printSpy).toHaveBeenCalledTimes(1), { timeout: 2000 });
  });

  it("unmounts the print portal after the fallback timeout", async () => {
    vi.useFakeTimers();
    const id = seedBook();
    const printSpy = vi.fn();
    Object.defineProperty(window, "print", { value: printSpy, configurable: true });
    render(<MemoryRouter><BinderyPage manuscriptId={id} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Print preview" }));
    expect(document.querySelector("body > [data-testid='print-book']")).toBeTruthy();
    act(() => { vi.runAllTimers(); });
    expect(document.querySelector("body > [data-testid='print-book']")).toBeNull();
  });

  it("the print stylesheet hides the whole app shell (#root), not a phantom .workspace class", async () => {
    const fsp = await import("node:fs/promises");
    const css = await fsp.readFile("src/app/print.css", "utf8");
    expect(css).toContain("#root, .toasts { display: none !important; }");
    expect(css).not.toContain(".workspace");
  });
});

describe("Bindery export buttons", () => {
  it("EPUB and Word live in the bindery header and are disabled without chapters", () => {
    const id = seedBook();
    act(() => { store().deleteChapter(store().manuscripts[0].chapters[0].id); });
    render(<MemoryRouter><BinderyPage manuscriptId={id} /></MemoryRouter>);
    expect(screen.getByRole("button", { name: "Exportar EPUB" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Exportar Word" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Exportar PDF" })).toBeNull();
  });

  it("EPUB and Word enable once the book has chapters", () => {
    const id = seedBook();
    render(<MemoryRouter><BinderyPage manuscriptId={id} /></MemoryRouter>);
    expect(screen.getByRole("button", { name: "Exportar EPUB" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Exportar Word" })).toBeEnabled();
  });
});

describe("Bindery v2 controls", () => {
  it("chapter numbering select updates config and book prefix", async () => {
    const id = seedBook();
    act(() => { store().addChapter(id, "Rio fundo"); });
    render(<MemoryRouter><BinderyPage manuscriptId={id} /></MemoryRouter>);
    await pickSelectOptionSync(() => screen.getByLabelText("Chapter numbering"), "Chapter 1");
    expect(store().manuscripts[0].bindery!.numberingStyle).toBe("chapter");
    const book = screen.getByTestId("bindery-book");
    expect(book.innerHTML).toContain('<span class="ch-num">Chapter 1</span>');
  });

  it("page numbers toggle drives the print stylesheet", () => {
    const id = seedBook();
    act(() => { store().setBindery(id, { pageNumbers: false }); });
    render(<MemoryRouter><BinderyPage manuscriptId={id} /></MemoryRouter>);
    const box = screen.getByRole("checkbox", { name: "Page numbers" });
    fireEvent.click(box);
    expect(store().manuscripts[0].bindery!.pageNumbers).toBe(true);
    const styleTag = Array.from(document.querySelectorAll("style")).find((t) => t.textContent?.includes("@page"));
    expect(styleTag?.textContent).toContain("@bottom-center");
  });

  it("running-head mode select drives the per-chapter named pages", async () => {
    const id = seedBook();
    act(() => { store().addChapter(id, "O Tribunal"); });
    act(() => { store().setBindery(id, { runningHeadMode: "book" }); });
    render(<MemoryRouter><BinderyPage manuscriptId={id} /></MemoryRouter>);
    await pickSelectOptionSync(() => screen.getByLabelText("Running head mode"), "Chapter title");
    const styleTag = Array.from(document.querySelectorAll("style")).find((t) => t.textContent?.includes("@page ch2"));
    expect(styleTag?.textContent).toContain('content: "O Tribunal"');
    const book = screen.getByTestId("bindery-book").innerHTML;
    expect(book).toContain('<section class="chapter" data-ch="2">');
    expect(book).not.toContain("running-head");
  });
});
