import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useScriptorium } from "../data/store";

const registerSwMock = vi.hoisted(() => vi.fn());
vi.mock("virtual:pwa-register", () => ({ registerSW: registerSwMock }));

import { PwaUpdate } from "./pwaUpdate";

beforeEach(() => {
  useScriptorium.setState(useScriptorium.getInitialState());
  registerSwMock.mockClear();
});

describe("pwa update toast", () => {
  it("registers once on mount and offers a toast with a reload action", () => {
    render(<PwaUpdate />);
    expect(registerSwMock).toHaveBeenCalledTimes(1);
    const options = registerSwMock.mock.calls[0][0] as { onNeedRefresh: () => void };
    act(() => options.onNeedRefresh());
    expect(useScriptorium.getState().toasts.some((t) => t.message === "New version available.")).toBe(true);
    expect(useScriptorium.getState().toasts.find((t) => t.message === "New version available.")?.action?.label).toBe("Reload");
  });

  it("does not repeat the toast for repeated needRefresh pulses", () => {
    render(<PwaUpdate />);
    const options = registerSwMock.mock.calls[0][0] as { onNeedRefresh: () => void };
    act(() => { options.onNeedRefresh(); options.onNeedRefresh(); });
    expect(useScriptorium.getState().toasts.filter((t) => t.message === "New version available.")).toHaveLength(1);
  });
});
