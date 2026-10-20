import { lazy } from "react";

/** Feature chunks: one dynamic import per feature (not per page). Pages load on
 *  first navigation and hover-prefetch from the rail; the writing trio (overview,
 *  lore, chronology) and the shell stay eager. */

const LazyAtlasIndex = lazy(() =>
  import("../features/atlas/AtlasIndexPage").then((m) => ({ default: m.AtlasIndexPage })));
const LazyAtlasEditor = lazy(() =>
  import("../features/atlas/AtlasEditor").then((m) => ({ default: m.AtlasEditor })));
const LazyBloodlineIndex = lazy(() =>
  import("../features/bloodline/BloodlineIndexPage").then((m) => ({ default: m.BloodlineIndexPage })));
const LazyBloodlineCanvas = lazy(() =>
  import("../features/bloodline/BloodlineCanvas").then((m) => ({ default: m.BloodlineCanvasPage })));
const LazyFactionIndex = lazy(() =>
  import("../features/factions/FactionPageIndex").then((m) => ({ default: m.FactionWebServicePage })));
const LazyFactionWeb = lazy(() =>
  import("../features/factions/FactionWebPage").then((m) => ({ default: m.FactionWebPage })));
const LazyCalendarIndex = lazy(() =>
  import("../features/calendar/CalendarIndexPage").then((m) => ({ default: m.CalendarIndexPage })));
const LazyCalendar = lazy(() =>
  import("../features/calendar/CalendarPage").then((m) => ({ default: m.CalendarPage })));
const LazyPlotIndex = lazy(() =>
  import("../features/plotboard/PlotBoardIndexPage").then((m) => ({ default: m.PlotBoardIndexPage })));
const LazyPlotBoard = lazy(() =>
  import("../features/plotboard/PlotBoardPage").then((m) => ({ default: m.PlotBoardPage })));
const LazyWheelIndex = lazy(() =>
  import("../features/timelinecanvas/TimelineIndexPage").then((m) => ({ default: m.TimelineIndexPage })));
const LazyWheelCanvas = lazy(() =>
  import("../features/timelinecanvas/TimelineCanvasPage").then((m) => ({ default: m.TimelineCanvasPage })));
const LazyOathsIndex = lazy(() =>
  import("../features/oaths/OathsIndexPage").then((m) => ({ default: m.OathsIndexPage })));
const LazyOathsChart = lazy(() =>
  import("../features/oaths/OathsChartPage").then((m) => ({ default: m.OathsChartPage })));
const LazyWellIndex = lazy(() =>
  import("../features/wellspring/WellSpringIndexPage").then((m) => ({ default: m.WellSpringIndexPage })));
const LazyWellSpring = lazy(() =>
  import("../features/wellspring/WellSpringPage").then((m) => ({ default: m.WellSpringPage })));
const LazyConlangIndex = lazy(() =>
  import("../features/conlang/ConlangIndexPage").then((m) => ({ default: m.ConlangIndexPage })));
const LazyConlang = lazy(() =>
  import("../features/conlang/ConlangPage").then((m) => ({ default: m.ConlangPage })));
const LazyBindery = lazy(() =>
  import("../features/manuscript/BinderyPage").then((m) => ({ default: m.BinderyPage })));
const LazyBinderyIndex = lazy(() =>
  import("../features/manuscript/BinderyPage").then((m) => ({ default: m.BinderyIndex })));
const LazyManuscript = lazy(() =>
  import("../features/manuscript/ManuscriptPage").then((m) => ({ default: m.ManuscriptPage })));

export {
  LazyAtlasIndex, LazyAtlasEditor, LazyBloodlineIndex, LazyBloodlineCanvas,
  LazyFactionIndex, LazyFactionWeb, LazyCalendarIndex, LazyCalendar,
  LazyPlotIndex, LazyPlotBoard, LazyWheelIndex, LazyWheelCanvas,
  LazyOathsIndex, LazyOathsChart, LazyWellIndex, LazyWellSpring,
  LazyConlangIndex, LazyConlang, LazyBindery, LazyBinderyIndex, LazyManuscript,
};

type Loader = () => Promise<unknown>;
const loaders: Record<string, Loader> = {
  atlas: () => import("../features/atlas/AtlasIndexPage"),
  bloodline: () => import("../features/bloodline/BloodlineIndexPage"),
  factions: () => import("../features/factions/FactionPageIndex"),
  oaths: () => import("../features/oaths/OathsIndexPage"),
  calendar: () => import("../features/calendar/CalendarIndexPage"),
  plotboard: () => import("../features/plotboard/PlotBoardIndexPage"),
  linewheel: () => import("../features/timelinecanvas/TimelineIndexPage"),
  wellspring: () => import("../features/wellspring/WellSpringIndexPage"),
  conlang: () => import("../features/conlang/ConlangIndexPage"),
  manuscript: () => import("../features/manuscript/ManuscriptPage"),
  bindery: () => import("../features/manuscript/BinderyPage"),
};

const requested = new Map<string, Promise<unknown>>();

/** Hover/focus prefetch from the rail; idempotent per section key. Unknown
 *  keys (overview, lore, chronology) ship with the shell. */
export function preloadSection(key: string): void {
  const loader = loaders[key];
  if (!loader || requested.has(key)) return;
  requested.set(key, loader());
}
