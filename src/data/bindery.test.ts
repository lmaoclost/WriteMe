import { beforeEach, describe, expect, it } from "vitest";
import { act } from "@testing-library/react";
import { useScriptorium } from "./store";
import { defaultBindery, BIND_TRIMS } from "./schema";
import { buildBookHtml } from "../features/manuscript/buildBook";

const store = () => useScriptorium.getState();

beforeEach(() => {
  localStorage.clear();
  useScriptorium.setState(useScriptorium.getInitialState());
});

describe("bindery config", () => {
  it("setBindery patches; export carries it", () => {
    const m = store().addManuscript("prj_1", "Livro");
    expect(m.bindery).toEqual(defaultBindery());
    act(() => { store().setBindery(m.id, { font: "Literata, serif", trim: "5x8", dropCaps: true, dedication: "Ao rio." }); });
    const b = store().manuscripts[0].bindery!;
    expect(b.font).toContain("Literata");
    expect(b.trim).toBe("5x8");
    expect(b.dedication).toBe("Ao rio.");
    expect(BIND_TRIMS).toContain("5x8");
    const json = store().exportData();
    localStorage.clear();
    act(() => { store().importData(json); });
    expect(store().manuscripts[0].bindery!.trim).toBe("5x8");
  });
  it("glossary builds from entries (summary+title) into the book html", () => {
    act(() => { store().addProject("V"); });
    const prj = store().projects[0].id;
    act(() => { store().addEntry(prj, "faction"); });
    act(() => { store().updateEntry(store().entries[0].id, { title: "Casa Vellmor", summary: "Dinastia do rio." }); });
    const m = store().addManuscript(prj, "Livro");
    act(() => { store().setBindery(m.id, { glossary: true }); });
    const html = buildBookHtml(store().manuscripts[0]);
    expect(html).toContain("data-glossary=");
    expect(html).toContain("Casa Vellmor");
    expect(html).toContain("Dinastia do rio.");
  });
  it("trim map has @page size for print", async () => {
    const { trimToPage } = await import("../features/manuscript/bindery");
    expect(trimToPage("6x9")).toBe("6in 9in");
    expect(trimToPage("6.14x9.21")).toBe("6.14in 9.21in");
  });
  it("each preset yields a valid bindery config", async () => {
    const { PRESETS, applyPreset } = await import("../features/manuscript/presets");
    const { defaultBindery } = await import("./schema");
    for (const p of PRESETS) {
      const merged = applyPreset(defaultBindery()!, p.id);
      expect(merged.preset).toBe(p.id);
      expect(merged.typography?.bodyPt).toBeGreaterThan(8);
    }
  });
  it("classic and commercial differ on justification", async () => {
    const { applyPreset } = await import("../features/manuscript/presets");
    const { defaultBindery } = await import("./schema");
    expect(applyPreset(defaultBindery()!, "classic").typography?.justify).toBe(true);
    expect(applyPreset(defaultBindery()!, "commercial").typography?.justify).toBe(false);
  });
  it("preset leaves undeclared fields untouched", async () => {
    const { applyPreset } = await import("../features/manuscript/presets");
    const { defaultBindery } = await import("./schema");
    const cfg = { ...defaultBindery()!, trim: "5x8", backMatter: { glossary: true, colophon: true } };
    const merged = applyPreset(cfg, "manuscript");
    expect(merged.trim).toBe("5x8");
    expect(merged.backMatter).toEqual({ glossary: true, colophon: true });
    expect(merged.preset).toBe("manuscript");
  });
});
