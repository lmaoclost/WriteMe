import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { useScriptorium } from "../../data/store";
import { pickSelectOptionSync } from "../../test/selectHelper";
import { BinderyPage } from "./BinderyPage";
import { trimToPage, BINDERY_FONTS, BINDERY_TRIMS, estimatePageCount } from "./bindery";
import { defaultBindery } from "../../data/schema";

const store = () => useScriptorium.getState();

beforeEach(() => {
  localStorage.clear();
  useScriptorium.setState(useScriptorium.getInitialState());
});

afterEach(() => {
  vi.useRealTimers();
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

  it("the indent reset keeps only the heading siblings the print markup still has", async () => {
    const { buildBookCss } = await import("./bookCss");
    const css = buildBookCss(defaultBindery()!, { title: "A Coroa e o Rio", chapters: [{ heading: "Um" }], parts: [], pageCount: 100 });
    // the chapter h2 moved to the opener section, so `h2 + p` matches nothing
    // in the print book (the EPUB, where the pair still exists, keeps it)
    expect(css).not.toContain("h2 + p");
    expect(css).toContain(".print-book h1 + p, .print-book h3 + p, .print-book .chapter-note + p { text-indent: 0; }");
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

  it("an undefined running head mode falls back to the book title head", async () => {
    const { buildBookCss } = await import("./bookCss");
    const ctx = { title: "A Coroa e o Rio", chapters: [{ heading: "A Porta" }], parts: [], pageCount: 200 };
    const css = buildBookCss({ ...defaultBindery()!, runningHead: true, runningHeadMode: undefined }, ctx);
    expect(css).toContain('@page { @top-center { content: "A Coroa e o Rio";');
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

  it("chapter opener gets its own page with no head or folio, and sinks", async () => {
    const { buildBookCss } = await import("./bookCss");
    const css = buildBookCss(defaultBindery()!, { title: "A Coroa e o Rio", chapters: [{ heading: "Um" }], parts: [], pageCount: 100 });
    expect(css).toContain("@page opener1 { @top-center { content: none; } @bottom-center { content: none; } }");
    expect(css).toContain('.print-book .chapter-opener[data-ch="1"] { page: opener1; break-before: page; padding-top: 18%; }');
  });

  it("suppression is per box: dropping only the head keeps the folio on the opener page", async () => {
    const { buildBookCss } = await import("./bookCss");
    const ctx = { title: "A Coroa e o Rio", chapters: [{ heading: "Um" }], parts: [], pageCount: 100 };
    const css = buildBookCss({ ...defaultBindery()!, opener: { sink: 0.18, suppressHead: true, suppressFolio: false } }, ctx);
    expect(css).toContain("@page opener1 { @top-center { content: none; } }");
    expect(css).not.toContain("@page opener1 { @bottom-center");
    const folioOnly = buildBookCss({ ...defaultBindery()!, opener: { sink: 0.18, suppressHead: false, suppressFolio: true } }, ctx);
    expect(folioOnly).toContain("@page opener1 { @bottom-center { content: none; } }");
    expect(folioOnly).not.toContain("@page opener1 { @top-center");
  });

  it("with both suppressions off the opener shares its page with the text", async () => {
    const { buildBookCss } = await import("./bookCss");
    const ctx = { title: "A Coroa e o Rio", chapters: [{ heading: "Um" }], parts: [], pageCount: 100 };
    const off = { ...defaultBindery()!, opener: { sink: 0.18, suppressHead: false, suppressFolio: false } };
    const css = buildBookCss(off, ctx);
    // chapter-head mode: the opener must carry the body's named page — a page
    // change between the pair would force a break no `avoid` can cancel
    expect(css).toContain('.print-book .chapter-opener[data-ch="1"] { page: ch1; }');
    expect(css).toContain('.print-book .chapter-opener[data-ch="1"] + .chapter { break-before: avoid; }');
    const bookMode = buildBookCss({ ...off, runningHeadMode: "book" }, ctx);
    expect(bookMode).not.toMatch(/chapter-opener\[data-ch="1"\] \{ page:/);
    expect(bookMode).toContain('.print-book .chapter-opener[data-ch="1"] + .chapter { break-before: avoid; }');
  });

  it("sink 0 with suppression on still gives the opener its own, headless page", async () => {
    const { buildBookCss } = await import("./bookCss");
    const ctx = { title: "A Coroa e o Rio", chapters: [{ heading: "Um" }], parts: [], pageCount: 100 };
    const css = buildBookCss({ ...defaultBindery()!, opener: { sink: 0, suppressHead: true, suppressFolio: true } }, ctx);
    expect(css).toContain("@page opener1 { @top-center { content: none; } @bottom-center { content: none; } }");
    expect(css).toContain('.print-book .chapter-opener[data-ch="1"] { page: opener1; break-before: page; padding-top: 0%; }');
  });

  it("no page-first suppression rule survives: Chromium drops the selector", async () => {
    const { buildBookCss } = await import("./bookCss");
    const css = buildBookCss(defaultBindery()!, { title: "A Coroa e o Rio", chapters: [{ heading: "Um" }], parts: [], pageCount: 100 });
    // :first-of-type / ::first-letter are allowed; @page ch1:first is not
    expect(css).not.toMatch(/:first(?!-)/);
  });

  it("the sink rides the opener section, not the chapter body", async () => {
    const { buildBookCss } = await import("./bookCss");
    const css = buildBookCss(defaultBindery()!, { title: "A Coroa e o Rio", chapters: [{ heading: "Um" }], parts: [], pageCount: 100 });
    expect(css).toContain(".print-book .chapter-opener { break-before: page; padding-top: 18%; }");
    expect(css).toContain(".print-book .chapter { break-before: page; }");
  });

  it("drop cap styles the chapter's opening paragraph only when enabled", async () => {
    const { buildBookCss } = await import("./bookCss");
    const ctx = { title: "A Coroa e o Rio", chapters: [{ heading: "Um" }], parts: [], pageCount: 100 };
    const on = buildBookCss({ ...defaultBindery()!, dropCaps: true }, ctx);
    expect(on).toContain(".print-book .chapter > p:not(.empty):first-of-type::first-letter { font-size: 2.6em; float: left; line-height: 0.85; padding-right: 0.08em; }");
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
    // not on .bindery-live (screen-only class the portal copy never has);
    // the h2 sits in the opener section, not the chapter body
    expect(theme).toMatch(/\.print-book \.chapter-opener h2 \.ch-num \{ margin-right: 0\.35em; \}/);
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

  it("keeps the print portal mounted while the print dialog is open", async () => {
    vi.useFakeTimers();
    const id = seedBook();
    Object.defineProperty(window, "print", { value: vi.fn(), configurable: true });
    render(<MemoryRouter><BinderyPage manuscriptId={id} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Print preview" }));

    act(() => { vi.advanceTimersByTime(5_000); }); // Safari may keep the dialog open this long
    expect(document.querySelector("body > [data-testid='print-book']")).toBeTruthy();

    act(() => { window.dispatchEvent(new Event("afterprint")); });
    expect(document.querySelector("body > [data-testid='print-book']")).toBeNull();
  });

  it("settles on window focus when afterprint never arrives", async () => {
    vi.useFakeTimers();
    const id = seedBook();
    Object.defineProperty(window, "print", { value: vi.fn(), configurable: true });
    render(<MemoryRouter><BinderyPage manuscriptId={id} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Print preview" }));

    act(() => { vi.advanceTimersByTime(5_000); });
    expect(document.querySelector("body > [data-testid='print-book']")).toBeTruthy();

    act(() => { window.dispatchEvent(new Event("focus")); });
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
    expect(screen.getByRole("button", { name: "Export EPUB" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Export Word" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Export PDF" })).toBeNull();
  });

  it("EPUB and Word enable once the book has chapters", () => {
    const id = seedBook();
    render(<MemoryRouter><BinderyPage manuscriptId={id} /></MemoryRouter>);
    expect(screen.getByRole("button", { name: "Export EPUB" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Export Word" })).toBeEnabled();
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

  it("a manuscript without a bindery still prints the head the UI shows", () => {
    const id = seedBook();
    act(() => { useScriptorium.setState((s) => ({ manuscripts: s.manuscripts.map((m) => ({ ...m, bindery: undefined })) })); });
    render(<MemoryRouter><BinderyPage manuscriptId={id} /></MemoryRouter>);
    const styleTag = Array.from(document.querySelectorAll("style")).find((t) => t.textContent?.includes("@page"));
    expect(styleTag?.textContent).toContain('content: "A Coroa e o Rio"');
    expect(styleTag?.textContent).toContain("counter(page)");
    expect(styleTag?.textContent).not.toContain("@page ch1");
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

  it("named pages follow the part render order, not the stored chapter order", () => {
    const id = seedBook();
    act(() => { store().addChapter(id, "Rio fundo"); });
    act(() => { store().addChapter(id, "O Tribunal"); });
    act(() => { store().addPart(id, "Parte um"); });
    const m = store().manuscripts[0];
    const rio = m.chapters.find((c) => c.heading === "Rio fundo")!;
    // middle chapter joins the part, so render order moves it after the ungrouped ones
    act(() => { store().setChapterPart(rio.id, m.parts![0].id); });
    render(<MemoryRouter><BinderyPage manuscriptId={id} /></MemoryRouter>);
    const styleTag = Array.from(document.querySelectorAll("style")).find((t) => t.textContent?.includes("@page ch2"));
    expect(styleTag?.textContent).toContain('content: "O Tribunal"');
    expect(styleTag?.textContent).not.toContain('@page ch2 { @top-center { content: "Rio fundo"');
    const book = screen.getByTestId("bindery-book").innerHTML;
    expect(book).toContain('<section class="chapter-opener" data-ch="2"><h2><span class="ch-num">2</span>O Tribunal</h2></section>');
    expect(book).toContain('<section class="chapter-opener" data-ch="3"><h2><span class="ch-num">3</span>Rio fundo</h2></section>');
  });
});

describe("Bindery preset picker, advanced groups and print hints", () => {
  const openGroup = (name: string) => {
    fireEvent.click(screen.getByText(name, { selector: "summary" }));
  };

  it("choosing a preset writes the whole patch into the bindery config", async () => {
    const id = seedBook();
    render(<MemoryRouter><BinderyPage manuscriptId={id} /></MemoryRouter>);
    await pickSelectOptionSync(() => screen.getByLabelText("Style preset"), "Ornamented fantasy");
    const b = store().manuscripts[0].bindery!;
    expect(b.preset).toBe("fantasy");
    expect(b.typography?.leading).toBe(15);
    expect(b.sceneOrnament).toBe("fleuron");
  });

  it("surfaces the page count as an estimate, not a fact", () => {
    const id = seedBook();
    render(<MemoryRouter><BinderyPage manuscriptId={id} /></MemoryRouter>);
    const note = screen.getByTestId("page-estimate");
    expect(note).toHaveTextContent(String(estimatePageCount(store().manuscripts[0])));
    expect(note).toHaveTextContent(/estimat/i);
  });

  it("the page estimate agrees on the singular", () => {
    const id = seedBook(); // one chapter, no words → the estimate floors at 1
    act(() => { store().setBindery(id, { frontMatter: { ...defaultBindery()!.frontMatter!, halfTitle: false } }); });
    render(<MemoryRouter><BinderyPage manuscriptId={id} /></MemoryRouter>);
    expect(estimatePageCount(store().manuscripts[0])).toBe(1);
    const note = screen.getByTestId("page-estimate");
    expect(note).toHaveTextContent("1 page");
    expect(note).not.toHaveTextContent("pages");
  });

  it("warns that running heads and folios only appear in the print dialog", () => {
    const id = seedBook();
    render(<MemoryRouter><BinderyPage manuscriptId={id} /></MemoryRouter>);
    const hint = screen.getByTestId("print-hint");
    expect(hint).toHaveTextContent(/print dialog/i);
    expect(hint).toHaveTextContent(/never in the on-screen preview/i);
    expect(hint).toHaveTextContent(/Headers and footers/i);
    expect(hint).not.toHaveTextContent(/Chrome/);
  });

  it("recommends desktop Chrome or Edge on engines without page margin boxes", () => {
    const id = seedBook();
    render(<MemoryRouter><BinderyPage manuscriptId={id} /></MemoryRouter>);
    const engineHint = screen.getByTestId("print-engine-hint");
    expect(engineHint).toHaveTextContent(/Chrome/);
    expect(engineHint).toHaveTextContent(/Edge/);
    expect(engineHint).toHaveTextContent(/WebKit/);
  });

  it("typography group exposes body size, leading, indent, justification and hyphens", () => {
    const id = seedBook();
    render(<MemoryRouter><BinderyPage manuscriptId={id} /></MemoryRouter>);
    openGroup("Body text");
    expect(screen.getByLabelText("Body size (pt)")).toBeVisible();
    expect(screen.getByLabelText("Leading (pt)")).toBeVisible();
    expect(screen.getByLabelText("Indent (em)")).toBeVisible();
    expect(screen.getByRole("checkbox", { name: "Justify" })).toBeVisible();
    expect(screen.getByRole("checkbox", { name: "Hyphenation" })).toBeVisible();
  });

  it("geometry group exposes the gutter (auto or manual inches) and mirrored margins", async () => {
    const id = seedBook();
    render(<MemoryRouter><BinderyPage manuscriptId={id} /></MemoryRouter>);
    openGroup("Page geometry");
    expect(screen.getByLabelText("Gutter")).toBeVisible();
    expect(screen.getByRole("checkbox", { name: "Mirrored margins" })).toBeVisible();
    await pickSelectOptionSync(() => screen.getByLabelText("Gutter"), "Manual (inches)");
    fireEvent.change(screen.getByLabelText("Gutter (in)"), { target: { value: "0.625" } });
    // the write stores the whole geometry block, mirrored included
    expect(store().manuscripts[0].bindery!.geometry).toEqual({ gutter: 0.625, mirrored: true });
  });

  it("opener group drives sink and the opener suppressions", () => {
    const id = seedBook();
    render(<MemoryRouter><BinderyPage manuscriptId={id} /></MemoryRouter>);
    openGroup("Chapter openers");
    expect(screen.getByLabelText("Chapter opener sink")).toBeVisible();
    fireEvent.click(screen.getByRole("checkbox", { name: "Suppress running head on openers" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Suppress folio on openers" }));
    expect(store().manuscripts[0].bindery!.opener).toEqual({ sink: 0.18, suppressHead: false, suppressFolio: false });
  });

  it("warns that suppression puts the chapter opener on its own page", () => {
    const id = seedBook();
    render(<MemoryRouter><BinderyPage manuscriptId={id} /></MemoryRouter>);
    openGroup("Chapter openers");
    const hint = screen.getByTestId("opener-hint");
    expect(hint).toHaveTextContent(/Chromium/);
    expect(hint).toHaveTextContent(/own page/);
    expect(hint).toHaveTextContent(/next page/);
  });

  it("front matter group drives half title, copyright fields, epigraph and roman numerals", () => {
    const id = seedBook();
    render(<MemoryRouter><BinderyPage manuscriptId={id} /></MemoryRouter>);
    openGroup("Front matter");
    fireEvent.change(screen.getByLabelText("Copyright year"), { target: { value: "2026" } });
    fireEvent.change(screen.getByLabelText("Copyright holder"), { target: { value: "Ana Rio" } });
    fireEvent.change(screen.getByLabelText("ISBN"), { target: { value: "978-85-000000-0-0" } });
    fireEvent.change(screen.getByLabelText("Edition"), { target: { value: "1ª" } });
    const epi = screen.getByLabelText("Epigraph");
    fireEvent.change(epi, { target: { value: "Ao rio." } });
    fireEvent.blur(epi);
    fireEvent.click(screen.getByRole("checkbox", { name: "Half title" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Roman numerals" }));
    const fm = store().manuscripts[0].bindery!.frontMatter!;
    expect(fm.copyrightInfo).toEqual({ year: "2026", holder: "Ana Rio", isbn: "978-85-000000-0-0", edition: "1ª" });
    expect(fm.epigraph).toBe("Ao rio.");
    expect(fm.halfTitle).toBe(false);
    expect(fm.romanNumerals).toBe(false);
    expect(screen.getByTestId("bindery-book").innerHTML).toContain("epigraph");
  });

  it("back matter group drives about-the-author and the colophon", () => {
    const id = seedBook();
    // the legacy glossary switch must survive back-matter writes
    act(() => { store().setBindery(id, { glossary: true }); });
    const prj = store().manuscripts[0].projectId;
    act(() => {
      store().addEntry(prj, "artifact");
      store().updateEntry(store().entries[0].id, { title: "Coroa de Sarnen", summary: "Coroa perdida no rio." });
    });
    render(<MemoryRouter><BinderyPage manuscriptId={id} /></MemoryRouter>);
    openGroup("Back matter");
    const about = screen.getByLabelText("About the author");
    fireEvent.change(about, { target: { value: "Ana escreve à beira do rio." } });
    fireEvent.blur(about);
    fireEvent.click(screen.getByRole("checkbox", { name: "Colophon" }));
    const bm = store().manuscripts[0].bindery!.backMatter!;
    // glossary is deliberately absent — the legacy switch keeps driving it
    expect(bm).toEqual({ aboutAuthor: "Ana escreve à beira do rio.", colophon: true });
    const book = screen.getByTestId("bindery-book").innerHTML;
    expect(book).toContain("about-author");
    expect(book).toContain("colophon");
    expect(book).toContain("Glossary");
  });

  it("scene ornament group drives the ornament between scenes", async () => {
    const id = seedBook();
    render(<MemoryRouter><BinderyPage manuscriptId={id} /></MemoryRouter>);
    openGroup("Scene ornament");
    await pickSelectOptionSync(() => screen.getByLabelText("Scene ornament"), "Fleuron");
    expect(store().manuscripts[0].bindery!.sceneOrnament).toBe("fleuron");
  });

  it("copyright sub-fields are inert while the copyright page is off", () => {
    const id = seedBook();
    render(<MemoryRouter><BinderyPage manuscriptId={id} /></MemoryRouter>);
    openGroup("Front matter");
    const box = screen.getByRole("checkbox", { name: "Copyright page" });
    fireEvent.click(box); // off
    expect(screen.getByLabelText("Copyright year")).toBeDisabled();
    expect(screen.getByLabelText("Copyright holder")).toBeDisabled();
    expect(screen.getByLabelText("ISBN")).toBeDisabled();
    expect(screen.getByLabelText("Edition")).toBeDisabled();
    fireEvent.click(box); // on again
    expect(screen.getByLabelText("Copyright year")).toBeEnabled();
  });

  it("a nested write over a partial stored block keeps the default siblings", () => {
    const id = seedBook();
    // old saved data: a partial typography block must not shed the defaults
    act(() => {
      useScriptorium.setState((s) => ({
        manuscripts: s.manuscripts.map((m) => (m.id === id
          ? { ...m, bindery: { ...defaultBindery()!, typography: { bodyPt: 10 } as NonNullable<ReturnType<typeof defaultBindery>>["typography"] } }
          : m)),
      }));
    });
    render(<MemoryRouter><BinderyPage manuscriptId={id} /></MemoryRouter>);
    openGroup("Body text");
    fireEvent.change(screen.getByLabelText("Leading (pt)"), { target: { value: "16" } });
    expect(store().manuscripts[0].bindery!.typography)
      .toEqual({ bodyPt: 10, leading: 16, indent: 1, justify: true, hyphens: false });
  });
});
