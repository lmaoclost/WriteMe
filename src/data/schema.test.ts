import { describe, expect, it } from "vitest";
import { defaultBindery, emptyProjectData, parseExport, ParseExportError, validateProjectData, validateProjectDataDetailed } from "./schema";
import type { ProjectData } from "../domain/types";

const valid: ProjectData = {
  projects: [{ id: "prj_a", name: "X", description: "", createdAt: 1, updatedAt: 1 }],
  entries: [{ id: "ent_a", projectId: "prj_a", title: "E", category: "place", body: "", links: [] }],
  atlases: [{ id: "atl_a", projectId: "prj_a", name: "A", regions: [], pins: [] }],
  manuscripts: [{ id: "man_a", projectId: "prj_a", title: "M", author: "", chapters: [] }],
  images: {},
};

describe("validateProjectData", () => {
  it("accepts well-formed data", () => {
    expect(validateProjectData(valid)).toBe(true);
  });
  it("rejects wrong shapes", () => {
    expect(validateProjectData(null)).toBe(false);
    expect(validateProjectData({})).toBe(false);
    expect(validateProjectData({ ...valid, projects: "nope" })).toBe(false);
    expect(validateProjectData({ ...valid, entries: [{ ...valid.entries[0], category: 123 as unknown as string }] })).toBe(false);
    expect(validateProjectData({ ...valid, atlases: [{ ...valid.atlases[0], regions: [{ id: "r", points: [{ x: "a", y: 0 }], color: "#fff", fillOpacity: 0.5, label: "" }] }] })).toBe(false);
    expect(validateProjectData({ ...valid, images: { k: 42 } })).toBe(false);
  });
  it("rejects images that are not data:image urls", () => {
    expect(validateProjectData({ ...valid, images: { k: "https://evil.example/x.png" } })).toBe(false);
    expect(validateProjectData({ ...valid, images: { k: "javascript:alert(1)" } })).toBe(false);
    expect(validateProjectData({ ...valid, images: { k: "data:image/png;base64,AAA" } })).toBe(true);
  });
  it("rejects points outside [0,1]", () => {
    const bad = {
      ...valid,
      atlases: [{ ...valid.atlases[0], regions: [{ id: "r", points: [{ x: 1.5, y: 0 }], color: "#f00", fillOpacity: 0.5, label: "" }] }],
    };
    expect(validateProjectData(bad)).toBe(false);
  });
  it("rejects wrong-typed optional keys when present", () => {
    expect(validateProjectData({ ...valid, projects: [{ ...valid.projects[0], coverImageKey: 42 }] })).toBe(false);
    expect(validateProjectData({ ...valid, entries: [{ ...valid.entries[0], imageKey: 21 }] })).toBe(false);
    expect(validateProjectData({ ...valid, atlases: [{ ...valid.atlases[0], mapImageKey: 7 }] })).toBe(false);
    expect(validateProjectData({
      ...valid,
      atlases: [{ ...valid.atlases[0], regions: [{ id: "r", points: [], color: "#fff", fillOpacity: 0.5, label: "L", entryId: 8 }] }],
    })).toBe(false);
    expect(validateProjectData({
      ...valid,
      atlases: [{ ...valid.atlases[0], pins: [{ id: "pin_a", x: 0, y: 0, type: "place", color: "#fff", label: "P", entryId: 5 }] }],
    })).toBe(false);
  });
  it("rejects fillOpacity out of [0,1] or non-number", () => {
    expect(validateProjectData({
      ...valid,
      atlases: [{ ...valid.atlases[0], regions: [{ id: "r", points: [{ x: 0, y: 0 }], color: "#fff", fillOpacity: 1.5, label: "" }] }],
    })).toBe(false);
    expect(validateProjectData({
      ...valid,
      atlases: [{ ...valid.atlases[0], regions: [{ id: "r", points: [{ x: 0, y: 0 }], color: "#fff", fillOpacity: "0.5", label: "" }] }],
    })).toBe(false);
  });
  it("accepts absent fillOpacity", () => {
    const ok = {
      ...valid,
      atlases: [{ ...valid.atlases[0], regions: [{ id: "r", points: [{ x: 0, y: 0 }], color: "#fff", fillOpacity: undefined, label: "" }] }],
    };
    expect(validateProjectData(ok)).toBe(true);
  });
});

