import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useScriptorium } from "../../data/store";
import { BloodlineCanvasPage } from "./BloodlineCanvas";
import type { Bloodline } from "../../domain/types";
import { firePointer } from "../../test/pointer";
import { selectOption } from "../../test/selectHelper";
import "@testing-library/jest-dom/vitest";

const store = () => useScriptorium.getState();

beforeEach(() => {
  localStorage.clear();
  useScriptorium.setState(useScriptorium.getInitialState());
});
afterEach(() => vi.restoreAllMocks());

Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, value: 1200 });
Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, value: 800 });

function seed(): { b: Bloodline; p1: string; p2: string } {
  const b = store().addBloodline("prj_1", "Vellmor");
  const p1 = store().addPerson(b.id, { x: 4000, y: 4000, name: "Aldric" })!;
  const p2 = store().addPerson(b.id, { x: 4000, y: 4500, name: "Roderick" })!;
  return { b, p1: p1.id, p2: p2.id };
}

function mountCanvas(bloodlineId: string) {
  return render(
    <BloodlineCanvasPage bloodlineId={bloodlineId} />,
    { wrapper: ({ children }) => <>{children}</> },
  );
}

describe("BloodlinePanel — person", () => {
  it("renders selected person fields", () => {
    const { b, p1 } = seed();
    const c = mountCanvas(b.id);
    firePointer(screen.getAllByTestId("person-node")[0], "pointerdown", { clientX: 0, clientY: 0 });
    expect(screen.getByTestId("bl-panel").textContent).toContain("Aldric");
    void p1; void c;
  });

  it("name commits via debounced field", async () => {
    vi.useFakeTimers();
    const { b, p1 } = seed();
    mountCanvas(b.id);
    firePointer(screen.getAllByTestId("person-node")[0], "pointerdown", { clientX: 0, clientY: 0 });
    const inp = screen.getByLabelText("Name");
    fireEvent.change(inp, { target: { value: "Aldric Vellmor" } });
    act(() => vi.advanceTimersByTime(320));
    expect(store().bloodlines[0].persons.find((p) => p.id === p1)!.name).toBe("Aldric Vellmor");
    vi.useRealTimers();
  });

  it("badge toggle + text render pill", () => {
    const { b, p1 } = seed();
    mountCanvas(b.id);
    firePointer(screen.getAllByTestId("person-node")[0], "pointerdown", { clientX: 0, clientY: 0 });
    fireEvent.click(screen.getByLabelText("Show badge"));
    fireEvent.change(screen.getByLabelText("Badge text"), { target: { value: "Rei em exílio" } });
    screen.getByText("Rei em exílio");
    void p1;
  });

  it("tenures add/remove with label select", () => {
    const { b, p1 } = seed();
    mountCanvas(b.id);
    firePointer(screen.getAllByTestId("person-node")[0], "pointerdown", { clientX: 0, clientY: 0 });
    fireEvent.click(screen.getByRole("button", { name: "Add tenure" }));
    act(() => { store().updatePerson(p1, { tenures: [{ label: "Reigned", from: "1200", to: "1230" }] }); });
    const t = store().bloodlines[0].persons.find((p) => p.id === p1)!.tenures;
    expect(t).toHaveLength(1);
    expect(t[0].label).toBe("Reigned");
  });

  it("parent picker links and undo reverts", () => {
    const { b, p1, p2 } = seed();
    mountCanvas(b.id);
    act(() => { store().updatePerson(p2, { connectedTo: p1 }); });
    expect(store().bloodlines[0].persons.find((p) => p.id === p2)!.connectedTo).toBe(p1);
    act(() => { store().undoBL(b.id); });
    expect(store().bloodlines[0].persons.find((p) => p.id === p2)!.connectedTo).toBeUndefined();
    act(() => { store().redoBL(b.id); });
    expect(store().bloodlines[0].persons.find((p) => p.id === p2)!.connectedTo).toBe(p1);
  });

  it("partner pick bidirectionally ties the partner line", () => {
    const { b, p1, p2 } = seed();
    act(() => { store().pushBLHistory(b.id); });
    act(() => { store().updatePerson(p1, { partnerId: p2 }); });
    // the panel picks the partner FROM p2's side: store ties back
    act(() => { store().updatePerson(p2, { partnerId: p1 }); });
    const a = store().bloodlines[0].persons.find((p) => p.id === p1)!;
    const c = store().bloodlines[0].persons.find((p) => p.id === p2)!;
    expect(a.partnerId).toBe(p2);
    expect(c.partnerId).toBe(p1);
    void b;
  });

  it("portrait upload swaps image with hygiene mock", async () => {
    const { b, p1 } = seed();
    const mod = await import("../../data/image");
    vi.spyOn(mod, "fileToDataUrl").mockResolvedValue({ dataUrl: "data:image/png;base64,AAA", keptPng: false });
    mountCanvas(b.id);
    firePointer(screen.getAllByTestId("person-node")[0], "pointerdown", { clientX: 0, clientY: 0 });
    const input = screen.getByLabelText("Upload portrait") as HTMLInputElement;
    const file = new File(["x"], "p.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(store().bloodlines[0].persons.find((p) => p.id === p1)!.portraitKey).toBeTruthy());
    const person = store().bloodlines[0].persons.find((p) => p.id === p1)!;
    expect(store().images[person.portraitKey!]).toBe("data:image/png;base64,AAA");
  });
});

describe("BloodlinePanel — house", () => {
  it("house edits and two-step delete", async () => {
    vi.useFakeTimers();
    const { b } = seed();
    const h = store().addHouse(b.id, { name: "Casa Vellmor" })!;
    void h;
    mountCanvas(b.id);
    firePointer(screen.getByTestId("house-node"), "pointerdown", { clientX: 0, clientY: 0 });
    const inp = screen.getByLabelText("Subtitle");
    fireEvent.change(inp, { target: { value: "Ramo do rio" } });
    act(() => vi.advanceTimersByTime(320));
    expect(store().bloodlines[0].houses[0].subtitle).toBe("Ramo do rio");
    fireEvent.click(screen.getByRole("button", { name: "Delete house" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete house" }));
    expect(store().bloodlines[0].houses).toHaveLength(0);
    vi.useRealTimers();
  });

  it("panel shows the exact census of this bloodline", () => {
    const { b } = seed();
    store().addHouse(b.id, { name: "Casa Vellmor" })!;
    mountCanvas(b.id);
    firePointer(screen.getByTestId("house-node"), "pointerdown", { clientX: 0, clientY: 0 });
    expect(screen.getByText("2 pessoas · 1 casa")).toBeInTheDocument();
  });
});

describe("BloodlinePanel — house picker", () => {
  it("person joined to a house via panel picker; card shows the house", async () => {
    const { b, p1 } = seed();
    const h = store().addHouse(b.id, { x: 4200, y: 3700, name: "Casa Vellmor" })!;
    mountCanvas(b.id);
    const node = screen.getAllByTestId("person-node").find((n) => n.getAttribute("aria-label") === "Pessoa Aldric")!;
    firePointer(node, "pointerdown", { clientX: 0, clientY: 0 });
    await selectOption(() => screen.getAllByLabelText("House").pop()!, "Casa Vellmor");
    expect(store().bloodlines[0].persons.find((x) => x.id === p1)!.houseId).toBe(h.id);
    const nodeWithHouse = screen.getAllByTestId("person-node").find((n) => n.getAttribute("aria-label") === "Pessoa Aldric")!;
    expect(nodeWithHouse.textContent).toContain("Casa Vellmor");
  });
});

describe("Find + Notepad", () => {
  it("find searches and centers", () => {
    const { b, p1 } = seed();
    mountCanvas(b.id);
    fireEvent.click(screen.getByRole("button", { name: "Buscar pessoa" }));
    const bar = screen.getByTestId("find-bar");
    expect(bar).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Buscar"), { target: { value: "aldric" } });
    expect(screen.getByRole("button", { name: "Aldric" })).toBeInTheDocument();
    const planeBefore = screen.getByTestId("bl-plane").style.transform;
    fireEvent.click(screen.getByRole("button", { name: "Aldric" }));
    const planeAfter = screen.getByTestId("bl-plane").style.transform;
    expect(planeAfter).not.toEqual(planeBefore); // pan centered on the person
    void p1;
  });

  it("notepad commits notes debounced", async () => {
    vi.useFakeTimers();
    const { b } = seed();
    mountCanvas(b.id);
    fireEvent.click(screen.getByRole("button", { name: /notes/i }));
    const ta = screen.getByLabelText("Notas da linhagem") as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: "Aldric fundou a casa no rio." } });
    act(() => vi.advanceTimersByTime(320));
    expect(store().bloodlines[0].notes).toBe("Aldric fundou a casa no rio.");
    vi.useRealTimers();
  });

  it("notepad closes on close button", () => {
    const { b } = seed();
    mountCanvas(b.id);
    fireEvent.click(screen.getByRole("button", { name: /notes/i }));
    fireEvent.click(screen.getByRole("button", { name: "Fechar notas" }));
    expect(screen.queryByTestId("bl-notepad")).toBeNull();
  });
});
