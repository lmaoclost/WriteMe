import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { LibraryPage } from "../features/projects/LibraryPage";
import { AtlasIndexPage } from "../features/atlas/AtlasIndexPage";
import { AtlasEditor } from "../features/atlas/AtlasEditor";
import { CodexPage } from "../features/entries/CodexPage";
import { TimelinePage } from "../features/timeline/TimelinePage";
import { BloodlineIndexPage } from "../features/bloodline/BloodlineIndexPage";
import { BloodlineCanvasPage } from "../features/bloodline/BloodlineCanvas";
import { FactionWebServicePage } from "../features/factions/FactionPageIndex";
import { FactionWebPage } from "../features/factions/FactionWebPage";
import { ManuscriptPage } from "../features/manuscript/ManuscriptPage";
import { OverviewPage } from "../features/workspace/OverviewPage";
import { WorkspaceLayout } from "../features/workspace/WorkspaceLayout";

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

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<LibraryPage />} />
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
        <Route path="manuscript" element={<ManuscriptRoute />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
