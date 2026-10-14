import { describe, expect, it } from "vitest";
import { pickTargetSize, shouldKeepPng } from "./image";

describe("pickTargetSize", () => {
  it("keeps size when under cap", () => {
    expect(pickTargetSize(800, 600)).toEqual({ w: 800, h: 600, factor: 1 });
  });
  it("scales landscape to cap", () => {
    const r = pickTargetSize(4096, 2048);
    expect(r).toEqual({ w: 2048, h: 1024, factor: 2048 / 4096 });
  });
  it("scales portrait to cap", () => {
    const r = pickTargetSize(1000, 3000);
    expect(r).toEqual({ w: 683, h: 2048, factor: 2048 / 3000 });
  });
  it("rounds up to at least 1px", () => {
    const r = pickTargetSize(1_000_000, 2_000_000);
    expect(r.w >= 1 && r.h >= 1).toBe(true);
  });
});

describe("shouldKeepPng", () => {
  it("keeps png with alpha", () => {
    expect(shouldKeepPng("image/png", true)).toBe(true);
  });
  it("downgrades opaque png to jpg", () => {
    expect(shouldKeepPng("image/png", false)).toBe(false);
  });
  it("keeps transparent-capable webp as png", () => {
    expect(shouldKeepPng("image/webp", true)).toBe(true);
  });
  it("jpeg never becomes png", () => {
    expect(shouldKeepPng("image/jpeg", true)).toBe(false);
  });
});
