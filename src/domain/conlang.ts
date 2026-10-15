/** Freehand strokes → smoothed SVG polyline path (legacy "strokes smooth themselves"). */

export interface Pt { x: number; y: number }

/** Drop points closer than `minDist` to the previous kept point. */
export function simplify(points: Pt[], minDist = 3): Pt[] {
  const out: Pt[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) >= minDist) out.push(p);
  }
  return out;
}

/** Quadratic midpoint smoothing: M p0, Q mid(p0,p1) ... L pn. */
export function pathFrom(points: Pt[]): string {
  const pts = simplify(points);
  if (pts.length === 0) return "";
  if (pts.length === 1) {
    const p = pts[0];
    return `M ${r2(p.x)} ${r2(p.y)} l 0.01 0`;
  }
  let d = `M ${r2(pts[0].x)} ${r2(pts[0].y)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mid = { x: (pts[i].x + pts[i + 1].x) / 2, y: (pts[i].y + pts[i + 1].y) / 2 };
    d += ` Q ${r2(pts[i].x)} ${r2(pts[i].y)} ${r2(mid.x)} ${r2(mid.y)}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${r2(last.x)} ${r2(last.y)}`;
  return d;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Compose alphabet sheet SVG string (glyphs on a grid with char labels). */
export function alphabetSheetSvg(
  glyphs: { char: string; svgPath: string }[],
  opts?: { cell?: number; cols?: number },
): string {
  const cell = opts?.cell ?? 160;
  const cols = opts?.cols ?? 6;
  const rows = Math.max(1, Math.ceil(glyphs.length / cols));
  const w = cols * cell;
  const h = rows * cell;
  const parts = glyphs.map((g, i) => {
    const x = (i % cols) * cell;
    const y = Math.floor(i / cols) * cell;
    return `<g><rect x="${x + 4}" y="${y + 4}" width="${cell - 8}" height="${cell - 8}" rx="8" fill="#12121e" stroke="#2a2a44"/><text x="${x + 14}" y="${y + 28}" fill="#7a7a99" font-size="16" font-family="monospace">${g.char}</text><path d="${g.svgPath}" fill="none" stroke="#e8dcc3" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></g>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#12121e"/>${parts.join("")}</svg>`;
}