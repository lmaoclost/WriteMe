import { describe, expect, it } from "vitest";
import { fitGap, claimRest } from "./clip";
import type { Pt } from "../domain/geometry";

const frame: Pt[] = [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }];
const existing: Pt[] = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];

describe("fitGap", () => {
  it("drawn region fits into the uncovered gap", () => {
    const g = fitGap(frame, [existing]);
    expect(g).not.toBeNull();
    expect(Math.abs(area(g!)) - 3).toBeLessThan(0.01);
  });
  it("fully covered -> null", () => {
    const half = [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }];
    expect(fitGap(half, [half])).toBeNull();
  });
});

describe("claimRest", () => {
  it("claims the remaining area as 1 polygon", () => {
    const rest = claimRest(existing, [ { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }, { x: 1, y: 2 }]);
    expect(rest).toHaveLength(1);
    expect(area(rest[0])).toBeCloseTo(1);
  });
});

function area(p: Pt[]): number {
  let a = 0;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j].x + p[i].x) * (p[j].y - p[i].y);
  return Math.abs(a / 2);
}