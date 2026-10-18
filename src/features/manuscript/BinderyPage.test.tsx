import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { useScriptorium } from "../../data/store";
import { pickSelectOptionSync } from "../../test/selectHelper";
import { BinderyPage } from "./BinderyPage";
import { binderyCss, trimToPage, BINDERY_FONTS, BINDERY_TRIMS } from "./bindery";

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
  it("trim → @page size", () => {
    expect(trimToPage("6x9")).toBe("6in 9in");
    expect(binderyCss('"Literata", serif', "5x8", { dropCaps: true, runningHead: true })).toContain("5in 8in");
    expect(binderyCss("Georgia", "6x9", { dropCaps: true, runningHead: true })).toContain("first-letter");
    expect(binderyCss("Georgia", "6x9", { dropCaps: false, runningHead: false })).not.toContain("first-letter");
  });
  it("fonts + trims catalogs", () => {
    expect(BINDERY_FONTS.map((f) => f.label)).toContain("Palatino");
    expect(BINDERY_TRIMS.length).toBeGreaterThanOrEqual(6);
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
    render(<MemoryRouter><BinderyPage manuscriptId={id} /></MemoryRouter>);
    const box = screen.getByRole("checkbox", { name: "Page numbers" });
    fireEvent.click(box);
    expect(store().manuscripts[0].bindery!.pageNumbers).toBe(true);
    const styleTag = Array.from(document.querySelectorAll("style")).find((t) => t.textContent?.includes("@page"));
    expect(styleTag?.textContent).toContain("@bottom-center");
  });

  it("running-head mode select re-labels chapter heads", () => {
    const id = seedBook();
    act(() => { store().addChapter(id, "O Tribunal"); });
    render(<MemoryRouter><BinderyPage manuscriptId={id} /></MemoryRouter>);
    const sel = screen.getByLabelText("Running head mode") as HTMLSelectElement;
    fireEvent.change(sel, { target: { value: "chapter" } });
    const book = screen.getByTestId("bindery-book").innerHTML;
    expect(book).toContain('>O Tribunal</span>');
  });
});
