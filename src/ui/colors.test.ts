import { describe, expect, it } from "vitest";
import { withCurrentColor } from "./colors";

describe("withCurrentColor", () => {
  it("returns presets untouched when current is included", () => {
    expect(withCurrentColor(["#aaa", "#bbb"], "#aaa")).toEqual(["#aaa", "#bbb"]);
  });
  it("appends the current color when it is not a preset", () => {
    expect(withCurrentColor(["#aaa"], "#c9a227")).toEqual(["#aaa", "#c9a227"]);
  });
  it("handles undefined current", () => {
    expect(withCurrentColor(["#aaa"], undefined)).toEqual(["#aaa"]);
  });
});
