import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useParams, useOutletContext } from "react-router-dom";
import { useScriptorium } from "../data/store";
import { LibraryPage } from "../features/projects/LibraryPage";
import { AtlasIndexPage } from "../features/atlas/AtlasIndexPage";
import { AtlasEditor } from "../features/atlas/AtlasEditor";
import { CodexPage } from "../features/entries/CodexPage";
import { TimelinePage } from "../features/timeline/TimelinePage";
import { BloodlineIndexPage } from "../features/bloodline/BloodlineIndexPage";
import { BloodlineCanvasPage } from "../features/bloodline/BloodlineCanvas";
import { FactionWebServicePage } from "../features/factions/FactionPageIndex";
import { FactionWebPage } from "../features/factions/FactionWebPage";
import { CalendarIndexPage } from "../features/calendar/CalendarIndexPage";
import { CalendarPage } from "../features/calendar/CalendarPage";
import { PlotBoardPage } from "../features/plotboard/PlotBoardPage";
import { PlotBoardIndexPage } from "../features/plotboard/PlotBoardIndexPage";
import { TimelineIndexPage } from "../features/timelinecanvas/TimelineIndexPage";
import { TimelineCanvasPage } from "../features/timelinecanvas/TimelineCanvasPage";
import { OathsIndexPage } from "../features/oaths/OathsIndexPage";
import { OathsChartPage } from "../features/oaths/OathsChartPage";
import { WellSpringIndexPage } from "../features/wellspring/WellSpringIndexPage";
import { WellSpringPage } from "../features/wellspring/WellSpringPage";
import { ConlangIndexPage } from "../features/conlang/ConlangIndexPage";
import { ConlangPage } from "../features/conlang/ConlangPage";
import { BinderyPage, BinderyIndex } from "../features/manuscript/BinderyPage";
import type { WorkspaceContext } from "../features/workspace/OverviewPage";
import { ManuscriptPage } from "../features/manuscript/ManuscriptPage";
import { OverviewPage } from "../features/workspace/OverviewPage";
import { WorkspaceLayout } from "../features/workspace/WorkspaceLayout";
import { UpdatesPage } from "../features/updates/UpdatesPage";
import { ProfilePage } from "../features/account/ProfilePage";
import { PublicProfilePage } from "../features/account/PublicProfilePage";
import { SettingsPage } from "../features/account/SettingsPage";
import { ChroniclesPage } from "../features/chronicles/ChroniclesPage";

function AtlasEditorRoute() {
  const { projectId, atlasId } = useParams();
  return <AtlasEditor atlasId={atlasId ?? ""} projectId={projectId} />;
}

function CodexRoute() {
  const { projectId } = useParams();
  return <CodexPage projectId={projectId ?? ""} />;
}

function ManuscriptRoute() {
  const { projectId } = useParams();
  return <ManuscriptPage projectId={projectId ?? ""} />;
}

function TimelineRoute() {
  const { projectId } = useParams();
  return <TimelinePage projectId={projectId ?? ""} />;
}

function BloodlineCanvasRoute() {
  const { bloodlineId } = useParams();
  return <BloodlineCanvasPage bloodlineId={bloodlineId ?? ""} />;
}

function BloodlineIndexRoute() {
  const { projectId } = useParams();
  return <BloodlineIndexPage projectId={projectId ?? ""} />;
}

function FactionsIndexRoute() {
  const { projectId } = useParams();
  return <FactionWebServicePage projectId={projectId ?? ""} />;
}

function FactionWebRoute() {
  const { webId } = useParams();
  return <FactionWebPage webId={webId ?? ""} />;
}

function CalendarIndexRoute() {
  const { projectId } = useParams();
  return <CalendarIndexPage projectId={projectId ?? ""} />;
}

function CalendarRoute() {
  const { calendarId } = useParams();
  return <CalendarPage calendarId={calendarId ?? ""} />;
}

function PlotBoardIndexRoute() {
  const { projectId } = useParams();
  return <PlotBoardIndexPage projectId={projectId ?? ""} />;
}

function PlotBoardRoute() {
  const { boardId } = useParams();
  return <PlotBoardPage boardId={boardId ?? ""} />;
}

function TimelineIndexRoute() {
  const { projectId } = useParams();
  return <TimelineIndexPage projectId={projectId ?? ""} />;
}

function TimelineWheelRoute() {
  const { timelineId } = useParams();
  return <TimelineCanvasPage timelineId={timelineId ?? ""} />;
}

function OathsIndexRoute() {
  const { projectId } = useParams();
  return <OathsIndexPage projectId={projectId ?? ""} />;
}

function OathsChartRoute() {
  const { chartId } = useParams();
  return <OathsChartPage chartId={chartId ?? ""} />;
}

function WellSpringIndexRoute() {
  const { projectId } = useParams();
  return <WellSpringIndexPage projectId={projectId ?? ""} />;
}

function WellSpringRoute() {
  const { wellId } = useParams();
  return <WellSpringPage wellId={wellId ?? ""} />;
}

function ConlangIndexRoute() {
  const { projectId } = useParams();
  return <ConlangIndexPage projectId={projectId ?? ""} />;
}

function ConlangRoute() {
  const { conlangId } = useParams();
  return <ConlangPage conlangId={conlangId ?? ""} />;
}

function BinderyIndexRoute() {
  const { projectId } = useOutletContext<WorkspaceContext>();
  return <BinderyIndex projectId={projectId} />;
}

function BinderyRoute() {
  const { manuscriptId } = useParams();
  return <BinderyPage manuscriptId={manuscriptId ?? ""} />;
}

export function AppRouter() {
  // Deep-link safety: zustand/persist rehydrates async — blocking the first
  // render until hydration completes keeps WorkspaceLayout from falsely
  // redirecting to "/" on plen reloads (URL paste / F5 on /p/:id/...).
  const [hydrated, setHydrated] = useState(() => useScriptorium.persist.hasHydrated());
  useEffect(() => {
    if (hydrated) return;
    return useScriptorium.persist.onFinishHydration(() => setHydrated(true));
  }, [hydrated]);

  if (!hydrated) return <div className="min-h-screen bg-background" data-testid="hydration-splash" />;

  return (
    <Routes>
      <Route path="/" element={<LibraryPage />} />
      <Route path="/chronicles" element={<ChroniclesPage />} />
      <Route path="/updates" element={<UpdatesPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/u/:username" element={<PublicProfilePage />} />
      <Route path="/p/:projectId" element={<WorkspaceLayout />}>
        <Route index element={<OverviewPage />} />
        <Route path="atlas" element={<AtlasIndexPage />} />
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
  );
}
