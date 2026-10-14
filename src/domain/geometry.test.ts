import { describe, expect, it } from "vitest";
import {
  pointInPolygon, polygonArea, regionCentroid, projectToBoundary,
  snapToCarveBorder, isMeaningful,
} from "./geometry";

const square = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];

describe("polygonArea", () => {
  it("computes unit square = 1 and triangle = 0.5", () => {
    expect(polygonArea(square)).toBe(1);
    expect(polygonArea([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }])).toBe(0.5);
  });
});

describe("pointInPolygon", () => {
  it("inside/outside/boundary-adjacent", () => {
    expect(pointInPolygon({ x: 0.5, y: 0.5 }, square)).toBe(true);
    expect(pointInPolygon({ x: 1.5, y: 0.5 }, square)).toBe(false);
    expect(pointInPolygon({ x: 0.0001, y: 0.9999 }, square)).toBe(true);
  });
});

describe("regionCentroid", () => {
  it("square center", () => {
    const c = regionCentroid(square);
    expect(c.x).toBeCloseTo(0.5);
    expect(c.y).toBeCloseTo(0.5);
  });
  it("triangle centroid", () => {
    const c = regionCentroid([{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 2 }]);
    expect(c.x).toBeCloseTo(2 / 3);
    expect(c.y).toBeCloseTo(2 / 3);
  });
});

describe("projectToBoundary", () => {
  it("projects to nearest edge with edgeIndex", () => {
    const r = projectToBoundary({ x: 0.5, y: 1.4 }, square);
    expect(r.point).toEqual({ x: 0.5, y: 1 });
    expect(r.edgeIndex).toBe(2); // edge (1,1)->(0,1)
    expect(r.dist).toBeCloseTo(0.4);
  });
  it("snaps to nearest vertex region of the edge", () => {
    const r = projectToBoundary({ x: 1.3, y: 1.3 }, square);
    expect(r.point).toEqual({ x: 1, y: 1 });
  });
});

describe("snapToCarveBorder", () => {
  const regions = [{ id: "r1", points: square }];
  it("snaps to a near vertex when within vertexPx", () => {
    const s = snapToCarveBorder({ x: 0.04, y: 0.02 }, regions, 100);
    expect(s?.regionId).toBe("r1");
    expect(s?.point).toEqual({ x: 0, y: 0 });
  });
  it("snaps to edge projection when within edgePx", () => {
    const s = snapToCarveBorder({ x: 0.5, y: 1.04 }, regions, 100);
    expect(s?.point).toEqual({ x: 0.5, y: 1 });
  });
  it("returns null when far", () => {
    expect(snapToCarveBorder({ x: 0.5, y: 0.5 }, regions, 100)).toBeNull();
  });
});

describe("isMeaningful", () => {
  it("filters sub-threshold areas", () => {
    expect(isMeaningful(square)).toBe(true);
    expect(isMeaningful([{ x: 0, y: 0 }, { x: 1e-4, y: 0 }, { x: 0, y: 1e-4 }])).toBe(false);
  });
});
