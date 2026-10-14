export interface Pt { x: number; y: number }

export function polygonArea(pts: Pt[]): number {
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    a += (pts[j].x + pts[i].x) * (pts[j].y - pts[i].y);
  }
  return Math.abs(a / 2);
}

export function isMeaningful(pts: Pt[]): boolean {
  return polygonArea(pts) > 1e-5;
}

export function pointInPolygon(pt: Pt, pts: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x, yi = pts[i].y, xj = pts[j].x, yj = pts[j].y;
    const intersect = yi > pt.y !== yj > pt.y && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function regionCentroid(pts: Pt[]): Pt {
  const n = pts.length;
  if (n < 3) {
    const s = pts.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    return { x: s.x / (n || 1), y: s.y / (n || 1) };
  }
  let cross = 0, cx = 0, cy = 0;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const f = pts[j].x * pts[i].y - pts[i].x * pts[j].y;
    cross += f;
    cx += (pts[j].x + pts[i].x) * f;
    cy += (pts[j].y + pts[i].y) * f;
  }
  if (Math.abs(cross) < 1e-9) {
    let sx = 0, sy = 0;
    for (const p of pts) { sx += p.x; sy += p.y; }
    return { x: sx / n, y: sy / n };
  }
  return { x: cx / (3 * cross), y: cy / (3 * cross) };
}

export function projectToBoundary(pt: Pt, pts: Pt[]): { dist: number; point: Pt; edgeIndex: number; t: number } {
  let best = { dist: Infinity, point: { x: 0, y: 0 }, edgeIndex: 0, t: 0 };
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / len2));
    const p = { x: a.x + t * dx, y: a.y + t * dy };
    const d = Math.hypot(pt.x - p.x, pt.y - p.y);
    if (d < best.dist) best = { dist: d, point: p, edgeIndex: i, t };
  }
  return best;
}

export interface SnapTarget { point: Pt; regionId: string }

export function snapToCarveBorder(
  pt: Pt,
  regions: { points: Pt[]; id: string }[],
  scale: number,
  opts?: { vertexPx?: number; edgePx?: number },
): SnapTarget | null {
  if (!scale) return null;
  const vertexPx = opts?.vertexPx ?? 14;
  const edgePx = opts?.edgePx ?? 8;
  const PX_PER_PCT = 100;
  let vertexHit: { dist: number; point: Pt; regionId: string } | null = null;
  let edgeHit: { dist: number; point: Pt; regionId: string; edgeIdx: number; t: number } | null = null;
  for (const r of regions) {
    if (r.points.length < 3) continue;
    for (const v of r.points) {
      const d = Math.hypot((pt.x - v.x), (pt.y - v.y)) * PX_PER_PCT * scale;
      if (d < (vertexHit?.dist ?? Infinity) && d <= vertexPx) vertexHit = { dist: d, point: { ...v }, regionId: r.id };
    }
    const p = projectToBoundary(pt, r.points);
    const d = p.dist * PX_PER_PCT * scale;
    if (d < (edgeHit?.dist ?? Infinity) && d <= edgePx) edgeHit = { dist: d, point: p.point, regionId: r.id, edgeIdx: p.edgeIndex, t: p.t };
  }
  if (vertexHit) return { point: vertexHit.point, regionId: vertexHit.regionId };
  if (edgeHit) return { point: edgeHit.point, regionId: edgeHit.regionId };
  return null;
}