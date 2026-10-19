import type { OathMember, OathLink } from "../domain/types";

/** tidyOathsChart: layered tree. Roots = members that are
 *  nobody's subordinate. Children spread horizontally under their superior.
 *  Positions are absolute canvas px and RECOMPUTED on every structural change —
 *  manual drag does not exist for oaths (the chart stays tidy). */
export function tidyOathsChart(
  members: OathMember[],
  links: OathLink[],
  opts?: { rootX?: number; rootY?: number; gapX?: number; levelH?: number },
): Map<string, { x: number; y: number }> {
  const rootX = opts?.rootX ?? 0;
  const rootY = opts?.rootY ?? 0;
  const gapX = opts?.gapX ?? 150;
  const levelH = opts?.levelH ?? 160;

  const pos = new Map<string, { x: number; y: number }>();
  const childrenOf = new Map<string, string[]>(); // superior -> subordinates in link order
  const isSub = new Set<string>();
  for (const l of links) {
    const list = childrenOf.get(l.superiorId) ?? [];
    list.push(l.subordinateId);
    childrenOf.set(l.superiorId, list);
    isSub.add(l.subordinateId);
  }

  const roots = members
    .filter((m) => !isSub.has(m.id))
    .map((m) => m.id);
  if (roots.length === 0 && members.length > 0) roots.push(members[0].id); // cycle fallback

  // x-allocator: leaves consume leaf slots; parents center over children
  let nextLeafX = rootX;
  const widths = new Map<string, number>();

  const place = (id: string, depth: number): { min: number; max: number } => {
    const kids = childrenOf.get(id) ?? [];
    const y = rootY + depth * levelH;
    if (kids.length === 0) {
      const x = nextLeafX + gapX / 2;
      nextLeafX += gapX;
      pos.set(id, { x, y });
      widths.set(id, gapX);
      return { min: x - gapX / 2, max: x + gapX / 2 };
    }
    // cycle guard: mark BEFORE descending so revisits bail out
    pos.set(id, { x: nextLeafX, y });
    let min = Infinity;
    let max = -Infinity;
    for (const kid of kids) {
      if (pos.has(kid)) continue; // cycle guard
      const r = place(kid, depth + 1);
      min = Math.min(min, r.min);
      max = Math.max(max, r.max);
    }
    if (!Number.isFinite(min)) {
      const x = nextLeafX + gapX / 2;
      nextLeafX += gapX;
      pos.set(id, { x, y });
      return { min: x - gapX / 2, max: x + gapX / 2 };
    }
    const x = (min + max) / 2;
    pos.set(id, { x, y });
    return { min, max };
  };

  for (const root of roots) {
    if (pos.has(root)) continue;
    place(root, 0);
  }

  // orphans (members unreachable from any root — keep below chart)
  let orphanY = rootY;
  for (const m of members) {
    if (!pos.has(m.id)) {
      pos.set(m.id, { x: nextLeafX + gapX / 2, y: orphanY });
      nextLeafX += gapX;
    }
    orphanY = Math.max(orphanY, pos.get(m.id)?.y ?? 0);
  }
  return pos;
}
