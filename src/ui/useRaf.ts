import { useCallback, useEffect, useRef, useState } from "react";

export interface RafSetter<S> {
  (next: S | ((prev: S) => S)): void;
  /** Runs every pending update through setState now; cancels the frame. */
  flush(): void;
}

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
): [S, RafSetter<S>] {
  const [state, setState] = useState<S>(initial);
  const pendingRef = useRef<Array<(prev: S) => S>>([]);
  const rafRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
  }, []);

  const applyPending = useCallback(() => {
    const ups = pendingRef.current;
    pendingRef.current = [];
    if (ups.length === 0) return;
    setState((prev) => {
      let cur = prev;
      for (const up of ups) cur = up(cur);
      return cur;
    });
  }, []);

  const setter = useCallback(((next) => {
    pendingRef.current.push(
      typeof next === "function" ? (next as (prev: S) => S) : () => next,
    );
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      applyPending();
    });
  }) as RafSetter<S>, [applyPending]);

  setter.flush = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    applyPending();
  }, [applyPending]);

  return [state, setter];
}

export interface RafCaller<A extends unknown[]> {
  (...args: A): void;
  /**
   * Runs the freshest pending invocation immediately (and cancels the
   * scheduled frame). Call when the gesture ends so the final store write
   * cannot race an unmount cancel.
   */
  flush(): void;
}

/**
 * Callback coalesced to at most one invocation per animation frame; the
 * latest arguments win. For store writes like moveCard(id, x, y): a drag
 * burst calls moveCardRaf once per frame instead of once per event —
 * subscribers re-render at display rate with drag-end semantics intact.
 */
export function useRafCallback<A extends unknown[]>(
  fn: (...args: A) => void,
): RafCaller<A> {
  const pendingRef = useRef<A[]>([]);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const rafRef = useRef<number | null>(null);

  const flushUnsched = useCallback(() => {
    const batch = pendingRef.current;
    pendingRef.current = [];
    const last = batch[batch.length - 1];
    if (last) fnRef.current(...last);
  }, []);

  const caller = useCallback(((...args: A) => {
    pendingRef.current.push(args);
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      flushUnsched();
    });
  }) as RafCaller<A>, [flushUnsched]);

  caller.flush = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    flushUnsched();
  }, [flushUnsched]);

  useEffect(() => () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
  }, []);

  return caller;
}
