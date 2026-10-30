import { describe, expect, it } from "vitest";
import { emptyProjectData, parseExport, serialize, validateProjectData } from "./schema";
import type { Bloodline, BloodlineHouse, BloodlinePerson, ProjectData } from "../domain/types";

/**
 * Cases:
 * 1. Only version 1 is accepted; any other version throws unsupportedVersion.
 * 2. A doc with no bloodlines normalizes to [].
 * 3. Bloodlines with persons and houses validate.
 * 4. Wrong shapes rejected (person without x/y/name; bad houses).
 * 5. serialize writes version 1 and round-trips bloodlines.
 */

const base: ProjectData = {
  projects: [{ id: "prj_a", name: "X", description: "", createdAt: 1, updatedAt: 1 }],
  entries: [{ id: "ent_a", projectId: "prj_a", title: "E", category: "place", body: "", links: [] }],
  atlases: [{ id: "atl_a", projectId: "prj_a", name: "A", regions: [], pins: [] }],
  manuscripts: [{ id: "man_a", projectId: "prj_a", title: "M", author: "", chapters: [] }],
  images: {},
};

const person = (over: Partial<BloodlinePerson> = {}): BloodlinePerson => ({
  id: "per_1", x: 100, y: 200, name: "Aldric",
  additionalTitles: [], tenures: [],
  showBadge: false, badgeText: "", isTwin: false,
  ...over,
});

const house = (over: Partial<BloodlineHouse> = {}): BloodlineHouse => ({
  id: "hou_1", x: 300, y: 400, name: "Vellmor",
  isMainBranch: false, isMonarch: false,
  ...over,
});

const bloodline = (over: Partial<Bloodline> = {}): Bloodline => ({
  id: "bl_1", projectId: "prj_a", name: "Vellmor",
  persons: [person()], houses: [house()], notes: "",
  ...over,
});

const withBL = (b: unknown): ProjectData =>
  ({ ...base, bloodlines: b }) as unknown as ProjectData;

/** Raw builders: spread a valid object and corrupt fields with wrong types. */
const badPerson = (over: Record<string, unknown>): unknown => ({ ...person(), ...over });
const badHouse = (over: Record<string, unknown>): unknown => ({ ...house(), ...over });
const blEnvelope = (over: { persons?: unknown[]; houses?: unknown[]; notes?: unknown } = {}): unknown => ({
  id: "bl_1", projectId: "prj_a", name: "Vellmor",
  persons: over.persons !== undefined ? over.persons : [person()],
  houses: over.houses !== undefined ? over.houses : [house()],
  notes: over.notes !== undefined ? over.notes : "",
});

