import { describe, expect, it } from "vitest";
import { simplify, pathFrom, alphabetSheetSvg } from "../domain/conlang";

describe("freehand strokes", () => {
  it("simplify drops points within minDist", () => {
    const pts = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 10, y: 0 }];
    expect(simplify(pts, 3)).toEqual([{ x: 0, y: 0 }, { x: 10, y: 0 }]);
  });
  it("pathFrom smooths into Q curves and ends with L", () => {
    const d = pathFrom([{ x: 0, y: 0 }, { x: 20, y: 10 }, { x: 40, y: 0 }, { x: 60, y: 10 }]);
    expect(d.startsWith("M")).toBe(true);
    expect(d).toContain(" Q ");
    expect(d).toMatch(/ L \d+(\.\d+)? \d+(\.\d+)?$/);
  });
  it("single point becomes a tiny move", () => {
    expect(pathFrom([{ x: 5, y: 5 }])).toContain("l 0.01 0");
  });
  it("empty path", () => {
    expect(pathFrom([])).toBe("");
  });
});

describe("alphabetSheetSvg", () => {
  it("grid dims follow cols", () => {
    const svg = alphabetSheetSvg([
      { char: "A", svgPath: "M 10 10 L 50 50" },
      { char: "B", svgPath: "M 10 50 L 50 10" },
      { char: "C", svgPath: "" },
    ], { cell: 100, cols: 2 });
    expect(svg).toContain('width="200"');
    expect(svg).toContain('height="200"');
    expect(svg).toContain(">A</text>");
  });
});
