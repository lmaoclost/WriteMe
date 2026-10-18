import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useScriptorium } from "../../data/store";
import { ConlangPage } from "./ConlangPage";
import { ConlangIndexPage } from "./ConlangIndexPage";

const store = () => useScriptorium.getState();

beforeEach(() => {
  localStorage.clear();
  useScriptorium.setState(useScriptorium.getInitialState());
});

const seed = () => store().addConlang("prj_1", "Fala do Selo");

describe("ConlangPage — alfabeto", () => {
  it("adds glyph (next letter), opens editor, draws stroke persists path", () => {
    const c = seed();
    render(<ConlangPage conlangId={c.id} />);
    fireEvent.click(screen.getByRole("button", { name: "New glyph" }));
    expect(store().conlangs![0].glyphs[0].char).toBe("A");
    const svg = document.querySelector(".glyph-canvas") as unknown as HTMLElement;
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 360, height: 360, right: 360, bottom: 360, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
    const fire = (type: string, x: number, y: number) => {
      const e = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperties(e, { clientX: { value: x }, clientY: { value: y }, pointerId: { value: 1 }, pointerType: { value: "mouse" }, button: { value: 0 } });
      svg.dispatchEvent(e);
    };
    fire("pointerdown", 40, 40);
    fire("pointermove", 80, 60);
    fire("pointermove", 130, 90);
    fire("pointerup", 130, 90);
    expect(store().conlangs![0].glyphs[0].svgPath).toContain("Q ");
  });

  it("glyph letter is editable (what the glyph represents) with duplicate guard", () => {
    const c = seed();
    render(<ConlangPage conlangId={c.id} />);
    fireEvent.click(screen.getByRole("button", { name: "New glyph" }));
    const inp = screen.getByLabelText("Represents letter") as HTMLInputElement;
    fireEvent.change(inp, { target: { value: "th" } });
    fireEvent.blur(inp);
    expect(store().conlangs![0].glyphs[0].char).toBe("TH");
    // duplicate → toast + revert
    const dup = screen.getByLabelText("Represents letter") as HTMLInputElement;
    fireEvent.change(dup, { target: { value: "TH" } });
    fireEvent.blur(dup);
    expect(store().conlangs![0].glyphs[0].char).toBe("TH");
  });

  it("duplicate letter rejected; delete glyph", () => {
    const c = seed();
    render(<ConlangPage conlangId={c.id} />);
    fireEvent.click(screen.getByRole("button", { name: "New glyph" }));
    let again: unknown;
    act(() => { again = store().addGlyph(c.id, "A"); });
    expect(again).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Delete glyph/ }));
    expect(store().conlangs![0].glyphs).toHaveLength(0);
  });

  it("alphabet PNG export fires download", () => {
    const c = seed();
    act(() => { store().addGlyph(c.id, "A"); });
    act(() => { store().updateGlyph(store().conlangs![0].glyphs[0].id, { svgPath: "M 10 10 L 40 40" }); });
    // jsdom não decodifica <img>: Image fake dispara onload no src
    function FakeImage(this: object) {
      const el = { width: 0, height: 0, onload: null as (() => void) | null };
      Object.defineProperty(el, "src", {
        set() { el.width = 960; el.height = 480; if (el.onload) el.onload(); },
      });
      return el;
    }
    vi.stubGlobal("Image", FakeImage as never);
    (HTMLCanvasElement.prototype as unknown as { drawImage?: unknown }).drawImage = vi.fn();    HTMLCanvasElement.prototype.toBlob = vi.fn((cb: (b: Blob | null) => void) => { cb(new Blob(["png"], { type: "image/png" })) as never; });
    const created: HTMLAnchorElement[] = [];
    const orig = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation(((tag: string) => {
      const el = orig(tag) as HTMLAnchorElement;
      created.push(el);
      return el as never;
    }) as never);
    render(<ConlangPage conlangId={c.id} />);
    fireEvent.click(screen.getByRole("button", { name: /Exportar folha/ }));
    expect(created.some((el) => el.tagName === "A" && (el.download ?? "").includes("alfabeto") && ((el.href || "").includes("blob:") || (el.href || "").includes("svg")))).toBe(true);
    vi.restoreAllMocks();
  });
});

describe("ConlangPage — léxico", () => {
  it("add word row + theme chip + filter + delete", () => {
    const c = seed();
    render(<ConlangPage conlangId={c.id} />);
    fireEvent.click(screen.getByRole("button", { name: "Lexicon" }));
    fireEvent.change(screen.getByLabelText("New word"), { target: { value: "sarnen" } });
    fireEvent.change(screen.getByLabelText("Meaning"), { target: { value: "rio-mãe" } });
    fireEvent.change(screen.getByLabelText("Theme group"), { target: { value: "águas" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(store().conlangs![0].words).toHaveLength(1);
    fireEvent.change(screen.getByLabelText("New word"), { target: { value: "vellmor" } });
    fireEvent.change(screen.getByLabelText("Meaning"), { target: { value: "coroa quebrada" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByText("águas")).toBeInTheDocument();
    fireEvent.click(screen.getByText("águas"));
    fireEvent.click(screen.getByLabelText("Remover sarnen"));
    expect(store().conlangs![0].words.map((w) => w.word)).toEqual(["vellmor"]);
  });
});

describe("ConlangIndexPage", () => {
  it("index creates + deletes", () => {
    render(<MemoryRouter><ConlangIndexPage projectId="prj_1" /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "New language" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Fala do Selo" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(screen.getByText("Fala do Selo")).toBeInTheDocument();
    fireEvent.click(screen.getByTitle("Delete language"));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(store().conlangs).toHaveLength(0);
  });
});
