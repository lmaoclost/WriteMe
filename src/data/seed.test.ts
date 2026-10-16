import { describe, expect, it } from "vitest";
import { seedDemoProject } from "./seed";
import { validateProjectData } from "./schema";
import { CODEX_CATEGORIES } from "../features/entries/categories";
import { PIN_TYPES } from "../domain/types";

describe("seedDemoProject", () => {
  const data = seedDemoProject();

  it("produces valid data", () => {
    expect(validateProjectData(data)).toBe(true);
  });
  it("one project named for the demo", () => {
    expect(data.projects).toHaveLength(1);
    expect(data.projects[0].name).toContain("exemplo");
  });
  it("entries cover every forge category with links between them", () => {
    const cats = new Set(data.entries.map((e) => e.category));
    CODEX_CATEGORIES.forEach((c) => expect(cats.has(c.key)).toBe(true));
    expect(data.entries.some((e) => e.links.length > 0)).toBe(true);
    // every link points at an existing entry id
    const ids = new Set(data.entries.map((e) => e.id));
    data.entries.forEach((e) => e.links.forEach((l) => expect(ids.has(l)).toBe(true)));
  });
  it("one atlas with procedural svg map, regions with >=3 points, pins of varied types", () => {
    expect(data.atlases).toHaveLength(1);
    const atlas = data.atlases[0];
    const mapKey = atlas.mapImageKey;
    expect(mapKey).toBeTruthy();
    const map = data.images[mapKey!];
    expect(map.startsWith("data:image/svg+xml")).toBe(true);
    expect(atlas.regions.length).toBeGreaterThanOrEqual(3);
    atlas.regions.forEach((r) => expect(r.points.length).toBeGreaterThanOrEqual(3));
    expect(atlas.pins.length).toBeGreaterThanOrEqual(4);
    expect(new Set(atlas.pins.map((p) => p.type)).size).toBe(PIN_TYPES.length);
  });
  it("regions/pins reference real entry ids", () => {
    const ids = new Set(data.entries.map((e) => e.id));
    data.atlases[0].pins.forEach((p) => p.entryId && expect(ids.has(p.entryId)).toBe(true));
  });
  it("manuscript with 3 non-empty chapters in order", () => {
    expect(data.manuscripts).toHaveLength(1);
    const m = data.manuscripts[0];
    expect(m.chapters).toHaveLength(3);
    expect(m.chapters.map((c) => c.order)).toEqual([0, 1, 2]);
    m.chapters.forEach((c) => expect(c.content.length).toBeGreaterThan(50));
  });
  it("one bloodline with linked persons and houses", () => {
    expect(data.bloodlines).toHaveLength(1);
    const bl = data.bloodlines![0];
    expect(bl.persons.length).toBeGreaterThanOrEqual(6);
    expect(bl.houses.length).toBeGreaterThanOrEqual(2);
    const ids = new Set(bl.persons.map((p) => p.id));
    bl.persons.forEach((p) => {
      for (const l of [p.connectedTo, p.siblingId, p.partnerId]) {
        if (l) expect(ids.has(l)).toBe(true);
      }
    });
    expect(bl.persons.some((p) => p.tenures.length > 0)).toBe(true);
  });

  it("one faction web with 4 factions and typed connections", () => {
    expect(data.factionWebs).toHaveLength(1);
    const fw = data.factionWebs![0];
    expect(fw.factions.length).toBeGreaterThanOrEqual(4);
    const fids = new Set(fw.factions.map((f) => f.id));
    fw.connections.forEach((c) => {
      expect(fids.has(c.fromId)).toBe(true);
      expect(fids.has(c.toId)).toBe(true);
      expect(c.fromId).not.toBe(c.toId);
    });
  });
  it("one calendar with themed months and events", () => {
    expect(data.calendars).toHaveLength(1);
    const cal = data.calendars![0];
    expect(cal.months).toHaveLength(12);
    expect(cal.weekdays).toHaveLength(7);
    const nEvents = Object.values(cal.events).reduce((n, l) => n + l.length, 0);
    expect(nEvents).toBeGreaterThanOrEqual(8);
    Object.keys(cal.events).forEach((k) => {
      const [, m, d] = k.split(":").map(Number);
      expect(m).toBeLessThan(cal.months.length);
      expect(d).toBeLessThanOrEqual(cal.months[m].days);
    });
  });

  it("one plot board with acts, cards and wires", () => {
    expect(data.plotBoards).toHaveLength(1);
    const pb = data.plotBoards![0];
    expect(pb.acts.length).toBeGreaterThanOrEqual(3);
    expect(pb.hasPrologue).toBe(true);
    expect(pb.hasEpilogue).toBe(true);
    expect(pb.cards.length).toBeGreaterThanOrEqual(6);
    expect(pb.cards.every((c) => c.parts.length > 0)).toBe(true);
    const cids = new Set(pb.cards.map((c) => c.id));
    pb.wires.forEach((w) => {
      expect(cids.has(w.fromCardId)).toBe(true);
      expect(cids.has(w.toCardId)).toBe(true);
      expect(w.fromCardId).not.toBe(w.toCardId);
    });
  });

  it("one timeline with beads and segments", () => {
    expect(data.timelines).toHaveLength(1);
    const t = data.timelines![0];
    expect(t.beads.length).toBeGreaterThanOrEqual(5);
    expect(t.segments.length).toBeGreaterThanOrEqual(1);
    t.segments.forEach((s) => expect(s.toX).toBeGreaterThan(s.fromX));
  });
});
