import { describe, expect, it } from "vitest";
import { buildCarveChild, unionBorderRing, detectCarveParent, regionNearestToPoint } from "./carve";

const parent = [
  { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 },
];

describe("buildCarveChild", () => {
  it("walks the border forward between entry and exit", () => {
    const entry = { point: { x: 0.5, y: 0 }, edgeIndex: 0, t: 0.5 };
    const exit = { point: { x: 1, y: 0.5 }, edgeIndex: 1, t: 0.5 };
    const child = buildCarveChild(parent, entry, exit, true, [{ x: 0.7, y: 0.25 }]);
    expect(child).toEqual([
      { x: 0.5, y: 0 }, { x: 0.7, y: 0.25 }, { x: 1, y: 0.5 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: 0, y: 0 },
    ]);
  });
  it("backward path picks the complementary border vertices", () => {
    const entry = { point: { x: 0.5, y: 0 }, edgeIndex: 0, t: 0.5 };
    const exit = { point: { x: 1, y: 0.5 }, edgeIndex: 1, t: 0.5 };
    const child = buildCarveChild(parent, entry, exit, false, []);
    expect(child).toEqual([{ x: 0.5, y: 0 }, { x: 1, y: 0.5 }, { x: 1, y: 0 }]);
  });
});

describe("unionBorderRing", () => {
  it("one square ring", () => {
    const { ring, ok } = unionBorderRing([parent]);
    expect(ok).toBe(true);
    expect(ring).toHaveLength(4);
  });

  it("two adjacent squares share an interior edge that disappears", () => {
    const a = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
    const b = [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 1 }, { x: 1, y: 1 }];
    const { ring, ok } = unionBorderRing([a, b]);
    expect(ok).toBe(true);
    expect(ring).toHaveLength(6);
  });
  it("corner-touch (degree-4) -> not ok", () => {
    const t1 = [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }];
    const t2 = [{ x: 1, y: 1 }, { x: 2, y: 4 }, { x: 0, y: 4 }];
    const { ok } = unionBorderRing([t1, t2]);
    expect(ok).toBe(false);
  });
  it("islands: multiple closed cycles -> not ok (handled by caller)", () => {
    const a = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
    const b = [{ x: 5, y: 5 }, { x: 6, y: 5 }, { x: 6, y: 6 }, { x: 5, y: 6 }];
    const { ok } = unionBorderRing([a, b]);
    expect(ok).toBe(false);
  });
});

describe("detectCarveParent / nearest", () => {
  const big = [{ id: "big", points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }] },
    { id: "small", points: [{ x: 8, y: 8 }, { x: 9, y: 8 }, { x: 9, y: 9 }, { x: 8, y: 9 }] }];
  it("smallest containing area wins", () => {
    expect(detectCarveParent({ x: 8.5, y: 8.5 }, big)).toBe("small");
    expect(detectCarveParent({ x: 1, y: 1 }, big)).toBe("big");
    expect(detectCarveParent({ x: 20, y: 20 }, big)).toBeNull();
  });
  it("nearest boundary fallback", () => {
    expect(regionNearestToPoint({ x: 10.1, y: 5 }, big)).toBe("big");
  });

});