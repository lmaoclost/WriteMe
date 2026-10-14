import polygonClipping from "polygon-clipping";
import type { Pt } from "../domain/geometry";
import { isMeaningful, polygonArea } from "../domain/geometry";

type Pair = [number, number];
type Ring = Pair[];

const { difference } = polygonClipping;

const toRing = (pts: Pt[]): Ring => {
  const r: Ring = pts.map((p): Pair => [p.x, p.y]);
  const f = r[0], l = r[r.length - 1];
  if (f[0] !== l[0] || f[1] !== l[1]) r.push([f[0], f[1]]);
  return r;
};

type Geom = number[][][][] | null;

const fromGeom = (geom: Geom): Pt[][] => {
  if (!geom) return [];
  return geom
    .map((poly) => poly[0].slice(0, -1).map(([x, y]) => ({ x, y })))
    .filter((pts) => pts.length >= 3 && isMeaningful(pts))
    .sort((a, b) => polygonArea(b) - polygonArea(a));
};

export function fitGap(drawn: Pt[], others: Pt[][]): Pt[] | null {
  if (drawn.length < 3) return null;
  const subject = difference([toRing(drawn)], ...others.map((o) => [toRing(o)]));
  const [best] = fromGeom(subject);
  return best ?? null;
}

export function claimRest(region: Pt[], others: Pt[] | Pt[][]): Pt[][] {
  if (region.length < 3) return [];
  const clips: Pt[][] = others.length === 0
    ? []
    : Array.isArray(others[0]) ? (others as Pt[][]) : [others as Pt[]];
  const subject = difference([toRing(region)], ...clips.map((o) => [toRing(o)]));
  return fromGeom(subject);
}