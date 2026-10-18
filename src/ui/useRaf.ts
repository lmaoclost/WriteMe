import { useCallback, useEffect, useRef, useState } from "react";

/**
 * setState coalesced to at most one React commit per animation frame.
 *
 * Pointermove/wheel handlers fire faster than the display refreshes; writing
 * state on every event makes React render at event rate. Through this setter
 * several events land in one pending chain, and the frame callback applies
 * them in order — so a drag/zoom burst renders exactly once per frame.
 */
export function useRafState<S>(
  initial: S | (() => S),
): [S, (next: S | ((prev: S) => S)) => void] {
  const [state, setState] = useState<S>(initial);
  const pendingRef = useRef<Array<(prev: S) => S>>([]);
  const rafRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
  }, []);

  const schedule = useCallback((next: S | ((prev: S) => S)) => {
    pendingRef.current.push(
      typeof next === "function" ? (next as (prev: S) => S) : () => next,
    );
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const ups = pendingRef.current;
      pendingRef.current = [];
      setState((prev) => {
        let cur = prev;
        for (const up of ups) cur = up(cur);
        return cur;
      });
    });
  }, []);

  return [state, schedule];
}

/**
 * Callback coalesced to at most one invocation per animation frame; the
 * latest arguments win. For store writes like moveCard(id, x, y): a drag
 * burst calls moveCardRaf once per frame instead of once per event —
 * subscribers re-render at display rate with drag-end semantics intact.
 */
export function useRafCallback<A extends unknown[]>(
  fn: (...args: A) => void,
): (...args: A) => void {
  const pendingRef = useRef<A[]>([]);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const rafRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
  }, []);

  return useCallback((...args: A) => {
    pendingRef.current.push(args);
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const batch = pendingRef.current;
      pendingRef.current = [];
      const last = batch[batch.length - 1];
      if (last) fnRef.current(...last);
    });
  }, []);
}