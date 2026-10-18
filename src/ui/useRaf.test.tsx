import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { useRafState, useRafCallback } from "./useRaf";

let frameQueue: FrameRequestCallback[] = [];

beforeEach(() => {
  frameQueue = [];
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback): number => {
    frameQueue.push(cb);
    return frameQueue.length;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const fireFrames = () =>
  act(() => {
    let guard = 0;
    while (frameQueue.length > 0 && guard < 10) {
      const cbs = [...frameQueue];
      frameQueue = [];
      guard++;
      for (const cb of cbs) cb(performance.now());
    }
  });

describe("useRafState", () => {
  it("does not commit until a frame fires; the latest absolute value wins", () => {
    let set: (v: number) => void = () => {};
    function Harness(): ReactNode {
      const [x, setX] = useRafState(0);
      set = setX;
      return <div data-testid="out">{String(x)}</div>;
    }
    render(<Harness />);
    act(() => { set(1); set(2); set(3); });
    expect(screen.getByTestId("out")).toHaveTextContent("0");
    fireFrames();
    expect(screen.getByTestId("out")).toHaveTextContent("3");
    act(() => { set(9); });
    fireFrames();
    expect(screen.getByTestId("out")).toHaveTextContent("9");
  });

  it("chains functional updates issued within the same frame", () => {
    let set: (v: number | ((p: number) => number)) => void = () => {};
    function Harness(): ReactNode {
      const [x, setX] = useRafState(10);
      set = setX;
      return <div data-testid="out">{String(x)}</div>;
    }
    render(<Harness />);
    act(() => { set((p) => p + 1); set((p) => p + 10); });
    expect(screen.getByTestId("out")).toHaveTextContent("10");
    fireFrames();
    expect(screen.getByTestId("out")).toHaveTextContent("21");
  });
});

describe("useRafCallback", () => {
  it("runs at most once per frame with the latest arguments", () => {
    const seen: number[] = [];
    let fire: (v: number) => void = () => {};
    function Harness(): ReactNode {
      const fireRaf = useRafCallback((v: number) => { seen.push(v); });
      fire = fireRaf;
      return null;
    }
    render(<Harness />);
    act(() => { fire(1); fire(2); fire(3); });
    expect(seen).toEqual([]);
    fireFrames();
    expect(seen).toEqual([3]);
    fireFrames(); // nothing pending: no extra run
    expect(seen).toEqual([3]);
    act(() => { fire(4); });
    fireFrames();
    expect(seen).toEqual([3, 4]);
  });
});