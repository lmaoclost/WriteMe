import { describe, expect, it } from "vitest";
import { emptyProjectData, parseExport, serialize, validateProjectData } from "./schema";
import type { Bloodline, BloodlineHouse, BloodlinePerson, ProjectData } from "../domain/types";

/**
 * Cases (plan Task 1):
 * 1. v1 doc (no bloodlines) validates.
 * 2. v1 → migrate adds `bloodlines: []` (parseExport returns the field).
 * 3. v2 with persons validates.
 * 4. Wrong shapes rejected (person without x/y/name; bad houses).
 * 5. parseExport v1 text WORKS (returns bloodlines: [] after migrate) and v2 works.
 * 6. serialize writes version 2.
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

describe("validateProjectData — bloodlines (schema v2)", () => {
  it("case 1: accepts a v1-shaped doc without bloodlines (field OPTIONAL)", () => {
    expect(validateProjectData(base)).toBe(true);
    expect(validateProjectData({ ...base, bloodlines: [] })).toBe(true);
    expect(validateProjectData(emptyProjectData())).toBe(true);
  });
  it("case 3: v2 with full persons and houses validates", () => {
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
  it("case 6: writes version 2 with the scriptorium marker", () => {
    const doc = JSON.parse(serialize(base)) as { app: string; version: number };
    expect(doc.app).toBe("scriptorium");
    expect(doc.version).toBe(2);
  });
  it("keeps data fields alongside the header (bloodlines included)", () => {
    const doc = JSON.parse(serialize({ ...base, bloodlines: [bloodline()] })) as { version: number; bloodlines: Bloodline[] };
    expect(doc.version).toBe(2);
    expect(doc.bloodlines).toEqual([bloodline()]);
  });
});

describe("parseExport", () => {
  it("case 2/5: v1 text works and migrate adds bloodlines: [] in the returned data", () => {
    const v1 = JSON.stringify({ app: "scriptorium", version: 1, ...base });
    const parsed = parseExport(v1);
    expect(parsed.projects).toEqual(base.projects);
    expect(parsed.bloodlines).toEqual([]);
  });
  it("accepts a v1 doc that already carries valid bloodlines", () => {
    const v1 = JSON.stringify({ app: "scriptorium", version: 1, ...base, bloodlines: [bloodline()] });
    expect(parseExport(v1).bloodlines).toEqual([bloodline()]);
  });
  it("case 5: v2 round-trips with bloodlines", () => {
    const data: ProjectData = { ...base, bloodlines: [bloodline({ persons: [person({ showBadge: true, badgeText: "b" })] })] };
    const text = serialize(data);
    expect(parseExport(text)).toEqual({ ...data, factionWebs: [], calendars: [], plotBoards: [] });
  });
  it("v2 without bloodlines normalizes to [] in the returned data", () => {
    const v2 = JSON.stringify({ app: "scriptorium", version: 2, ...base });
    expect(parseExport(v2).bloodlines).toEqual([]);
  });
  it("rejects unsupported versions and malformed bloodlines", () => {
    expect(() => parseExport(JSON.stringify({ app: "scriptorium", version: 3, ...base, bloodlines: [] })))
      .toThrow(/Versão/);
    expect(() => parseExport(JSON.stringify({
      app: "scriptorium", version: 2, ...base,
      bloodlines: [blEnvelope({ persons: [badPerson({ x: "no" })] })],
    })))
      .toThrow(/estrutura/);
    expect(() => parseExport(JSON.stringify({ app: "scriptorium", version: 2, ...base, bloodlines: null })))
      .toThrow(/estrutura/);
  });
});
