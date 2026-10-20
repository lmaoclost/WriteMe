import { useEffect, useState, Suspense } from "react";
import { Navigate, Route, Routes, useParams, useOutletContext } from "react-router-dom";
import { useScriptorium } from "../data/store";
import { Toasts } from "../ui/Toasts";
import { LibraryPage } from "../features/projects/LibraryPage";
import { CodexPage } from "../features/entries/CodexPage";
import { TimelinePage } from "../features/timeline/TimelinePage";
import type { WorkspaceContext } from "../features/workspace/OverviewPage";
import { OverviewPage } from "../features/workspace/OverviewPage";
import { WorkspaceLayout } from "../features/workspace/WorkspaceLayout";
import { CommandPalette } from "../ui/CommandPalette";
import {
  LazyAtlasIndex, LazyAtlasEditor, LazyBloodlineIndex, LazyBloodlineCanvas,
  LazyFactionIndex, LazyFactionWeb, LazyCalendarIndex, LazyCalendar,
  LazyPlotIndex, LazyPlotBoard, LazyWheelIndex, LazyWheelCanvas,
  LazyOathsIndex, LazyOathsChart, LazyWellIndex, LazyWellSpring,
  LazyConlangIndex, LazyConlang, LazyBindery, LazyBinderyIndex, LazyManuscript,
} from "./lazyRoutes";

function AtlasEditorRoute() {
  const { projectId, atlasId } = useParams();
  return <LazyAtlasEditor atlasId={atlasId ?? ""} projectId={projectId} />;
}

function CodexRoute() {
  const { projectId } = useParams();
  return <CodexPage projectId={projectId ?? ""} />;
}

function ManuscriptRoute() {
  const { projectId } = useParams();
  return <LazyManuscript projectId={projectId ?? ""} />;
}

function TimelineRoute() {
  const { projectId } = useParams();
  return <TimelinePage projectId={projectId ?? ""} />;
}

function BloodlineCanvasRoute() {
  const { bloodlineId } = useParams();
  return <LazyBloodlineCanvas bloodlineId={bloodlineId ?? ""} />;
}

function BloodlineIndexRoute() {
  const { projectId } = useParams();
  return <LazyBloodlineIndex projectId={projectId ?? ""} />;
}

function FactionsIndexRoute() {
  const { projectId } = useParams();
  return <LazyFactionIndex projectId={projectId ?? ""} />;
}

function FactionWebRoute() {
  const { webId } = useParams();
  return <LazyFactionWeb webId={webId ?? ""} />;
}

function CalendarIndexRoute() {
  const { projectId } = useParams();
  return <LazyCalendarIndex projectId={projectId ?? ""} />;
}

function CalendarRoute() {
  const { calendarId } = useParams();
  return <LazyCalendar calendarId={calendarId ?? ""} />;
}

function PlotBoardIndexRoute() {
  const { projectId } = useParams();
  return <LazyPlotIndex projectId={projectId ?? ""} />;
}

function PlotBoardRoute() {
  const { boardId } = useParams();
  return <LazyPlotBoard boardId={boardId ?? ""} />;
}

function TimelineIndexRoute() {
  const { projectId } = useParams();
  return <LazyWheelIndex projectId={projectId ?? ""} />;
}

function TimelineWheelRoute() {
  const { timelineId } = useParams();
  return <LazyWheelCanvas timelineId={timelineId ?? ""} />;
}

function OathsIndexRoute() {
  const { projectId } = useParams();
  return <LazyOathsIndex projectId={projectId ?? ""} />;
}

function OathsChartRoute() {
  const { chartId } = useParams();
  return <LazyOathsChart chartId={chartId ?? ""} />;
}

function WellSpringIndexRoute() {
  const { projectId } = useParams();
  return <LazyWellIndex projectId={projectId ?? ""} />;
}

function WellSpringRoute() {
  const { wellId } = useParams();
  return <LazyWellSpring wellId={wellId ?? ""} />;
}

function ConlangIndexRoute() {
  const { projectId } = useParams();
  return <LazyConlangIndex projectId={projectId ?? ""} />;
}

function ConlangRoute() {
  const { conlangId } = useParams();
  return <LazyConlang conlangId={conlangId ?? ""} />;
}

function BinderyIndexRoute() {
  const { projectId } = useOutletContext<WorkspaceContext>();
  return <LazyBinderyIndex projectId={projectId} />;
}

function BinderyRoute() {
  const { manuscriptId } = useParams();
  return <LazyBindery manuscriptId={manuscriptId ?? ""} />;
}

export function AppRouter() {
  // Deep-link safety: zustand/persist rehydrates async and IndexedDB images load
  // async after that — blocking the first render until both complete keeps
  // WorkspaceLayout from falsely redirecting to "/" on plen reloads (URL paste /
  // F5 on /p/:id/...) and keeps cover/map/avatar surfaces free of placeholders.
  const [hydrated, setHydrated] = useState(() => useScriptorium.persist.hasHydrated());
  const imagesReady = useScriptorium((s) => s.imagesReady);
  useEffect(() => {
    if (hydrated) return;
    return useScriptorium.persist.onFinishHydration(() => setHydrated(true));
  }, [hydrated]);

  if (!hydrated || !imagesReady) return <div className="min-h-screen bg-background" data-testid="hydration-splash" />;

  return (
    <>
      <Suspense
        fallback={<div className="min-h-screen bg-background" data-testid="chunk-splash" />}
      >
        <Routes>
        <Route path="/" element={<LibraryPage />} />
        <Route path="/p/:projectId" element={<WorkspaceLayout />}>
        <Route index element={<OverviewPage />} />
        <Route path="atlas" element={<LazyAtlasIndex />} />
        <Route path="atlas/:atlasId" element={<AtlasEditorRoute />} />
        <Route path="entries" element={<CodexRoute />} />
        <Route path="timeline" element={<TimelineRoute />} />
        <Route path="bloodline" element={<BloodlineIndexRoute />} />
        <Route path="bloodline/:bloodlineId" element={<BloodlineCanvasRoute />} />
        <Route path="factions" element={<FactionsIndexRoute />} />
        <Route path="factions/:webId" element={<FactionWebRoute />} />
        <Route path="calendar" element={<CalendarIndexRoute />} />
        <Route path="calendar/:calendarId" element={<CalendarRoute />} />
        <Route path="plotboard" element={<PlotBoardIndexRoute />} />
        <Route path="plotboard/:boardId" element={<PlotBoardRoute />} />
        <Route path="linewheel" element={<TimelineIndexRoute />} />
        <Route path="linewheel/:timelineId" element={<TimelineWheelRoute />} />
        <Route path="oaths" element={<OathsIndexRoute />} />
        <Route path="oaths/:chartId" element={<OathsChartRoute />} />
        <Route path="wellspring" element={<WellSpringIndexRoute />} />
        <Route path="wellspring/:wellId" element={<WellSpringRoute />} />
        <Route path="conlang" element={<ConlangIndexRoute />} />
        <Route path="conlang/:conlangId" element={<ConlangRoute />} />
        <Route path="bindery" element={<BinderyIndexRoute />} />
        <Route path="bindery/:manuscriptId" element={<BinderyRoute />} />
        <Route path="manuscript" element={<ManuscriptRoute />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
      <CommandPalette />
      <Toasts />
    </>
  );
}