describe("validateProjectData — bloodlines", () => {
  it("case 1: accepts a doc without bloodlines (field OPTIONAL)", () => {
    expect(validateProjectData(base)).toBe(true);
    expect(validateProjectData({ ...base, bloodlines: [] })).toBe(true);
    expect(validateProjectData(emptyProjectData())).toBe(true);
  });
  it("case 3: full persons and houses validate", () => {
    const full = bloodline({
      persons: [
        person({
          suffix: "of Vellmor", portraitKey: "img_entry_k1", title: "Rei",
          relationship: "pai de Bram", bio: "Fundo", birthDate: "1000", deathDate: "1080",
          additionalTitles: [{ title: "O Sábio" }],
          tenures: [{ label: "Reinou de Vellmor", from: "1002", to: "1080" }],
          showBadge: true, badgeText: "Coroado em 1002",
          connectedTo: undefined, siblingId: "per_2", partnerId: "per_3",
          birthOrder: 1, isTwin: true,
        }),
        person({ id: "per_2" }),
        person(),
      ],
      houses: [house({ subtitle: "Ramo principal", isMainBranch: true, isMonarch: true })],
      notes: "notas da linhagem",
    });
    expect(validateProjectData({ ...base, bloodlines: [full] })).toBe(true);
  });
  it("case 4: person without x/y/name is rejected", () => {
    expect(validateProjectData(withBL([blEnvelope({ persons: [badPerson({ x: undefined })] })]))).toBe(false);
    expect(validateProjectData(withBL([blEnvelope({ persons: [badPerson({ x: "100" })] })]))).toBe(false);
    expect(validateProjectData(withBL([blEnvelope({ persons: [badPerson({ y: undefined })] })]))).toBe(false);
    expect(validateProjectData(withBL([blEnvelope({ persons: [badPerson({ y: Number.NaN })] })]))).toBe(false);
    expect(validateProjectData(withBL([blEnvelope({ persons: [badPerson({ name: undefined })] })]))).toBe(false);
    expect(validateProjectData(withBL([blEnvelope({ persons: [badPerson({ name: 7 })] })]))).toBe(false);
  });
  it("case 4: bad houses are rejected", () => {
    expect(validateProjectData(withBL([blEnvelope({ houses: [badHouse({ x: undefined })] })]))).toBe(false);
    expect(validateProjectData(withBL([blEnvelope({ houses: [badHouse({ isMainBranch: "yes" })] })]))).toBe(false);
    expect(validateProjectData(withBL([blEnvelope({ houses: [badHouse({ isMonarch: undefined })] })]))).toBe(false);
    expect(validateProjectData(withBL([blEnvelope({ houses: [badHouse({ subtitle: 42 })] })]))).toBe(false);
    expect(validateProjectData(withBL([blEnvelope({ houses: [badHouse({ name: undefined })] })]))).toBe(false);
  });
  it("rejects malformed person collection fields and optional strings", () => {
    expect(validateProjectData(withBL([blEnvelope({ persons: [badPerson({ additionalTitles: [{ title: 3 }] })] })]))).toBe(false);
    expect(validateProjectData(withBL([blEnvelope({ persons: [badPerson({ additionalTitles: ["x"] })] })]))).toBe(false);
    expect(validateProjectData(withBL([blEnvelope({ persons: [badPerson({ tenures: [{ label: "l", from: "f" }] })] })]))).toBe(false);
    expect(validateProjectData(withBL([blEnvelope({ persons: [badPerson({ tenures: [{ label: "l", from: "f", to: 2 }] })] })]))).toBe(false);
    expect(validateProjectData(withBL([blEnvelope({ persons: [badPerson({ showBadge: "yes" })] })]))).toBe(false);
    expect(validateProjectData(withBL([blEnvelope({ persons: [badPerson({ badgeText: undefined })] })]))).toBe(false);
    expect(validateProjectData(withBL([blEnvelope({ persons: [badPerson({ isTwin: undefined })] })]))).toBe(false);
    expect(validateProjectData(withBL([blEnvelope({ persons: [badPerson({ suffix: 9 })] })]))).toBe(false);
    expect(validateProjectData(withBL([blEnvelope({ persons: [badPerson({ portraitKey: 9 })] })]))).toBe(false);
    expect(validateProjectData(withBL([blEnvelope({ persons: [badPerson({ bio: 9 })] })]))).toBe(false);
    expect(validateProjectData(withBL([blEnvelope({ persons: [badPerson({ birthOrder: "1" })] })]))).toBe(false);
    expect(validateProjectData(withBL([blEnvelope({ persons: [badPerson({ connectedTo: 9 })] })]))).toBe(false);
    expect(validateProjectData(withBL([blEnvelope({ persons: [badPerson({ siblingId: 9 })] })]))).toBe(false);
    expect(validateProjectData(withBL([blEnvelope({ persons: [badPerson({ partnerId: 9 })] })]))).toBe(false);
  });
  it("accepts person.entryId (linked acervo entry) and rejects wrong types", () => {
    expect(validateProjectData({ ...base, bloodlines: [bloodline({ persons: [person({ entryId: "ent_a" })] })] })).toBe(true);
    expect(validateProjectData(withBL([blEnvelope({ persons: [badPerson({ entryId: 9 })] })]))).toBe(false);
  });
  it("accepts faction.territoryRegionId (atlas region) and rejects wrong types", () => {
    const faction = { id: "fac_1", x: 10, y: 20, name: "Casa Vellmor", color: "#c0392b", territoryRegionId: "reg_1" };
    const web = { id: "fw_1", projectId: "prj_a", name: "Teia", factions: [faction], connections: [], notes: "" };
    expect(validateProjectData({ ...base, factionWebs: [web] })).toBe(true);
    expect(validateProjectData({ ...base, factionWebs: [{ ...web, factions: [{ ...faction, territoryRegionId: 7 }] }] })).toBe(false);
  });
  it("rejects malformed bloodline envelope", () => {
    expect(validateProjectData(withBL([{ id: "bl_x", projectId: "prj_a", name: "b", persons: [], houses: [] }]))).toBe(false);
    const noNotes = blEnvelope() as Record<string, unknown>;
    delete noNotes.notes;
    expect(validateProjectData(withBL([noNotes]))).toBe(false);
    expect(validateProjectData(withBL([blEnvelope({ notes: 42 })]))).toBe(false);
    expect(validateProjectData(withBL([{ id: "bl_x", name: "b", persons: [], houses: [], notes: "" }]))).toBe(false);
    expect(validateProjectData(withBL("nope"))).toBe(false);
    expect(validateProjectData(withBL(null))).toBe(false);
  });
});

describe("serialize", () => {
  it("case 6: writes version 1 with the writeme marker", () => {
    const doc = JSON.parse(serialize(base)) as { app: string; version: number };
    expect(doc.app).toBe("writeme");
    expect(doc.version).toBe(1);
  });
  it("keeps data fields alongside the header (bloodlines included)", () => {
    const doc = JSON.parse(serialize({ ...base, bloodlines: [bloodline()] })) as { version: number; bloodlines: Bloodline[] };
    expect(doc.version).toBe(1);
    expect(doc.bloodlines).toEqual([bloodline()]);
  });
});

describe("parseExport", () => {
  it("case 2: a doc without bloodlines normalizes to []", () => {
    const doc = JSON.stringify({ app: "writeme", version: 1, ...base });
    expect(parseExport(doc).bloodlines).toEqual([]);
  });
  it("case 5: v1 round-trips with bloodlines", () => {
    const data: ProjectData = { ...base, bloodlines: [bloodline({ persons: [person({ showBadge: true, badgeText: "b" })] })] };
    const text = serialize(data);
    expect(parseExport(text)).toEqual({ ...data, factionWebs: [], calendars: [], plotBoards: [], timelines: [], oathsCharts: [], wellsprings: [], conlangs: [] });
  });
  it("case 1: any version other than 1 is rejected", () => {
    for (const version of [0, 2, 3]) {
      expect(() => parseExport(JSON.stringify({ app: "writeme", version, ...base })))
        .toThrow("unsupportedVersion");
    }
  });
  it("rejects malformed bloodlines in a valid doc", () => {
    expect(() => parseExport(JSON.stringify({
      app: "writeme", version: 1, ...base,
      bloodlines: [blEnvelope({ persons: [badPerson({ x: "no" })] })],
    })))
      .toThrow("invalidStructure");
    expect(() => parseExport(JSON.stringify({ app: "writeme", version: 1, ...base, bloodlines: null })))
      .toThrow("invalidStructure");
  });
});