describe("parseExport", () => {
  it("round-trips", () => {
    const text = JSON.stringify({ app: "scriptorium", version: 1, ...valid });
    expect(parseExport(text)).toEqual({ ...valid, bloodlines: [], factionWebs: [], calendars: [], plotBoards: [], timelines: [], oathsCharts: [], wellsprings: [], conlangs: [] });
  });
  it("throws with clear message on invalid payload", () => {
    expect(() => parseExport("not json")).toThrow("invalidJson");
    expect(() => parseExport(JSON.stringify({ app: "other" }))).toThrow("notScriptorium");
    expect(() => parseExport(JSON.stringify({ app: "scriptorium", version: 1 }))).toThrow("invalidStructure");
  });
  it("emptyProjectData is fresh and valid", () => {
    expect(validateProjectData(emptyProjectData())).toBe(true);
  });
});
describe("BinderyConfig v2 fields", () => {
  const mk = (patch: Record<string, unknown>) => ({
    id: "man_x", projectId: "prj_x", title: "T", author: "A", chapters: [],
    bindery: {
      font: "Georgia, serif", trim: "6x9", dropCaps: false, runningHead: true,
      titlePage: true, toc: true, glossary: false, ...patch,
    },
  });
  it("defaults carry numberingStyle arabic, pageNumbers true, runningHeadMode chapter", () => {
    const b = defaultBindery() as Record<string, unknown>;
    expect(b.numberingStyle).toBe("arabic");
    expect(b.pageNumbers).toBe(true);
    expect(b.runningHeadMode).toBe("chapter");
  });
  it("accepts the new fields", () => {
    expect(validateProjectData({ projects: [], entries: [], atlases: [], manuscripts: [mk({
      numberingStyle: "word", pageNumbers: true, runningHeadMode: "chapter",
    })], images: {} })).toBe(true);
  });
  it("rejects invalid numberingStyle/runningHeadMode/pageNumbers", () => {
    expect(validateProjectData({ projects: [], entries: [], atlases: [], manuscripts: [mk({ numberingStyle: "roman" })], images: {} })).toBe(false);
    expect(validateProjectData({ projects: [], entries: [], atlases: [], manuscripts: [mk({ runningHeadMode: "verse" })], images: {} })).toBe(false);
    expect(validateProjectData({ projects: [], entries: [], atlases: [], manuscripts: [mk({ pageNumbers: "yes" })], images: {} })).toBe(false);
  });
  it("still accepts v1 docs without the new fields", () => {
    const doc = mk({});
    (doc.bindery as Record<string, unknown>).numberingStyle = undefined;
    (doc.bindery as Record<string, unknown>).pageNumbers = undefined;
    (doc.bindery as Record<string, unknown>).runningHeadMode = undefined;
    expect(validateProjectData({ projects: [], entries: [], atlases: [], manuscripts: [doc], images: {} })).toBe(true);
  });
});

