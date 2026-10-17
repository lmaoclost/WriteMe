import { describe, expect, it } from "vitest";
import { defaultBindery, emptyProjectData, parseExport, validateProjectData } from "./schema";
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
    expect(() => parseExport("not json")).toThrow(/JSON/);
    expect(() => parseExport(JSON.stringify({ app: "other" }))).toThrow(/scriptorium/);
    expect(() => parseExport(JSON.stringify({ app: "scriptorium", version: 1 }))).toThrow(/estrutura/);
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
  it("defaults carry numberingStyle arabic, pageNumbers false, runningHeadMode book", () => {
    const b = defaultBindery() as Record<string, unknown>;
    expect(b.numberingStyle).toBe("arabic");
    expect(b.pageNumbers).toBe(false);
    expect(b.runningHeadMode).toBe("book");
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
