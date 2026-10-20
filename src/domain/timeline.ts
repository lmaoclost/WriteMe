import type { TimelineBead, TimelineEra } from "./types";

/** Boundaries never touch: a drag stops this far from its neighbour. */
export const MIN_ERA_WIDTH = 24;
export const CONTENT_PAD = 160;

export type EraSpan = { era: TimelineEra; start: number; end: number };

/** The fixed origin bead of a wire; a timeline without one has no start point. */
export const originOf = (beads: TimelineBead[]): TimelineBead | null =>
  beads.find((b) => b.origin) ?? null;

/** A boundary follows its bead; a bead-less or missing binding keeps the stored x. */
export function eraStart(era: TimelineEra, beads: TimelineBead[]): number {
  const bead = era.boundaryBeadId ? beads.find((b) => b.id === era.boundaryBeadId) : null;
  return bead ? bead.x : era.startX;
}

/** The wire right edge: rightmost content plus a pad, never left of the origin. */
export function contentEnd(beads: TimelineBead[], eras: TimelineEra[]): number {
  const origin = originOf(beads)?.x ?? 0;
  let max = origin;
  for (const b of beads) if (b.x > max) max = b.x;
  for (const e of eras) max = Math.max(max, eraStart(e, beads));
  return max + CONTENT_PAD;
}

/** Eras tile the wire: each ends where the next starts, first clamped to origin. */
export function eraSpans(eras: TimelineEra[], beads: TimelineBead[], end: number): EraSpan[] {
  const origin = originOf(beads)?.x ?? -Infinity;
  const ordered = [...eras]
    .map((era) => ({ era, start: Math.max(eraStart(era, beads), origin) }))
    .sort((a, b) => (a.start - b.start) || a.era.id.localeCompare(b.era.id));
  return ordered.map((cur, i) => ({
    era: cur.era,
    start: cur.start,
    end: i + 1 < ordered.length ? ordered[i + 1].start : Math.max(end, cur.start + MIN_ERA_WIDTH),
  }));
}

export const eraAt = (spans: EraSpan[], x: number): EraSpan | null =>
  spans.find((s) => x >= s.start && x < s.end) ?? null;

/** Draggable boundary x, clamped between the neighbouring eras (and the origin).
 *  Neighbours are read from the current position, so a drag never crosses one
 *  no matter which direction it points. */
export function clampBoundary(eras: TimelineEra[], beads: TimelineBead[], eraId: string, x: number): number {
  const origin = originOf(beads)?.x ?? 0;
  const me = eras.find((e) => e.id === eraId);
  const here = me ? eraStart(me, beads) : origin;
  let lo = origin + MIN_ERA_WIDTH;
  let hi = Infinity;
  for (const other of eras) {
    if (other.id === eraId) continue;
    const start = eraStart(other, beads);
    if (start < here) lo = Math.max(lo, start + MIN_ERA_WIDTH);
    else hi = Math.min(hi, start - MIN_ERA_WIDTH);
  }
  return Math.min(Math.max(x, lo), hi);
}

/** Bead x, clamped between the boundaries it sits between and the origin. */
export function clampBeadX(beads: TimelineBead[], eras: TimelineEra[], beadId: string, x: number): number {
  const me = beads.find((b) => b.id === beadId);
  const here = me?.x ?? x;
  const origin = originOf(beads)?.x ?? 0;
  let lo = me?.origin ? -Infinity : origin + MIN_ERA_WIDTH;
  let hi = Infinity;
  for (const era of eras) {
    if (!era.boundaryBeadId || era.boundaryBeadId === beadId) continue;
    const start = eraStart(era, beads);
    if (start < here) lo = Math.max(lo, start + MIN_ERA_WIDTH);
    else hi = Math.min(hi, start - MIN_ERA_WIDTH);
  }
  return Math.min(Math.max(x, lo), hi);
}
