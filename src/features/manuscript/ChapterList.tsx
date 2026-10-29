import { memo, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  DndContext, KeyboardCode, KeyboardCoordinateGetter, KeyboardSensor,
  MeasuringStrategy, PointerSensor, closestCenter, closestCorners,
  getFirstCollision, useDndContext, useDroppable, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Chapter, Part, Scene } from "../../domain/types";
import type { bookSections } from "./buildBook";
import { useScriptorium } from "../../data/store";
import { useDebouncedDraft } from "../../ui/useDebouncedDraft";
import { countWords, formatWords } from "./words";
import { Button } from "../../ui/Button";

const CONFIRM_RESET_MS = 3000;

/** Droppable id of the "no part" run (chapters without a part). */
const UNGROUPED_ZONE = "zone-ungrouped";

type RowKind = "part" | "chapter" | "scene" | "zone";

/** Row ids are the store's own prefixed ids (pt_/ch_/sc_); the zone is a
 *  sentinel. Drag semantics resolve on these kinds. */
function kindOf(id: unknown): RowKind | null {
  const s = String(id);
  if (s === UNGROUPED_ZONE) return "zone";
  if (s.startsWith("pt_")) return "part";
  if (s.startsWith("ch_")) return "chapter";
  if (s.startsWith("sc_")) return "scene";
  return null;
}

export interface ChapterListProps {
  /** Print-order plan from bookSections: ungrouped run first, then one
   *  block per part. Same grouping the book prints, so the panel and the
   *  exported book can never disagree. */
  sections: ReturnType<typeof bookSections>;
  selectedId: string | null;
  onSelect(id: string): void;
  /** Sidebar click on a scene: the editor scrolls to it. */
  onSceneSelect(sceneId: string): void;
  onCreate(): void;
  onCreatePart(): void;
}

/** Word counts cached per chapter id: any scene commit (debounced while
 *  typing) recreates the chapters array and would otherwise re-run
 *  DOMParser + regex over every scene body on the next render. */
interface WordCacheEntry { content: string; words: number }

function buildWordCounts(chapters: Chapter[], cache: Map<string, WordCacheEntry>): Map<string, WordCacheEntry> {
  const next = new Map<string, WordCacheEntry>();
  for (const c of chapters) {
    const key = JSON.stringify(c.scenes.map((s) => s.content));
    const prev = cache.get(c.id);
    if (prev && prev.content === key) {
      next.set(c.id, prev);
    } else {
      next.set(c.id, { content: key, words: c.scenes.reduce((n, s) => n + countWords(s.content), 0) });
    }
  }
  return next;
}

const DRAG_CLASS = "shrink-0 self-center cursor-grab touch-none bg-none border border-line rounded-lg text-parchment-dim text-xs leading-none hover:border-gold-dim hover:text-gold active:cursor-grabbing";
const GRIP = <span aria-hidden="true" className="px-1.5 py-1.5 text-[11px] leading-none">⠿</span>;

/** Keyboard drag steps follow the tree: a chapter never parks inside its own
 *  subtree (its scene rows are skipped from its candidates), parts step
 *  among parts, a scene may cross chapters. Return coordinates = the target
 *  row's center; the collision layer resolves the `over` from them. */
const rowKindAllowed: Record<"part" | "chapter" | "scene", RowKind[]> = {
  part: ["part"],
  chapter: ["chapter", "part"],
  scene: ["scene", "chapter"],
};

const treeKeyboardCoordinates: KeyboardCoordinateGetter = (event, args) => {
  const { code } = event;
  const { context: { active, collisionRect, droppableRects, droppableContainers } } = args;
  if (code !== KeyboardCode.Down && code !== KeyboardCode.Up) return;
  if (!active || !collisionRect) return;
  const kindActive = kindOf(active.id);
  if (!kindActive) return;
  const allowed = new Set(rowKindAllowed[kindActive as "part" | "chapter" | "scene"]);
  const candidates = droppableContainers.getEnabled().filter((entry) => {
    if (entry.disabled) return false;
    if (entry.id === active.id) return false;
    if (!allowed.has(kindOf(entry.id) as RowKind)) return false;
    const rect = droppableRects.get(entry.id);
    if (!rect) return false;
    return code === KeyboardCode.Down
      ? collisionRect.top < rect.top
      : collisionRect.top > rect.top;
  });
  const collisions = closestCorners({
    active,
    collisionRect,
    droppableRects,
    droppableContainers: candidates,
    pointerCoordinates: null,
  });
  const closest = getFirstCollision(collisions, "id");
  if (closest == null || closest === active.id) return;
  const rect = droppableRects.get(closest);
  if (!rect) return;
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
};

