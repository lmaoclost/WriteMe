import { describe, expect, it } from "vitest";
import { parseExport, serialize, validateProjectData } from "./schema";
import type { ProjectData, TimelineBead, TimelineEra, TimelineWire } from "../domain/types";

/**
 * Timeline wire: eras are boundaries, not intervals.
 * 1. Eras + origin bead + calendar reference validate.
 * 2. The old `segments` shape is rejected (eras are required).
 * 3. Malformed boundary and calendar references are rejected.
 * 4. serialize writes version 1; every other version throws unsupportedVersion.
 */

const base: ProjectData = {
  projects: [{ id: "prj_a", name: "X", description: "", createdAt: 1, updatedAt: 1 }],
  entries: [],
  atlases: [],
  manuscripts: [],
  images: {},
};

const origin = (over: Partial<TimelineBead> = {}): TimelineBead => ({
  id: "tb_origin", x: 0, y: -60, label: "Start", color: "#c9a227", origin: true, ...over,
});

const bead = (over: Partial<TimelineBead> = {}): TimelineBead => ({
  id: "tb_1", x: 700, y: -60, label: "Guerra", color: "#8f4d6f", ...over,
});

const era = (over: Partial<TimelineEra> = {}): TimelineEra => ({
  id: "te_1", startX: 400, label: "Era I", lineColor: "#e67e22", ...over,
});

const wire = (beads: unknown[] = [origin(), bead()], eras: unknown[] = [era()]): unknown => ({
  id: "tw_1", projectId: "prj_a", name: "Fio", notes: "", beads, eras,
});

const withWire = (w: unknown): ProjectData => ({ ...base, timelines: [w] }) as unknown as ProjectData;

describe("validateProjectData — timeline eras", () => {
  it("1. eras, origin bead and a calendar event reference validate", () => {
    const w = wire(
      [origin(), bead({ calendarEvent: { calendarId: "cal_1", dayKey: "0:2:5", eventId: "ce_1" } })],
      [era(), era({ id: "te_2", startX: 900, boundaryBeadId: "tb_1" })],
    );
    expect(validateProjectData(withWire(w))).toBe(true);
  });

  it("2. the old segments shape is rejected", () => {
    const legacy = { id: "tw_1", projectId: "prj_a", name: "Fio", notes: "", beads: [], segments: [{ id: "s1", fromX: 0, toX: 900, label: "Era", lineColor: "#000" }] };
    expect(validateProjectData(withWire(legacy))).toBe(false);
  });

  it("3. malformed boundaries and calendar references are rejected", () => {
    expect(validateProjectData(withWire(wire([], [era({ startX: "400" as never })])))).toBe(false);
    expect(validateProjectData(withWire(wire([], [era({ boundaryBeadId: 7 as never })])))).toBe(false);
    expect(validateProjectData(withWire(wire([bead({ calendarEvent: { calendarId: "cal_1", dayKey: "0:2:5" } as never })])))).toBe(false);
    expect(validateProjectData(withWire(wire([bead({ calendarEvent: { calendarId: 7 as never, dayKey: "0:2:5", eventId: "ce" } })])))).toBe(false);
    expect(validateProjectData(withWire(wire([bead({ origin: "yes" as never })])))).toBe(false);
  });
});

describe("serialize / parseExport — version 1", () => {
  it("4. writes version 1 and round-trips a wire", () => {
    const doc = JSON.parse(serialize({ ...base, timelines: [wire()] as TimelineWire[] })) as { app: string; version: number };
    expect(doc.app).toBe("scriptorium");
    expect(doc.version).toBe(1);
    const parsed = parseExport(serialize({ ...base, timelines: [wire()] as TimelineWire[] }));
    expect(parsed.timelines![0].eras).toHaveLength(1);
  });

  it("4. any version other than 1 is unsupported", () => {
    for (const version of [0, 2, 3]) {
      expect(() => parseExport(JSON.stringify({ app: "scriptorium", version, ...base }))).toThrow("unsupportedVersion");
    }
  });
});
