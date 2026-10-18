import { beforeEach, describe, expect, it } from "vitest";
import { act } from "@testing-library/react";
import { useScriptorium } from "./store";
import { defaultBindery, BIND_TRIMS } from "./schema";
import { buildBookHtml } from "../features/manuscript/buildBook";
import type { Manuscript } from "../domain/types";

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

describe("page geometry", () => {
  it("kdpGutter follows the five KDP page-count tiers", async () => {
    const { kdpGutter } = await import("../features/manuscript/bindery");
    expect(kdpGutter(100)).toBe(0.375);
    expect(kdpGutter(150)).toBe(0.375);
    expect(kdpGutter(151)).toBe(0.5);
    expect(kdpGutter(301)).toBe(0.625);
    expect(kdpGutter(501)).toBe(0.75);
    expect(kdpGutter(701)).toBe(0.875);
  });

  it("pageMargins gives the inner margin enough room for the gutter", async () => {
    const { pageMargins } = await import("../features/manuscript/bindery");
    const m = pageMargins("6x9", 0.5, true);
    expect(m.outer).toBeCloseTo(0.5, 2);
    expect(m.inner).toBeGreaterThanOrEqual(0.75);
    expect(m.bottom).toBeGreaterThan(m.top);
  });

  it("pageMargins non-mirrored uses the inner margin on both sides", async () => {
    const { pageMargins } = await import("../features/manuscript/bindery");
    const m = pageMargins("6x9", 0.5, false);
    expect(m.outer).toBe(m.inner);
    expect(m.top).toBeLessThan(m.bottom);
  });

  it("inches drops trailing zeros", async () => {
    const { inches } = await import("../features/manuscript/bindery");
    expect(inches(0.5)).toBe("0.5in");
    expect(inches(0.63)).toBe("0.63in");
    expect(inches(1)).toBe("1in");
  });

  it("estimatePageCount grows with words", async () => {
    const { estimatePageCount } = await import("../features/manuscript/bindery");
    const base = { id: "m", projectId: "p", title: "T", author: "A", parts: [], bindery: undefined } satisfies Omit<Manuscript, "chapters">;
    const short = estimatePageCount({ ...base, chapters: [{ id: "c", heading: "h", content: "palavra ".repeat(300), order: 1 }] });
    const long = estimatePageCount({ ...base, chapters: [{ id: "c", heading: "h", content: "palavra ".repeat(30000), order: 1 }] });
    expect(long).toBeGreaterThan(short + 80);
  });

  it("estimatePageCount strips HTML tags before counting", async () => {
    const { estimatePageCount } = await import("../features/manuscript/bindery");
    const base = { id: "m", projectId: "p", title: "T", author: "A", parts: [], bindery: undefined } satisfies Omit<Manuscript, "chapters">;
    const plain = estimatePageCount({ ...base, chapters: [{ id: "c", heading: "h", content: "palavra palavra ".repeat(150), order: 1 }] });
    const rich = estimatePageCount({ ...base, chapters: [{ id: "c", heading: "h", content: "<p>palavra palavra</p>".repeat(150), order: 1 }] });
    expect(rich).toBe(plain);
  });
});
