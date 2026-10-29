import type { Chapter, Manuscript, Part, Scene } from "./types";
import { newId } from "./id";

/** Pure manuscript planning rules: scene normalization, drag-and-drop move
 *  plans, part ordering. No store access — the store's actions wrap these. */

export interface ChapterMove { chapterId: string; toPartId: string | undefined; toIndex: number }

/** Mint a fresh scene (order set by the caller's plan). */
export function createScene(content: string): Scene {
  return { id: newId("sc"), content, order: 0 };
}

/** A chapter always carries at least one scene. Legacy chapters (pre-scenes,
 *  a plain `content` body) normalize to one scene holding that body; the
 *  legacy key itself is dropped so no snapshot keeps a second source of truth. */
export function normalizeManuscripts(manuscripts: Manuscript[]): Manuscript[] {
  return manuscripts.map((m) => ({
    ...m,
    chapters: m.chapters.map(normalizeChapter),
  }));
}

function normalizeChapter(chapter: Chapter): Chapter {
  const legacy = chapter as Chapter & { content?: string; scenes?: unknown };
  let scenes: Scene[];
  if (Array.isArray(legacy.scenes) && legacy.scenes.length > 0) {
    scenes = legacy.scenes
      .filter((s): s is Scene => !!s && typeof s === "object" && typeof (s as Scene).content === "string")
      .map((s, i) => ({ id: s.id, content: s.content, order: i }));
    if (scenes.length === 0) scenes = [createScene("")];
  } else if (typeof legacy.content === "string") {
    scenes = [createScene(legacy.content)];
  } else {
    scenes = [createScene("")];
  }
  const { content: _content, ...rest } = legacy;
  void _content;
  return { ...rest, scenes };
}

/** The print plan as flat runs: the ungrouped run first, then one run per
 *  part (parts by order) — the same grouping bookSections renders, with a
 *  chapter whose partId names a missing part counting as ungrouped. */
function orderedRuns(chapters: readonly Chapter[], parts: readonly Part[]): { partId: string | undefined; chapters: Chapter[] }[] {
  const sorted = [...chapters].sort((a, b) => a.order - b.order);
  const partIds = new Set(parts.map((p) => p.id));
  const ungrouped = sorted.filter((c) => !c.partId || !partIds.has(c.partId));
  const byPart = (id: string) => sorted.filter((c) => c.partId === id);
  return [
    { partId: undefined, chapters: ungrouped },
    ...[...parts].sort((a, b) => a.order - b.order).map((p) => ({ partId: p.id, chapters: byPart(p.id) })),
  ];
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Relayout helper: rebuild the whole book from runs, renumbering orders
 *  0..n-1 across the plan so order mirrors print position exactly. */
function rebroadcast(runs: { partId: string | undefined; chapters: Chapter[] }[]): Chapter[] {
  const out: Chapter[] = [];
  let n = 0;
  for (const run of runs) {
    for (const c of run.chapters) {
      out.push({ ...c, partId: run.partId, order: n });
      n += 1;
    }
  }
  return out;
}

/** Insertion-index move of a chapter into a part (ungrouped when partId is
 *  omitted). The whole plan renumbers, so no stale gap survives a drag. */
export function moveChapterInPlan(
  chapters: readonly Chapter[],
  parts: readonly Part[],
  chapterId: string,
  toPartId: string | undefined,
  toIndex: number,
): Chapter[] {
  const sorted = [...chapters].sort((a, b) => a.order - b.order);
  const moving = sorted.find((c) => c.id === chapterId);
  if (!moving) return chapters as Chapter[];
  const rest = sorted.filter((c) => c.id !== chapterId);
  const runs = orderedRuns(rest, parts);
  const runIndex = runs.findIndex((r) => r.partId === toPartId);
  const target = runs[runIndex] ?? runs[0];
  const idx = clamp(toIndex, 0, target.chapters.length);
  target.chapters = [
    ...target.chapters.slice(0, idx),
    { ...moving, partId: toPartId },
    ...target.chapters.slice(idx),
  ];
  return rebroadcast(runs);
}

/** Splice a part at its new position among the sorted parts (1-based orders,
 *  as parts start at 1). */
export function reorderPartsTo(parts: readonly Part[], partId: string, toIndex: number): Part[] {
  const sorted = [...parts].sort((a, b) => a.order - b.order);
  const from = sorted.findIndex((p) => p.id === partId);
  if (from < 0) return parts as Part[];
  const [moving] = sorted.splice(from, 1);
  sorted.splice(clamp(toIndex, 0, sorted.length), 0, moving);
  return sorted.map((p, i) => ({ ...p, order: i + 1 }));
}

/** Move (and possibly renumber) a scene inside its chapter or across
 *  chapters; a chapter can never lose its last scene, so draining a
 *  single-scene chapter is a no-op. */
export function moveSceneInPlan(
  chapters: readonly Chapter[],
  sceneId: string,
  toChapterId: string,
  toIndex: number,
): Chapter[] {
  const source = chapters.find((c) => c.scenes.some((s) => s.id === sceneId));
  if (!source) return chapters as Chapter[];
  const moving = source.scenes.find((s) => s.id === sceneId)!;
  if (source.scenes.length === 1) return chapters as Chapter[];

  const target = chapters.find((c) => c.id === toChapterId);
  if (!target) return chapters as Chapter[];
  if (target.id !== source.id) {
    return chapters.map((c) => {
      if (c.id === source.id) {
        return { ...c, scenes: renumber(c.scenes.filter((s) => s.id !== sceneId)) };
      }
      if (c.id === target.id) {
        const idx = clamp(toIndex, 0, c.scenes.length);
        return { ...c, scenes: renumber([...c.scenes.slice(0, idx), moving, ...c.scenes.slice(idx)]) };
      }
      return c;
    });
  }
  const same = renumber(source.scenes.filter((s) => s.id !== sceneId));
  const idx = clamp(toIndex, 0, same.length);
  return chapters.map((c) => (
    c.id !== source.id
      ? c
      : { ...c, scenes: [...same.slice(0, idx), moving, ...same.slice(idx)].map((s, i) => ({ ...s, order: i })) }
  ));
}

const renumber = (scenes: readonly Scene[]): Scene[] => scenes.map((s, i) => ({ ...s, order: i }));

/** Delete a scene, refusing when the chapter would go below one scene; a
 *  refusal (or unknown id) hands back the same chapters reference so the
 *  store can detect the no-op. */
export function deleteSceneInChapters(chapters: readonly Chapter[], sceneId: string): Chapter[] {
  const source = chapters.find((c) => c.scenes.some((s) => s.id === sceneId));
  if (!source || source.scenes.length === 1) return chapters as Chapter[];
  return chapters.map((c) => (
    c.id !== source.id
      ? c
      : { ...c, scenes: renumber(c.scenes.filter((s) => s.id !== sceneId)) }
  ));
}
