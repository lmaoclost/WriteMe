import type { Pt } from "./geometry";
import { pointInPolygon, polygonArea, projectToBoundary } from "./geometry";

interface SnapRef { point: Pt; edgeIndex: number; t: number }

export function buildCarveChild(parentPts: Pt[], entry: SnapRef, exit: SnapRef, forward: boolean, middle: Pt[]): Pt[] {
  const n = parentPts.length;
  const i = entry.edgeIndex + entry.t;
  const o = exit.edgeIndex + exit.t;
  const child: Pt[] = [
    { x: entry.point.x, y: entry.point.y },
    ...middle.map(p => ({ x: p.x, y: p.y })),
    { x: exit.point.x, y: exit.point.y },
  ];
  const span = ((i - o) % n + n) % n;
  const picks: { k: number; key: number }[] = [];
  for (let u = 0; u < n; u++) {
    const f = forward ? ((u - o) % n + n) % n : ((o - u) % n + n) % n;
    const spanF = forward ? span : n - span;
    if (f > 1e-9 && f < spanF - 1e-9) picks.push({ k: u, key: f });
  }
  picks.sort((a, b) => a.key - b.key);
  for (const p of picks) child.push({ x: parentPts[p.k].x, y: parentPts[p.k].y });
  return child;
}

const key = (p: Pt) => `${Math.round(p.x / 1e-6)}_${Math.round(p.y / 1e-6)}`;
const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export function unionBorderRing(regions: Pt[][]): { ring: Pt[]; ok: boolean } {
  const edgeCount = new Map<string, number>();
  const vertexOf = new Map<string, Pt>();
  for (const pts of regions) {
    for (let k = 0; k < pts.length; k++) {
      const a = pts[k], b = pts[(k + 1) % pts.length];
      const ka = key(a), kb = key(b);
      if (ka === kb) continue;
      vertexOf.set(ka, a);
      vertexOf.set(kb, b);
      const pk = pairKey(ka, kb);
      edgeCount.set(pk, (edgeCount.get(pk) || 0) + 1);
    }
  }
  const adj = new Map<string, { to: string; pt: Pt }[]>();
  for (const [pk, count] of edgeCount) {
    if (count !== 1) continue;
    const [a, b] = pk.split("|");
    for (const [from, to] of [[a, b], [b, a]] as const) {
      const list = adj.get(from) ?? [];
      list.push({ to, pt: vertexOf.get(to)! });
      adj.set(from, list);
    }
  }
  const startKey = adj.keys().next().value;
  if (!startKey) return { ring: [], ok: false };
  const ring: Pt[] = [vertexOf.get(startKey)!];
  const walked = new Set<string>([startKey]);
  let cur = startKey;
  for (;;) {
    const next = (adj.get(cur) || []).find(e => !walked.has(e.to));
    if (!next) break;
    walked.add(next.to);
    ring.push(next.pt);
    cur = next.to;
  }
  if (walked.size !== adj.size) return { ring: [], ok: false };
  return { ring, ok: ring.length >= 3 };
}

export function detectCarveParent(pt: Pt, regions: { id: string; points: Pt[] }[]): string | null {
  const containing = regions
    .filter(r => r.points.length >= 3 && pointInPolygon(pt, r.points))
    .sort((a, b) => polygonArea(a.points) - polygonArea(b.points));
  return containing[0]?.id ?? null;
}

export function regionNearestToPoint(pt: Pt, regions: { id: string; points: Pt[] }[]): string | null {
  let best: { id: string; dist: number } | null = null;
  for (const r of regions) {
    if (r.points.length < 3) continue;
    const { dist } = projectToBoundary(pt, r.points);
    if (!best || dist < best.dist) best = { id: r.id, dist };
  }
  return best?.id ?? null;
}