const PartRow = memo(function PartRow({ part, chapters, words, selected, onSelect, onSceneSelect }: {
  part: Part;
  chapters: Chapter[];
  words: number;
  selected: string | null;
  onSelect(id: string): void;
  onSceneSelect(sceneId: string): void;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [armed, setArmed] = useState(false);
  const [open, setOpen] = useState(true);
  const confirmTimerRef = useRef<number | undefined>(undefined);
  const draft = useDebouncedDraft(part.title, (v) => {
    useScriptorium.getState().renamePart(part.id, v);
  });
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: part.id });
  // the sortable registration already exposes this row as a drop target for
  // chapters; isOver only drives the highlight
  const isOver = useDndContext().over?.id === part.id;

  const confirmOrDelete = () => {
    if (armed) {
      setArmed(false);
      window.clearTimeout(confirmTimerRef.current);
      useScriptorium.getState().removePart(part.id);
      return;
    }
    setArmed(true);
    confirmTimerRef.current = window.setTimeout(() => setArmed(false), CONFIRM_RESET_MS);
  };

  return (
    <li
      ref={setNodeRef}
      className="book-part-row"
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <div
        className="flex items-stretch gap-1 rounded-lg ring-gold"
        data-dragging={isDragging ? "true" : undefined}
        data-over={isOver ? "true" : undefined}
      >
        <button
          ref={setActivatorNodeRef}
          type="button"
          className={DRAG_CLASS}
          aria-label={t("manuscript.dragPart")}
          data-testid={`drag-part-${part.id}`}
          {...attributes}
          {...listeners}
        >
          {GRIP}
        </button>
        <button
          type="button"
          className="flex-1 min-w-0 flex items-center gap-1.5 px-2 py-1.5 text-left bg-none border-0 rounded-lg hover:bg-night-2 cursor-pointer"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span aria-hidden="true" className="text-[10px] text-slate w-2">{open ? "▾" : "▸"}</span>
          {editing ? (
            <input
              type="text"
              autoFocus
              aria-label={t("manuscript.partTitle")}
              className="w-full min-w-0 bg-ink border border-line rounded-lg px-1.5 py-0.5 text-xs text-parchment outline-none focus:border-gold"
              value={draft.draft}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => draft.setDraft(e.target.value)}
              onBlur={() => { draft.flush(); setEditing(false); }}
            />
          ) : (
            <span className="book-part-title overflow-hidden text-ellipsis whitespace-nowrap text-xs font-semibold text-parchment-dim">{part.title}</span>
          )}
          <span data-testid={`part-words-${part.title}`} className="ml-auto shrink-0 text-[11px] text-slate [font-variant-numeric:tabular-nums]">{formatWords(words)}</span>
        </button>
        <button
          type="button"
          className="w-[26px] self-center bg-none border border-line rounded-lg text-parchment-dim text-xs leading-none hover:border-gold-dim hover:text-gold"
          aria-label={t("manuscript.renamePart")}
          onClick={() => setEditing(true)}
        >
          ✎
        </button>
        <button
          type="button"
          className={"book-delete w-7 bg-none border border-[var(--ember)] text-[var(--ember)] rounded-lg py-1 px-1 text-[11px] hover:bg-[color-mix(in_srgb,var(--ember)_18%,transparent)]" + (armed ? " armed bg-[color-mix(in_srgb,var(--ember)_20%,transparent)]" : "")}
          aria-label={armed ? undefined : t("manuscript.deletePart")}
          onClick={confirmOrDelete}
        >
          {armed ? t("manuscript.confirm") : "×"}
        </button>
      </div>
      {open ? (
        <ul className="list-none m-0 pl-4 flex flex-col gap-0.5" aria-label={t("manuscript.chaptersInPart", { part: part.title })}>
          <SortableContext items={chapters.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            {chapters.map((chapter) => (
              <ChapterRow
                key={chapter.id}
                chapter={chapter}
                selected={chapter.id === selected}
                onSelect={onSelect}
                onSceneSelect={onSceneSelect}
              />
            ))}
          </SortableContext>
        </ul>
      ) : null}
    </li>
  );
});