describe("manuscript parts and bindery layout blocks", () => {
  const doc = (m: unknown): ProjectData => ({ ...valid, manuscripts: [m] }) as unknown as ProjectData;
  const withBindery = (patch: Record<string, unknown>) =>
    doc({ ...valid.manuscripts[0], bindery: { ...defaultBindery(), ...patch } });

  it("accepts a manuscript with parts and a v2 bindery", () => {
    const data = doc({
      id: "m1", projectId: "p1", title: "Livro", author: "Ana",
      chapters: [{ id: "c1", heading: "Um", content: "", order: 1, partId: "pt1" }],
      parts: [{ id: "pt1", title: "A Queda", order: 1 }],
      bindery: defaultBindery(),
    });
    expect(validateProjectData(data)).toBe(true);
  });

  it("defaultBindery turns front matter on and keeps parts empty", () => {
    const b = defaultBindery()!;
    expect(b.frontMatter?.halfTitle).toBe(true);
    expect(b.frontMatter?.copyright).toBe(true);
    expect(b.typography?.bodyPt).toBe(11);
    expect(b.typography?.leading).toBe(14.5);
    expect(b.geometry?.gutter).toBe("auto");
    expect(b.opener?.sink).toBe(0.18);
    expect(b.preset).toBe("classic");
    expect(b.sceneOrnament).toBe("asterism");
  });

  it("rejects malformed parts and partIds while accepting absent parts", () => {
    const ms = (patch: Record<string, unknown>) =>
      ({ id: "m1", projectId: "p1", title: "L", author: "A", chapters: [{ id: "c1", heading: "Um", content: "", order: 1 }], ...patch });
    expect(validateProjectData(doc(ms({})))).toBe(true);
    expect(validateProjectData(doc(ms({ parts: [] })))).toBe(true);
    expect(validateProjectData(doc(ms({ parts: [{ id: "pt1", title: "P", order: 1, epigraph: "Epi" }] })))).toBe(true);
    expect(validateProjectData(doc(ms({ parts: [{ id: "pt1", order: 1 }] })))).toBe(false);
    expect(validateProjectData(doc(ms({ parts: [{ id: "pt1", title: "P", order: "1" }] })))).toBe(false);
    expect(validateProjectData(doc(ms({ parts: [{ id: "pt1", title: "P", order: 1, epigraph: 7 }] })))).toBe(false);
    expect(validateProjectData(doc(ms({ parts: "nope" })))).toBe(false);
    expect(validateProjectData(doc(ms({ chapters: [{ id: "c1", heading: "Um", content: "", order: 1, partId: 7 }] })))).toBe(false);
  });

  it("validates v2 bindery blocks tolerantly: absent or partial ok, wrong-typed rejected", () => {
    expect(validateProjectData(withBindery({}))).toBe(true); // full defaultBindery validates
    expect(validateProjectData(withBindery({ typography: { bodyPt: 12 } }))).toBe(true); // partial block ok
    expect(validateProjectData(withBindery({ typography: "big" }))).toBe(false);
    expect(validateProjectData(withBindery({ typography: { ...(defaultBindery()!.typography), bodyPt: "11" } }))).toBe(false);
    expect(validateProjectData(withBindery({ geometry: { gutter: "wide", mirrored: true } }))).toBe(false);
    expect(validateProjectData(withBindery({ geometry: { gutter: Number.NaN, mirrored: true } }))).toBe(false);
    expect(validateProjectData(withBindery({ opener: { sink: "0.18", suppressHead: true, suppressFolio: true } }))).toBe(false);
    expect(validateProjectData(withBindery({ frontMatter: { halfTitle: "yes", copyright: true, romanNumerals: true } }))).toBe(false);
    expect(validateProjectData(withBindery({ frontMatter: null }))).toBe(false);
    expect(validateProjectData(withBindery({ frontMatter: { halfTitle: true, copyright: true, romanNumerals: true, copyrightInfo: null } }))).toBe(false);
    expect(validateProjectData(withBindery({ frontMatter: { halfTitle: true, copyright: true, romanNumerals: true, copyrightInfo: { year: 2024 } } }))).toBe(false);
    expect(validateProjectData(withBindery({ backMatter: { glossary: false, colophon: "no" } }))).toBe(false);
    expect(validateProjectData(withBindery({ backMatter: { aboutAuthor: "Ana" } }))).toBe(true); // panel writes omit both booleans
    expect(validateProjectData(withBindery({ preset: "gothic" }))).toBe(false);
    expect(validateProjectData(withBindery({ sceneOrnament: "diamond" }))).toBe(false);
  });
});

describe("validateProjectDataDetailed", () => {
  it("reports the offending path for a wrong-typed field", () => {
    const bad = { ...valid, entries: [{ ...valid.entries[0], category: 123 as unknown as string }] };
    const issues = validateProjectDataDetailed(bad);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].path).toContain("entries.0.category");
  });

  it("returns no issues for well-formed data", () => {
    expect(validateProjectDataDetailed(valid)).toEqual([]);
  });
});

describe("parseExport error detail", () => {
  it("attaches the first issue path to invalidStructure", () => {
    const payload = { app: "scriptorium", version: 1, ...valid, entries: [{ ...valid.entries[0], body: 9 as unknown as string }] };
    try {
      parseExport(JSON.stringify(payload));
      expect.unreachable("expected a throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ParseExportError);
      const e = error as ParseExportError;
      expect(e.code).toBe("invalidStructure");
      expect(e.details).toContain("entries.0.body");
    }
  });
});
