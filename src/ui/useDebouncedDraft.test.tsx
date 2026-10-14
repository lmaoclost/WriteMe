import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDebouncedDraft } from "./useDebouncedDraft";

afterEach(() => {
  vi.useRealTimers();
});

describe("useDebouncedDraft", () => {
  it("starts the draft at value", () => {
    const { result } = renderHook(() => useDebouncedDraft("Aldric", vi.fn()));
    expect(result.current.draft).toBe("Aldric");
  });

  it("typing sets the draft without committing before the delay", () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() => useDebouncedDraft("Aldric", onCommit, 300));
    act(() => { result.current.setDraft("Aldric II"); });
    expect(result.current.draft).toBe("Aldric II");
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("commits once after the delay", () => {
    vi.useFakeTimers();
    const onCommit = vi.fn();
    const { result } = renderHook(() => useDebouncedDraft("Aldric", onCommit, 300));
    act(() => { result.current.setDraft("Aldric II"); });
    act(() => { vi.advanceTimersByTime(299); });
    expect(onCommit).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith("Aldric II");
  });

  it("commits once for a burst of typing (single timer)", () => {
    vi.useFakeTimers();
    const onCommit = vi.fn();
    const { result } = renderHook(() => useDebouncedDraft("", onCommit, 300));
    act(() => {
      result.current.setDraft("a");
      result.current.setDraft("ab");
      result.current.setDraft("abc");
    });
    act(() => { vi.advanceTimersByTime(300); });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith("abc");
  });

  it("resyncs the draft when the outer value changes and the draft is clean", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedDraft(value, vi.fn()),
      { initialProps: { value: "Rio Sarnen" } },
    );
    rerender({ value: "Outro título" });
    expect(result.current.draft).toBe("Outro título");
  });

  it("does NOT clobber a dirty draft when the outer value changes", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedDraft(value, vi.fn()),
      { initialProps: { value: "Rio Sarnen" } },
    );
    act(() => { result.current.setDraft("Rascunho em curso"); });
    rerender({ value: "Rio Sarnen mudou" });
    expect(result.current.draft).toBe("Rascunho em curso");
  });

  it("commits the draft that was typed even when the outer value changed meanwhile", () => {
    vi.useFakeTimers();
    const onCommit = vi.fn();
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedDraft(value, onCommit),
      { initialProps: { value: "Velho" } },
    );
    act(() => { result.current.setDraft("Rascunho em curso"); });
    rerender({ value: "Novo" });
    act(() => { vi.advanceTimersByTime(300); });
    expect(onCommit).toHaveBeenCalledWith("Rascunho em curso");
  });

  it("flush commits now, clears the timer and does not double-commit", () => {
    vi.useFakeTimers();
    const onCommit = vi.fn();
    const { result } = renderHook(() => useDebouncedDraft("Aldric", onCommit, 300));
    act(() => { result.current.setDraft("Aldric II"); });
    act(() => { result.current.flush(); });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith("Aldric II");
    act(() => { vi.advanceTimersByTime(1000); });
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it("flush is a no-op when nothing is pending", () => {
    vi.useFakeTimers();
    const onCommit = vi.fn();
    const { result } = renderHook(() => useDebouncedDraft("Aldric", onCommit, 300));
    act(() => { result.current.flush(); });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("flushes the pending draft on unmount", () => {
    vi.useFakeTimers();
    const onCommit = vi.fn();
    const { result, unmount } = renderHook(() => useDebouncedDraft("Aldric", onCommit, 300));
    act(() => { result.current.setDraft("Rascunho perdido?"); });
    unmount();
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith("Rascunho perdido?");
  });

  it("does not commit on unmount when nothing is pending", () => {
    const onCommit = vi.fn();
    const { unmount } = renderHook(() => useDebouncedDraft("Aldric", onCommit, 300));
    unmount();
    expect(onCommit).not.toHaveBeenCalled();
  });
});