const SceneRow = memo(function SceneRow({ scene, index, chapterId, onSceneSelect }: {
  scene: Scene;
  index: number;
  chapterId: string;
  onSceneSelect(sceneId: string): void;
}) {
  const { t } = useTranslation();
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: scene.id });
  const words = useMemo(() => countWords(scene.content), [scene.content]);
  return (
    <li
      ref={setNodeRef}
      className={"book-scene-row flex items-stretch gap-1" + (isDragging ? " opacity-40" : "")}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        className={DRAG_CLASS}
        aria-label={t("manuscript.dragScene", { n: index + 1 })}
        data-testid={`drag-scene-${scene.id}`}
        data-chapter-id={chapterId}
        {...attributes}
        {...listeners}
      >
        {GRIP}
      </button>
      <button
        type="button"
        className="flex-1 min-w-0 flex items-center justify-between gap-1.5 text-left bg-none border-0 rounded-lg text-parchment px-2 py-1 text-xs"
        aria-label={t("manuscript.sceneAria", { n: index + 1 })}
        onClick={() => onSceneSelect(scene.id)}
      >
        <span className="book-scene-name overflow-hidden text-ellipsis whitespace-nowrap text-slate">{t("manuscript.sceneAria", { n: index + 1 })}</span>
        <span className="shrink-0 text-[11px] text-slate [font-variant-numeric:tabular-nums]">{formatWords(words)}</span>
      </button>
    </li>
  );
});

const ChapterRow = memo(function ChapterRow({ chapter, selected, onSelect, onSceneSelect }: {
  chapter: Chapter;
  selected: boolean;
  onSelect(id: string): void;
  onSceneSelect(sceneId: string): void;
}) {
  const { t } = useTranslation();
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: chapter.id });
  const words = useMemo(() => chapter.scenes.reduce((n, s) => n + countWords(s.content), 0), [chapter.scenes]);
  const sceneIds = chapter.scenes.map((s) => s.id);

  const addScene = () => {
    useScriptorium.getState().addScene(chapter.id);
  };

  return (
    <li
      ref={setNodeRef}
      className={"" + (isDragging ? " opacity-40" : "")}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <div className="flex items-stretch gap-1">
        <button
          ref={setActivatorNodeRef}
          type="button"
          className={DRAG_CLASS}
          aria-label={t("manuscript.dragChapter")}
          {...attributes}
          {...listeners}
        >
          {GRIP}
        </button>
        <button
          type="button"
          className={"book-ch-row flex-1 min-w-0 flex flex-col gap-0.5 text-left bg-none border-0 border-l-2 border-transparent rounded-lg text-parchment px-2 py-1.5 text-sm" + (selected ? " active border-l-gold bg-night-2" : "") + " hover:bg-night-2"}
          onClick={() => onSelect(chapter.id)}
        >
          <span className="book-ch-heading overflow-hidden text-ellipsis whitespace-nowrap">{chapter.heading}</span>
          <span className="text-[11px] text-slate [font-variant-numeric:tabular-nums]">{formatWords(words)}</span>
        </button>
        <button
          type="button"
          className="w-[26px] self-center bg-none border border-line rounded-lg text-parchment-dim text-xs leading-none hover:border-gold-dim hover:text-gold"
          aria-label={t("manuscript.addSceneChapter", { chapter: chapter.heading })}
          onClick={addScene}
          title={t("manuscript.addScene")}
        >
          +
        </button>
      </div>
      <ul className="book-scene-rows list-none m-0 pl-4 flex flex-col gap-0.5 mb-1">
        <SortableContext items={sceneIds} strategy={verticalListSortingStrategy}>
          {chapter.scenes.map((scene, i) => (
            <SceneRow key={scene.id} scene={scene} index={i} chapterId={chapter.id} onSceneSelect={onSceneSelect} />
          ))}
        </SortableContext>
      </ul>
    </li>
  );
});

/** The "no part" run: chapters without a part (or with a dangling one) print
 *  first, so the zone row only exists once parts exist. It is a droppable,
 *  not a sortable. */
function UngroupedZone() {
  const { t } = useTranslation();
  const { setNodeRef, isOver } = useDroppable({ id: UNGROUPED_ZONE });
  return (
    <li
      ref={setNodeRef}
      className={"flex items-center gap-2 px-2 py-1 mt-1 rounded-lg border border-dashed border-line text-[10px] uppercase tracking-[0.12em] text-[var(--text-faint)]" + (isOver ? " text-gold border-gold" : "")}
      data-testid="ungrouped-zone"
    >
      {t("manuscript.noPartZone")}
    </li>
  );
}

