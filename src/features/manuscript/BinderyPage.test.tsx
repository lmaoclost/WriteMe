import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useScriptorium } from "../../data/store";
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
    render(<BinderyPage manuscriptId={id} />);
    expect(screen.getByLabelText("Tipografia")).toBeInTheDocument();
    expect(screen.getByLabelText("Tamanho do livro")).toBeInTheDocument();
    expect(screen.getByTestId("bindery-book").innerHTML).toContain("title-page");
    expect(screen.getByTestId("bindery-book").innerHTML).toContain("Conteúdo");
  });

  it("font select updates bindery + preview font", () => {
    const id = seedBook();
    render(<BinderyPage manuscriptId={id} />);
    const sel = screen.getByLabelText("Tipografia") as HTMLSelectElement;
    fireEvent.change(sel, { target: { value: '"Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif' } });
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
    render(<BinderyPage manuscriptId={id} />);
    const ded = screen.getByLabelText("Dedication");
    fireEvent.change(ded, { target: { value: "Ao rio." } });
    fireEvent.blur(ded);
    expect(store().manuscripts[0].bindery!.dedication).toBe("Ao rio.");
    const book = screen.getByTestId("bindery-book");
    expect(book.innerHTML).toContain("Glossário");
    expect(book.innerHTML).toContain("Coroa de Sarnen");
    expect(book.innerHTML).toContain("dedication");
  });

  it("print preview triggers window.print once", async () => {
    const id = seedBook();
    const printSpy = vi.fn();
    Object.defineProperty(window, "print", { value: printSpy, configurable: true });
    render(<BinderyPage manuscriptId={id} />);
    fireEvent.click(screen.getByRole("button", { name: "Print preview" }));
    await waitFor(() => expect(printSpy).toHaveBeenCalledTimes(1), { timeout: 2000 });
  });
});
