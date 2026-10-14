import { describe, expect, it } from "vitest";
import { newId } from "./id";

describe("newId", () => {
  it("returns prefix followed by base36 time and random", () => {
    const id = newId("pin");
    expect(id).toMatch(/^pin_[a-z0-9]+_[a-z0-9]{6}$/);
  });
  it("returns distinct ids within the same millisecond-ish", () => {
    const ids = new Set(Array.from({ length: 200 }, () => newId("reg")));
    expect(ids.size).toBe(200);
  });
});