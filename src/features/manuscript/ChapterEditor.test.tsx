import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useScriptorium } from "../../data/store";
import { pickSelectOptionSync } from "../../test/selectHelper";
import { ChapterEditor } from "./ChapterEditor";
import type { Manuscript } from "../../domain/types";

const store = () => useScriptorium.getState();

beforeEach(() => {
  localStorage.clear();
  useScriptorium.setState(useScriptorium.getInitialState());
  // jsdom has no execCommand; every rich test stubs it
  const exec = vi.fn(() => true);
  Object.defineProperty(document, "execCommand", { configurable: true, writable: true, value: exec });
});
afterEach(() => vi.restoreAllMocks());

function seedMS(): { m: Manuscript; chId: string } {
  const m = store().addManuscript("prj_1", "A Coroa e o Rio");
  const ch = store().addChapter(m.id, "Arco da Coroa")!;
  return { m: (store().manuscripts[0]), chId: ch.id };
}

describe("ChapterEditor rich", () => {
  it("renders toolbar and contenteditable body", () => {
    const { m } = seedMS();
    void m;
    render(<ChapterEditor chapterId={store().manuscripts[0].chapters[0].id} onDeleted={() => {}} />);
    expect(document.querySelector('[contenteditable="true"]')?.getAttribute("role")).toBe("textbox");
    expect(screen.getByRole("button", { name: "Negrito" })).toBeInTheDocument();
  });

  it("footer shows the store word count on load (tag-stripped)", () => {
    const m = store().addManuscript("prj_1", "Livro A");
    store().addChapter(m.id, "Primeiro");
    store().updateChapter(store().manuscripts[0].chapters[0].id, { content: "<p>Havia um ditado em Vellmora: a cidade se fecha.</p>" });
    render(<ChapterEditor chapterId={store().manuscripts[0].chapters[0].id} onDeleted={() => {}} />);
    expect(document.querySelector(".book-words")?.textContent).toBe("9 palavras");
  });

  it("notes are rich and optional: Prologue / Epilogue commit HTML", () => {
    const m = store().addManuscript("prj_1", "Livro A");
    store().addChapter(m.id, "Primeiro");
    const chId = store().manuscripts[0].chapters[0].id;
    render(<ChapterEditor chapterId={chId} onDeleted={() => {}} />);
    const top = screen.getByTestId("rich-note-top") as HTMLElement;
    const end = screen.getByTestId("rich-note-end") as HTMLElement;
    expect(top.getAttribute("contenteditable")).toBe("true");
    expect(end.getAttribute("contenteditable")).toBe("true");
    top.textContent = "A cidade dorme sob a cera.";
    fireEvent.input(top, {});
    fireEvent.blur(top);
    expect(store().manuscripts[0].chapters[0].noteTop).toContain("A cidade dorme sob a cera.");
    end.textContent = "— fim do registro —";
    fireEvent.input(end, {});
    fireEvent.blur(end);
    expect(store().manuscripts[0].chapters[0].noteEnd).toContain("fim do registro");
  });

  it("bold click calls execCommand with 'bold'", () => {
    const { m } = seedMS();
    void m;
    const exec = vi.mocked(document.execCommand);
    render(<ChapterEditor chapterId={store().manuscripts[0].chapters[0].id} onDeleted={() => {}} />);
    // focus body first
    (document.querySelector('[contenteditable="true"]') as HTMLElement).focus();
    fireEvent.click(screen.getByRole("button", { name: "Negrito" }));
    expect(exec).toHaveBeenCalledWith("bold", false, undefined);
  });

  it("blocks dropdown applies formatBlock", () => {
    const { m } = seedMS();
    void m;
    const exec = vi.mocked(document.execCommand);
    render(<ChapterEditor chapterId={store().manuscripts[0].chapters[0].id} onDeleted={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Blocos/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Heading 1 (H1)" }));
    expect(exec).toHaveBeenCalledWith("formatBlock", false, "h1");
  });

  it("align buttons call justify commands", () => {
    const { m } = seedMS();
    void m;
    const exec = vi.mocked(document.execCommand);
    render(<ChapterEditor chapterId={store().manuscripts[0].chapters[0].id} onDeleted={() => {}} />);
    (document.querySelector('[contenteditable="true"]') as HTMLElement).focus();
    fireEvent.click(screen.getByRole("button", { name: "Alinhar ao centro" }));
    expect(exec).toHaveBeenCalledWith("justifyCenter", false, undefined);
  });

  it("body blur saves HTML content", () => {
    const { chId } = seedMS();
    void chId;
    render(<ChapterEditor chapterId={store().manuscripts[0].chapters[0].id} onDeleted={() => {}} />);
    const body = document.querySelector('[contenteditable="true"]') as HTMLElement;
    (body as HTMLElement).innerHTML = "<p>Um rio, três pontes, um selo.</p>";
    fireEvent.input(body); // marks dirty the way a real edit would
    fireEvent.blur(body);
    const ch = store().manuscripts[0].chapters[0];
    expect(ch.content).toBe("<p>Um rio, três pontes, um selo.</p>");
  });

  it("markdown content converts to HTML on first edit (one-way)", () => {
    seedMS();
    act(() => { store().addChapter(store().manuscripts[0].id, "MD cap"); });
    const ch = store().manuscripts[0].chapters[1];
    act(() => { store().updateChapter(ch.id, { content: "# Título MD\n\ntexto com **força**" }); });
    render(<ChapterEditor chapterId={ch.id} onDeleted={() => {}} />);
    expect(store().manuscripts[0].chapters[1].content).toContain("**força**"); // untouched until first edit
    const body = document.querySelector('[contenteditable="true"]') as HTMLElement;
    body.innerHTML = "<p>editado</p>";
    fireEvent.input(body);
    fireEvent.blur(body);
    expect(store().manuscripts[0].chapters[1].content).toBe("<p>editado</p>"); // md converted/lost on edit
  });

  it("notes top/end + endMarker persist", () => {
    seedMS();
    render(<ChapterEditor chapterId={store().manuscripts[0].chapters[0].id} onDeleted={() => {}} />);
    const typeNote = (testid: string, text: string) => {
      const el = screen.getByTestId(testid) as HTMLElement;
      el.textContent = text;
      fireEvent.input(el, {});
      fireEvent.blur(el);
    };
    typeNote("rich-note-top", "Dedico ao rio.");
    typeNote("rich-note-end", "Continua no fim do inverno.");
    const ch = store().manuscripts[0].chapters[0];
    expect(ch.noteTop).toContain("Dedico ao rio.");
    expect(ch.noteEnd).toContain("Continua no fim do inverno.");
    expect(ch.endMarker).toBeUndefined(); // untouched
  });

  it("endMarker editable", () => {
    seedMS();
    act(() => { store().updateChapter(store().manuscripts[0].chapters[0].id, { endMarker: "Fim do cap." }); });
    render(<ChapterEditor chapterId={store().manuscripts[0].chapters[0].id} onDeleted={() => {}} />);
    const marker = screen.getByLabelText("End-of-chapter marker");
    fireEvent.change(marker, { target: { value: "Fim do Livro I" } });
    fireEvent.blur(marker);
    expect(store().manuscripts[0].chapters[0].endMarker).toBe("Fim do Livro I");
  });

  it("links a calendar day", async () => {
    seedMS();
    const cal = store().addCalendar("prj_1", "Selo Anual");
    render(<ChapterEditor chapterId={store().manuscripts[0].chapters[0].id} onDeleted={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Link calendar" }));
    await pickSelectOptionSync(() => screen.getByLabelText("Calendário"), "Selo Anual");
    await pickSelectOptionSync(() => screen.getByLabelText("Month"), "Month 3");
    // controlled number inputs: TL fireEvent.change is unreliable here; use the native setter (repo pattern)
    const setVal = (el: HTMLElement, v: string) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!;
      setter.call(el, v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    setVal(screen.getByLabelText("Dia") as HTMLElement, "5");
    fireEvent.click(screen.getByRole("button", { name: "Vincular dia" }));
    const ch = store().manuscripts[0].chapters[0];
    expect(ch.linkedCalendarId).toBe(cal.id);
    expect(ch.calendarDayKey).toBe("0:2:4"); // dia 5 humano = índice 4
  });
});
