import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { useWriteme } from "../../data/store";
import { pickSelectOptionSync } from "../../test/selectHelper";
import { ChapterEditor } from "./ChapterEditor";
import type { Manuscript } from "../../domain/types";

const store = () => useWriteme.getState();

beforeEach(() => {
  localStorage.clear();
  useWriteme.setState(useWriteme.getInitialState());
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

/** The notes panel starts collapsed; every note/marker test opens it. */
function openNotes() {
  const trigger = screen.getByRole("button", { name: /Notes and scene/i });
  if (trigger.getAttribute("aria-expanded") !== "true") fireEvent.click(trigger);
  return trigger;
}

function sceneBody(n: number): HTMLElement {
  return document.querySelector(`[data-testid="rich-scene-${n}"]`) as HTMLElement;
}

describe("SceneBody caret + focus stability", () => {
  it("committing a scene does not rewrite its DOM when the store already holds the same HTML", () => {
    vi.useFakeTimers();
    seedMS();
    render(<ChapterEditor chapterId={store().manuscripts[0].chapters[0].id} onDeleted={() => {}} />);
    const body = sceneBody(1);
    body.innerHTML = "<p>um</p>";
    fireEvent.input(body);
    const writes: string[] = [];
    // the property lives on the prototype; spying on the instance catches
    // programmatic innerHTML assignments (the DOM-sync effect) unambiguously
    const desc = Object.getOwnPropertyDescriptor(Element.prototype, "innerHTML")
      ?? Object.getOwnPropertyDescriptor(HTMLElement.prototype, "innerHTML")!;
    Object.defineProperty(body, "innerHTML", {
      configurable: true,
      get: () => desc.get!.call(body),
      set: (v: string) => { writes.push(v); desc.set!.call(body, v); },
    });
    act(() => {
      vi.advanceTimersByTime(300); // autosave commit
    });
    expect(store().manuscripts[0].chapters[0].scenes[0].content).toBe("<p>um</p>");
    expect(writes).toEqual([]); // caret survives: no DOM rewrite after commit
  });

  it("committing plain-text typing does not convert/rewrite the DOM while editing", () => {
    vi.useFakeTimers();
    seedMS();
    render(<ChapterEditor chapterId={store().manuscripts[0].chapters[0].id} onDeleted={() => {}} />);
    const body = sceneBody(1);
    body.textContent = "um";
    fireEvent.input(body);
    const writes: string[] = [];
    const desc = Object.getOwnPropertyDescriptor(Element.prototype, "innerHTML")
      ?? Object.getOwnPropertyDescriptor(HTMLElement.prototype, "innerHTML")!;
    Object.defineProperty(body, "innerHTML", {
      configurable: true,
      get: () => desc.get!.call(body),
      set: (v: string) => { writes.push(v); desc.set!.call(body, v); },
    });
    act(() => { vi.advanceTimersByTime(300); });
    expect(store().manuscripts[0].chapters[0].scenes[0].content).toBe("um");
    // the markdown one-way conversion waits for a remount, like the chapter
    // body used to; rewriting now would drop the caret to the start
    expect(writes).toEqual([]);
  });

  it("typing in another scene does not steal focus back to the previously selected scene", () => {
    const m = store().addManuscript("prj_1", "Livro A");
    store().addChapter(m.id, "Um");
    const chId = store().manuscripts[0].chapters[0].id;
    store().addScene(chId);
    const scene1 = store().manuscripts[0].chapters[0].scenes[0];
    render(<ChapterEditor chapterId={chId} focusSceneId={scene1.id} onDeleted={() => {}} />);
    const second = sceneBody(2);
    second.focus();
    fireEvent.input(second);
    expect(document.activeElement).toBe(second);
  });
});

describe("Scene header (name + delete)", () => {
  it("names the scene from its header input, debounced, and shows words there", () => {
    vi.useFakeTimers();
    seedMS();
    render(<ChapterEditor chapterId={store().manuscripts[0].chapters[0].id} onDeleted={() => {}} />);
    const input = screen.getByLabelText("Scene name");
    fireEvent.change(input, { target: { value: "Na ponte" } });
    expect(store().manuscripts[0].chapters[0].scenes[0].title).toBeUndefined(); // debounce holds
    act(() => { vi.advanceTimersByTime(300); });
    fireEvent.blur(input);
    expect(store().manuscripts[0].chapters[0].scenes[0].title).toBe("Na ponte");
  });

  it("the delete control lives in the scene header; the bottom rows are gone", () => {
    seedMS();
    render(<ChapterEditor chapterId={store().manuscripts[0].chapters[0].id} onDeleted={() => {}} />);
    const header = document.querySelector(".book-scene-header") as HTMLElement;
    expect(header).toBeTruthy();
    expect(within(header).queryByRole("button", { name: "Delete scene" })).toBeTruthy();
    expect(document.querySelector("[data-testid='scene-controls']")).toBeNull();
    expect(screen.getAllByRole("button", { name: "Delete scene" })).toHaveLength(1); // one per scene header only
  });
});

describe("ChapterEditor rich", () => {
  it("renders toolbar and one contenteditable per scene", () => {
    const { m } = seedMS();
    void m;
    render(<ChapterEditor chapterId={store().manuscripts[0].chapters[0].id} onDeleted={() => {}} />);
    expect(document.querySelector('[contenteditable="true"]')?.getAttribute("role")).toBe("textbox");
    expect(screen.getByRole("button", { name: "Bold" })).toBeInTheDocument();
    expect(sceneBody(1)).toBeTruthy();
  });

  it("footer shows the store word count on load (tag-stripped)", () => {
    const m = store().addManuscript("prj_1", "Livro A");
    store().addChapter(m.id, "Primeiro");
    store().replaceChapterBody(store().manuscripts[0].chapters[0].id, "<p>Havia um ditado em Vellmora: a cidade se fecha.</p>");
    render(<ChapterEditor chapterId={store().manuscripts[0].chapters[0].id} onDeleted={() => {}} />);
    expect(document.querySelector(".book-words")?.textContent).toBe("9 words");
  });

  it("each scene keeps its own body and the footer sums them", () => {
    const m = store().addManuscript("prj_1", "Livro A");
    store().addChapter(m.id, "Um");
    const chId = store().manuscripts[0].chapters[0].id;
    store().replaceChapterBody(chId, "<p>um dois três</p>");
    store().addScene(chId);
    store().updateScene(store().manuscripts[0].chapters[0].scenes[1].id, { content: "quatro cinco" });
    render(<ChapterEditor chapterId={chId} onDeleted={() => {}} />);
    expect(sceneBody(1).textContent.trim()).toBe("um dois três");
    expect(sceneBody(2).textContent.trim()).toBe("quatro cinco");
    expect(document.querySelector(".book-words")?.textContent).toBe("5 words");
  });

  it("adding a scene from the editor appends an empty one", () => {
    const { m } = seedMS();
    void m;
    render(<ChapterEditor chapterId={store().manuscripts[0].chapters[0].id} onDeleted={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "New scene" }));
    const scenes = store().manuscripts[0].chapters[0].scenes;
    expect(scenes).toHaveLength(2);
    expect(scenes[1].content).toBe("");
    expect(scenes.map((s) => s.order)).toEqual([0, 1]);
  });

  it("delete scene is armed against draining the chapter to zero", () => {
    seedMS();
    render(<ChapterEditor chapterId={store().manuscripts[0].chapters[0].id} onDeleted={() => {}} />);
    const del = screen.getAllByRole("button", { name: "Delete scene" })[0];
    expect(del).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "New scene" }));
    const dels = screen.getAllByRole("button", { name: "Delete scene" });
    expect(dels[0]).toBeEnabled();
    fireEvent.click(dels[0]);
    expect(store().manuscripts[0].chapters[0].scenes).toHaveLength(1);
  });

  it("notes are rich and optional: Prologue / Epilogue commit HTML", () => {
    const m = store().addManuscript("prj_1", "Livro A");
    store().addChapter(m.id, "Primeiro");
    const chId = store().manuscripts[0].chapters[0].id;
    render(<ChapterEditor chapterId={chId} onDeleted={() => {}} />);
    openNotes();
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
    fireEvent.click(screen.getByRole("button", { name: "Bold" }));
    expect(exec).toHaveBeenCalledWith("bold", false, undefined);
  });

  it("blocks dropdown applies formatBlock", () => {
    const { m } = seedMS();
    void m;
    const exec = vi.mocked(document.execCommand);
    render(<ChapterEditor chapterId={store().manuscripts[0].chapters[0].id} onDeleted={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Blocks/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Heading 1 (H1)" }));
    expect(exec).toHaveBeenCalledWith("formatBlock", false, "h1");
  });

  it("align buttons call justify commands", () => {
    const { m } = seedMS();
    void m;
    const exec = vi.mocked(document.execCommand);
    render(<ChapterEditor chapterId={store().manuscripts[0].chapters[0].id} onDeleted={() => {}} />);
    (document.querySelector('[contenteditable="true"]') as HTMLElement).focus();
    fireEvent.click(screen.getByRole("button", { name: "Align center" }));
    expect(exec).toHaveBeenCalledWith("justifyCenter", false, undefined);
  });

  it("scene blur saves HTML content", () => {
    const { chId } = seedMS();
    void chId;
    render(<ChapterEditor chapterId={store().manuscripts[0].chapters[0].id} onDeleted={() => {}} />);
    const body = sceneBody(1);
    (body as HTMLElement).innerHTML = "<p>Um rio, três pontes, um selo.</p>";
    fireEvent.input(body); // marks dirty the way a real edit would
    fireEvent.blur(body);
    const ch = store().manuscripts[0].chapters[0];
    expect(ch.scenes[0].content).toBe("<p>Um rio, três pontes, um selo.</p>");
  });

  it("keeps the committed body when returning to write mode after preview", () => {
    seedMS();
    render(<ChapterEditor chapterId={store().manuscripts[0].chapters[0].id} onDeleted={() => {}} />);
    const body = sceneBody(1);
    body.innerHTML = "<p>Um rio, três pontes, um selo.</p>";
    fireEvent.input(body);
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    fireEvent.click(screen.getByRole("button", { name: "Write" }));
    const bodyAgain = sceneBody(1);
    expect(bodyAgain.innerHTML).toContain("Um rio, três pontes, um selo.");
  });

  it("markdown content converts to HTML on first edit (one-way)", () => {
    seedMS();
    act(() => { store().addChapter(store().manuscripts[0].id, "MD cap"); });
    const ch = store().manuscripts[0].chapters[1];
    act(() => { store().updateScene(ch.scenes[0].id, { content: "# Título MD\n\ntexto com **força**" }); });
    render(<ChapterEditor chapterId={ch.id} onDeleted={() => {}} />);
    expect(store().manuscripts[0].chapters[1].scenes[0].content).toContain("**força**"); // untouched until first edit
    const body = sceneBody(1);
    body.innerHTML = "<p>editado</p>";
    fireEvent.input(body);
    fireEvent.blur(body);
    expect(store().manuscripts[0].chapters[1].scenes[0].content).toBe("<p>editado</p>"); // md converted/lost on edit
  });

  it("notes top/end + endMarker persist", () => {
    seedMS();
    render(<ChapterEditor chapterId={store().manuscripts[0].chapters[0].id} onDeleted={() => {}} />);
    openNotes();
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

  it("endMarker debounce holds the commit until blur", () => {
    seedMS();
    act(() => { store().updateChapter(store().manuscripts[0].chapters[0].id, { noteEnd: "Epílogo." }); });
    render(<ChapterEditor chapterId={store().manuscripts[0].chapters[0].id} onDeleted={() => {}} />);
    openNotes();
    const marker = screen.getByLabelText("End-of-chapter marker");
    fireEvent.change(marker, { target: { value: "Fim do Livro I" } });
    expect(store().manuscripts[0].chapters[0].endMarker).toBeUndefined(); // debounce holds mid-typing
    fireEvent.blur(marker);
    expect(store().manuscripts[0].chapters[0].endMarker).toBe("Fim do Livro I");
  });

  it("endMarker pending draft flushes on unmount", () => {
    seedMS();
    act(() => { store().updateChapter(store().manuscripts[0].chapters[0].id, { noteEnd: "Epílogo." }); });
    const { unmount } = render(<ChapterEditor chapterId={store().manuscripts[0].chapters[0].id} onDeleted={() => {}} />);
    openNotes();
    const marker = screen.getByLabelText("End-of-chapter marker");
    fireEvent.change(marker, { target: { value: "Fim." } });
    unmount();
    expect(store().manuscripts[0].chapters[0].endMarker).toBe("Fim.");
  });

  it("endMarker editable", () => {
    seedMS();
    act(() => { store().updateChapter(store().manuscripts[0].chapters[0].id, { endMarker: "Fim do cap." }); });
    render(<ChapterEditor chapterId={store().manuscripts[0].chapters[0].id} onDeleted={() => {}} />);
    openNotes();
    const marker = screen.getByLabelText("End-of-chapter marker");
    fireEvent.change(marker, { target: { value: "Fim do Livro I" } });
    fireEvent.blur(marker);
    expect(store().manuscripts[0].chapters[0].endMarker).toBe("Fim do Livro I");
  });

  it("links a calendar day", async () => {
    seedMS();
    const cal = store().addCalendar("prj_1", "Selo Anual");
    render(<ChapterEditor chapterId={store().manuscripts[0].chapters[0].id} onDeleted={() => {}} />);
    openNotes();
    fireEvent.click(screen.getByRole("button", { name: "Link calendar" }));
    await pickSelectOptionSync(() => screen.getByLabelText("Calendar"), "Selo Anual");
    await pickSelectOptionSync(() => screen.getByLabelText("Month"), "Month 3");
    // controlled number inputs: TL fireEvent.change is unreliable here; use the native setter (repo pattern)
    const setVal = (el: HTMLElement, v: string) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!;
      setter.call(el, v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    setVal(screen.getByLabelText("Day") as HTMLElement, "5");
    fireEvent.click(screen.getByRole("button", { name: "Link day" }));
    const ch = store().manuscripts[0].chapters[0];
    expect(ch.linkedCalendarId).toBe(cal.id);
    expect(ch.calendarDayKey).toBe("0:2:4"); // dia 5 humano = índice 4
  });

  it("sanitizes stored scene HTML before it reaches the editor DOM", () => {
    seedMS();
    const chId = store().manuscripts[0].chapters[0].id;
    act(() => { store().replaceChapterBody(chId, '<p>ok</p><img src="x" onerror="window.__pwned=1">'); });
    render(<ChapterEditor chapterId={chId} onDeleted={() => {}} />);
    const body = sceneBody(1);
    expect(body.innerHTML).not.toContain("onerror");
    expect(body.querySelector("img")).toBeNull();
  });

  it("sanitizes stored note HTML before it reaches the editor DOM", () => {
    seedMS();
    const chId = store().manuscripts[0].chapters[0].id;
    act(() => { store().updateChapter(chId, { noteTop: '<img src="y" onerror="window.__pwned=1">' }); });
    render(<ChapterEditor chapterId={chId} onDeleted={() => {}} />);
    openNotes();
    const note = screen.getByTestId("rich-note-top") as HTMLElement;
    expect(note.innerHTML).not.toContain("onerror");
    expect(note.querySelector("img")).toBeNull();
  });
});
