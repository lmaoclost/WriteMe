import { describe, expect, it } from "vitest";
import { validateProjectData, parseExport } from "../../data/schema";
import { CODEX_CATEGORIES, templateSections, categoryDef, categoryLabel, categoryIcon, CATEGORY_COLORS } from "./categories";
import type { ProjectData } from "../../domain/types";

const base: ProjectData = {
  projects: [{ id: "prj_a", name: "X", description: "", createdAt: 1, updatedAt: 1 }],
  entries: [],
  atlases: [],
  manuscripts: [],
  images: {},
};

describe("categories module", () => {
  it("15 forge categories with icons + taglines", () => {
    expect(CODEX_CATEGORIES).toHaveLength(15);
    for (const c of CODEX_CATEGORIES) {
      expect(c.icon.length).toBeGreaterThan(0);
      expect(c.tagline.length).toBeGreaterThan(5);
      expect(c.sections.length).toBeGreaterThan(0);
    }
  });

  it("Character template matches the legacy field list", () => {
    const sections = templateSections("character");
    const labels = sections.flatMap((s) => s.fields.map((f) => f.label));
    expect(labels).toEqual(expect.arrayContaining(["Identity", "Titles", "Appearance", "Personality", "Voice", "Goals & Motivations", "Abilities", "Affiliations", "Relationships", "Equipment", "Backstory"]));
    expect(labels).toHaveLength(11);
  });

  it("label/icon/color helpers cover legacy keys", () => {
    expect(categoryDef("person")).toBeUndefined(); // legacy: no def
    expect(categoryLabel("person")).toBe("Characters");
    expect(categoryIcon("location")).toBe("🗺");
    expect(CATEGORY_COLORS["faction"]).toBeTruthy();
  });
});

describe("schema v2 — entry sections + summary + 15 categories", () => {
  it("accepts a character entry with template sections (+ summary)", () => {
    const d: ProjectData = {
      ...base,
      entries: [{
        id: "ent_1", projectId: "prj_a", title: "Aerith", category: "character",
        body: "", links: [], summary: "Protetora do rio.",
        sections: templateSections("character"),
      }],
    };
    expect(validateProjectData(d)).toBe(true);
  });

  it("rejects malformed sections (field without label/content)", () => {
    const d: ProjectData = {
      ...base,
      entries: [{
        id: "ent_1", projectId: "prj_a", title: "X", category: "artifact",
        body: "", links: [],
        sections: [{ name: "Detail", fields: [{ label: "" }] as never }],
      }],
    };
    expect(validateProjectData(d)).toBe(false);
  });

  it("legacy categories remain valid", () => {
    const d: ProjectData = {
      ...base,
      entries: [{ id: "ent_1", projectId: "prj_a", title: "X", category: "place", body: "", links: [] }],
    };
    expect(validateProjectData(d)).toBe(true);
    expect(parseExport(JSON.stringify({ app: "scriptorium", version: 2, ...d }))).toEqual({ ...d, bloodlines: [], factionWebs: [], calendars: [], plotBoards: [], timelines: [], oathsCharts: [] });
  });
});