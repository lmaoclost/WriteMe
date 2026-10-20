import { describe, expect, it } from "vitest";
import { MIN_ERA_WIDTH, clampBeadX, clampBoundary, contentEnd, eraAt, eraSpans } from "./timeline";
import type { TimelineBead, TimelineEra } from "./types";

const bead = (id: string, x: number, origin = false): TimelineBead => ({
  id, x, y: -60, label: id, color: "#000", ...(origin ? { origin: true } : {}),
});
const era = (id: string, startX: number, boundaryBeadId?: string): TimelineEra => ({
  id, startX, label: id, lineColor: "#000", ...(boundaryBeadId ? { boundaryBeadId } : {}),
});

describe("eraSpans", () => {
  it("chains eras: each ends where the next starts", () => {
    const spans = eraSpans([era("a", 100), era("b", 300)], [], 1000);
    expect(spans.map((s) => [s.start, s.end])).toEqual([[100, 300], [300, 1000]]);
  });

  it("orders out-of-order eras by start", () => {
    const spans = eraSpans([era("b", 300), era("a", 100)], [], 1000);
    expect(spans.map((s) => s.era.id)).toEqual(["a", "b"]);
  });

  it("a boundary bead overrides its startX", () => {
    const beads = [bead("e1", 250)];
    const spans = eraSpans([era("a", 0), era("b", 999, "e1")], beads, 1000);
    expect(spans.map((s) => [s.start, s.end])).toEqual([[0, 250], [250, 1000]]);
  });

  it("a dangling boundary bead falls back to startX", () => {
    const spans = eraSpans([era("a", 0), era("b", 400, "missing")], [], 1000);
    expect(spans.map((s) => s.start)).toEqual([0, 400]);
  });

  it("the last era never collapses below the minimum width", () => {
    const spans = eraSpans([era("a", 0)], [], 10);
    expect(spans[0].end).toBe(MIN_ERA_WIDTH);
  });

  it("eras never start before the origin", () => {
    const beads = [bead("origin", 420, true)];
    const spans = eraSpans([era("a", 100)], beads, 1000);
    expect(spans[0].start).toBe(420);
  });
});

describe("eraAt", () => {
  it("finds the era covering a point and ignores the ends", () => {
    const spans = eraSpans([era("a", 0), era("b", 300)], [], 1000);
    expect(eraAt(spans, 10)?.era.id).toBe("a");
    expect(eraAt(spans, 300)?.era.id).toBe("b");
    expect(eraAt(spans, 1200)).toBeNull();
  });
});

describe("clampBoundary", () => {
  const beads = [bead("origin", 0, true)];
  it("keeps a gap from the neighbouring eras", () => {
    const eras = [era("a", 0), era("b", 300), era("c", 600)];
    expect(clampBoundary(eras, beads, "b", 650)).toBe(600 - MIN_ERA_WIDTH);
    expect(clampBoundary(eras, beads, "b", 10)).toBe(MIN_ERA_WIDTH);
    expect(clampBoundary(eras, beads, "b", 500)).toBe(500); // inside the room it has
    expect(clampBoundary(eras, beads, "c", 100)).toBe(300 + MIN_ERA_WIDTH); // never jumps left of a neighbour
  });
});

describe("clampBeadX", () => {
  it("keeps a boundary bead from crossing its neighbours", () => {
    const beads = [bead("origin", 0, true), bead("e1", 300), bead("e3", 900)];
    const eras = [era("a", 0), era("b", 300, "e1"), era("c", 900, "e3")];
    expect(clampBeadX(beads, eras, "e1", 950)).toBe(900 - MIN_ERA_WIDTH);
    expect(clampBeadX(beads, eras, "e3", 10)).toBe(300 + MIN_ERA_WIDTH);
  });

  it("keeps any bead to the right of the origin", () => {
    const beads = [bead("origin", 420, true), bead("e1", 600)];
    expect(clampBeadX(beads, [], "e1", 0)).toBe(420 + MIN_ERA_WIDTH);
  });
});

describe("contentEnd", () => {
  it("covers the rightmost content plus a pad", () => {
    const beads = [bead("origin", 420, true), bead("e1", 1580)];
    expect(contentEnd(beads, [era("a", 420)])).toBe(1580 + 160);
  });

  it("never goes before the origin", () => {
    expect(contentEnd([bead("origin", 420, true)], [])).toBeGreaterThan(420);
  });
});
