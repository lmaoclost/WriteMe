import { useCallback, useEffect, useRef, useState } from "react";

export interface DebouncedDraft {
  draft: string;
  setDraft(v: string): void;
  flush(): void;
}

/** Debounced field editor extracted from EntryView: the local draft diverges
 *  from the outer value while typing and is committed once, after `delay` ms of
 *  silence (or immediately via flush, including on unmount). An outer value
 *  change resyncs the draft only while it is clean (not dirty). */
export function useDebouncedDraft(
  value: string,
  onCommit: (v: string) => void,
  delay = 300,
): DebouncedDraft {
  const [draft, setDraftState] = useState(value);
  const draftRef = useRef(value);
  const dirtyRef = useRef(false);
  const pendingCommitRef = useRef<((v: string) => void) | undefined>(undefined);
  const timerRef = useRef<number | undefined>(undefined);

  const clearTimer = () => {
    if (timerRef.current !== undefined) {
      window.clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
  };

  const flush = useCallback(() => {
    clearTimer();
    if (!dirtyRef.current) return;
    dirtyRef.current = false;
    const commit = pendingCommitRef.current;
    pendingCommitRef.current = undefined;
    commit?.(draftRef.current);
  }, []);

  const setDraft = useCallback((v: string) => {
    dirtyRef.current = true;
    draftRef.current = v;
    pendingCommitRef.current = onCommit;
    setDraftState(v);
    clearTimer();
    timerRef.current = window.setTimeout(flush, delay);
  }, [onCommit, delay, flush]);

  // Re-sync from the outer value only while the draft is clean; a dirty draft
  // keeps its typed content until it is committed.
  useEffect(() => {
    if (dirtyRef.current) return;
    draftRef.current = value;
    setDraftState(value);
  }, [value]);

  // A pending draft must survive the unmount (no lost keystroke).
  useEffect(() => () => flush(), [flush]);

  return { draft, setDraft, flush };
}