export function ChapterList({ sections, selectedId, onSelect, onSceneSelect, onCreate, onCreatePart }: ChapterListProps) {
  const { t } = useTranslation();
  const wordsRef = useRef(new Map<string, WordCacheEntry>());
  const chapters = useMemo(() => sections.flatMap((s) => s.chapters), [sections]);
  const wordsByChapter = useMemo(() => buildWordCounts(chapters, wordsRef.current), [chapters]);
  const parts = sections.map((s) => s.part).filter((p): p is Part => p !== null);
  const sortedParts = useMemo(() => [...parts].sort((a, b) => a.order - b.order), [parts]);
  const ungrouped = sections.find((s) => s.part === null)?.chapters ?? [];
  const hasParts = sortedParts.length > 0;

  const sensors = useSensors(
    // a short travel distance keeps plain clicks on rows clickable
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: treeKeyboardCoordinates }),
  );

  /** Drop → store move. The plan math lives in domain; here only the drop
   *  target is resolved: drop ON a row takes the target's slot (arrayMove
   *  semantics inside the same container), drop ON a part header or the
   *  "no part" zone appends to that container's end. The "no container"
   *  sentinel is strictly null — undefined means the ungrouped run. */
  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const state = useScriptorium.getState();
    const kindActive = kindOf(active.id);
    const book = state.manuscripts.find((m) =>
      m.chapters.some((c) => c.id === active.id || c.scenes.some((s) => s.id === active.id))
      || (m.parts ?? []).some((p) => p.id === active.id));
    if (!book) return;
    const chaptersSorted = () => [...book.chapters].sort((a, b) => a.order - b.order);
    const partsSorted = () => [...(book.parts ?? [])].sort((a, b) => a.order - b.order);
    const partOfChapter = (c: Chapter) =>
      c.partId && (book.parts ?? []).some((p) => p.id === c.partId) ? c.partId : undefined;
    const activeChapter = book.chapters.find((c) => c.id === active.id) ?? book.chapters.find((c) => c.scenes.some((s) => s.id === active.id));

    /** Which part container does the drop target row belong to? */
    const containerPartIdOf = (rowId: string): string | undefined | null => {
      const kind = kindOf(rowId);
      if (kind === "part") return rowId;
      if (kind === "zone") return undefined;
      if (kind === "chapter") {
        const ch = book.chapters.find((c) => c.id === rowId);
        return ch ? partOfChapter(ch) : null;
      }
      return null; // scene rows do not carry chapter containers for chapter drops
    };

    if (kindActive === "part") {
      const overPartId = containerPartIdOf(String(over.id));
      if (overPartId == null) return;
      const sorted = partsSorted();
      const from = sorted.findIndex((p) => p.id === active.id);
      const oi = sorted.findIndex((p) => p.id === overPartId);
      const target = sorted.filter((p) => p.id !== active.id);
      const tj = target.findIndex((p) => p.id === overPartId);
      if (tj < 0) return;
      // arrayMove semantics: the active takes the target's slot
      const toIndex = from < oi ? tj + 1 : tj;
      state.reorderPartTo(String(active.id), toIndex);
      return;
    }

    if (kindActive === "chapter") {
      // on a scene row: slot the chapter before that scene's chapter
      const overKind = kindOf(over.id);
      let containerPartId: string | undefined | null = (overKind === "chapter" || overKind === "part" || overKind === "zone")
        ? containerPartIdOf(String(over.id))
        : null;
      let beforeChapterId: string | undefined;
      if (containerPartId === null && overKind === "scene") {
        for (const c of book.chapters) {
          if (c.scenes.some((s) => s.id === over.id)) {
            containerPartId = partOfChapter(c);
            beforeChapterId = c.id;
            break;
          }
        }
      }
      if (containerPartId === null) return;
      const sameContainer = activeChapter != null && partOfChapter(activeChapter) === containerPartId;
      const original = chaptersSorted().filter((c) => partOfChapter(c) === containerPartId);
      const rest = original.filter((c) => c.id !== active.id);
      const ai = original.findIndex((c) => c.id === active.id);
      let targetId: string | undefined;
      if (beforeChapterId) targetId = beforeChapterId;
      else if (overKind === "chapter") targetId = String(over.id);
      let toIndex: number;
      if (targetId) {
        const tj = rest.findIndex((c) => c.id === targetId);
        if (tj < 0) { toIndex = rest.length; }
        else {
          // arrayMove: below the original slot when travelling downwards
          const oi = original.findIndex((c) => c.id === targetId);
          toIndex = sameContainer && ai >= 0 && ai < oi ? tj + 1 : tj;
        }
      } else {
        toIndex = rest.length; // part header or zone → append
      }
      state.moveChapterTo(String(active.id), containerPartId, toIndex);
      return;
    }

    if (kindActive === "scene") {
      const source = book.chapters.find((c) => c.scenes.some((s) => s.id === active.id));
      let targetChapterId: string | undefined = kindOf(over.id) === "chapter" ? String(over.id) : undefined;
      if (!targetChapterId) {
        for (const c of book.chapters) {
          if (c.scenes.some((s) => s.id === over.id)) {
            targetChapterId = c.id;
            break;
          }
        }
      }
      if (!source || !targetChapterId) return;
      const target = book.chapters.find((c) => c.id === targetChapterId);
      if (!target) return;
      const sameChapter = source.id === target.id;
      const rest = target.scenes.filter((s) => s.id !== active.id);
      let toIndex: number;
      if (kindOf(over.id) === "scene") {
        const tj = rest.findIndex((s) => s.id === over.id);
        if (tj < 0) return;
        const ai = source.scenes.findIndex((s) => s.id === active.id);
        const oi = target.scenes.findIndex((s) => s.id === over.id);
        toIndex = sameChapter && ai < oi ? tj + 1 : tj;
      } else {
        toIndex = rest.length; // dropped on the chapter row → append
      }
      state.moveScene(String(active.id), targetChapterId, toIndex);
    }
  };

  return (
    <aside className="book-chapters relative overflow-hidden flex flex-col gap-2.5 min-h-0 p-3 bg-night border-r border-line max-[720px]:border-r-0 max-[720px]:border-b max-[720px]:border-line">
      <div className="lamp-pool" aria-hidden="true" />
      {chapters.length === 0 && sortedParts.length === 0 ? (
        <p className="mx-2 my-2 text-parchment-dim text-[13px]">{t("manuscript.addFirstChapter")}</p>
      ) : null}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
        // re-measure every drag frame: nested sortables + debounced commits
        // change the row geometry while a drag runs
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      >
        <ul className="book-ch-rows list-none m-0 p-0.5 flex flex-col gap-1 overflow-y-auto flex-1 min-h-0" aria-label={t("manuscript.chaptersAria")}>
          {hasParts ? (
            <>
              <UngroupedZone />
              <SortableContext items={ungrouped.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                {ungrouped.map((chapter) => (
                  <ChapterRow
                    key={chapter.id}
                    chapter={chapter}
                    selected={chapter.id === selectedId}
                    onSelect={onSelect}
                    onSceneSelect={onSceneSelect}
                  />
                ))}
              </SortableContext>
              <SortableContext items={sortedParts.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                {sortedParts.map((part) => (
                  <PartRow
                    key={part.id}
                    part={part}
                    chapters={sections.find((s) => s.part?.id === part.id)?.chapters ?? []}
                    words={(sections.find((s) => s.part?.id === part.id)?.chapters ?? []).reduce((n, c) => n + (wordsByChapter.get(c.id)?.words ?? 0), 0)}
                    selected={selectedId}
                    onSelect={onSelect}
                    onSceneSelect={onSceneSelect}
                  />
                ))}
              </SortableContext>
            </>
          ) : (
            <SortableContext items={ungrouped.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              {ungrouped.map((chapter) => (
                <ChapterRow
                  key={chapter.id}
                  chapter={chapter}
                  selected={chapter.id === selectedId}
                  onSelect={onSelect}
                  onSceneSelect={onSceneSelect}
                />
              ))}
            </SortableContext>
          )}
        </ul>
      </DndContext>
      <div className="flex flex-col gap-1.5">
        <Button className="book-ch-new self-start" onClick={onCreate}>
          {t("manuscript.newChapter")}
        </Button>
        <Button className="book-ch-new self-start" onClick={onCreatePart}>
          {t("manuscript.newPart")}
        </Button>
      </div>
    </aside>
  );
}

export function DocxReplaceButton({ chapterId }: { chapterId: string }) {
  const { t } = useTranslation();
  const pushToast = useScriptorium((s) => s.pushToast);
  const onChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const { importDocxToHtml } = await import("./docx");
      const html = await importDocxToHtml(file);
      useScriptorium.getState().replaceChapterBody(chapterId, html);
      pushToast("success", t("manuscript.chapterReplaced"));
    } catch {
      pushToast("error", t("manuscript.docxImportFailed"));
    }
  };
  return (
    <label className="book-mode book-docx-btn bg-none border border-line text-parchment-dim rounded-full px-3 py-1 text-xs tracking-[0.06em] hover:border-gold-dim cursor-pointer" title={t("manuscript.replaceDocxTitle")}>
      {t("manuscript.replaceDocx")}
      <input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="sr-only" onChange={(e) => void onChange(e)} />
    </label>
  );
}
