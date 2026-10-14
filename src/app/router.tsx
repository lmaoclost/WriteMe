import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { LibraryPage } from "../features/projects/LibraryPage";
import { AtlasIndexPage } from "../features/atlas/AtlasIndexPage";
import { AtlasEditor } from "../features/atlas/AtlasEditor";
import { CodexPage } from "../features/entries/CodexPage";
import { OverviewPage } from "../features/workspace/OverviewPage";
import { PlaceholderPage } from "../features/workspace/PlaceholderPage";
import { WorkspaceLayout } from "../features/workspace/WorkspaceLayout";

function AtlasEditorRoute() {
  const { projectId, atlasId } = useParams();
  return <AtlasEditor atlasId={atlasId ?? ""} projectId={projectId} />;
}

function CodexRoute() {
  const { projectId } = useParams();
  return <CodexPage projectId={projectId ?? ""} />;
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
        <Route path="manuscript" element={<PlaceholderPage section="manuscript" />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
